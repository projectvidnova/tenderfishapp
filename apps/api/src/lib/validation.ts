/**
 * Centralized Zod validation schemas for all API route inputs.
 * Used by route handlers to validate request bodies, params, and query strings.
 */
import { z } from "zod";

// ─── Reusable Primitives ──────────────────────────────────────

const uuidParam = z.string().uuid();
const nonEmptyTrimmed = z.string().trim().min(1);
const optionalTrimmed = z.string().trim().optional();
const email = z.string().trim().toLowerCase().email();
const dateString = z.string().date().optional(); // YYYY-MM-DD

// ─── Auth ─────────────────────────────────────────────────────

export const signupSchema = z.object({
  name: nonEmptyTrimmed,
  email,
  password: z.string().min(8, "Password must be at least 8 characters"),
  company: nonEmptyTrimmed,
  country: z.string().trim().optional(),
});

export const loginSchema = z.object({
  email,
  password: z.string().min(1, "Password is required"),
});

// ─── Projects ─────────────────────────────────────────────────

const projectTypeEnum = z.enum([
  "new_build", "refurbishment", "conversion", "interior_fit_out", "mixed_use", "not_sure",
]);

const procurementModelEnum = z.enum(["general_contractor", "single_trades", "unclear"]);

export const createProjectSchema = z.object({
  name: nonEmptyTrimmed,
  type: projectTypeEnum.optional().default("not_sure"),
  location: optionalTrimmed,
  clientName: optionalTrimmed,
  procurementModel: procurementModelEnum.optional().default("unclear"),
  targetCompletion: dateString,
  objective: optionalTrimmed,
  scopeSummary: optionalTrimmed,
});

export const updateProjectSchema = z.object({
  name: optionalTrimmed,
  type: projectTypeEnum.optional(),
  status: z.enum(["active", "on_hold", "archived"]).optional(),
  location: optionalTrimmed,
  clientName: optionalTrimmed,
  clientRepresentative: optionalTrimmed,
  procurementModel: procurementModelEnum.optional(),
  targetCompletion: dateString,
  objective: optionalTrimmed,
  scopeSummary: optionalTrimmed,
  healthScore: z.enum(["green", "amber", "red"]).optional(),
}).refine((data) => Object.keys(data).length > 0, {
  message: "At least one field must be provided",
});

// ─── Project Facts ────────────────────────────────────────────

export const updateFactSchema = z.object({
  value: z.string().nullable(),
  dataState: z.enum(["CONFIRMED", "DERIVED", "UNCLEAR", "MISSING"]),
});

// ─── Gates ────────────────────────────────────────────────────

export const gateOverrideSchema = z.object({
  reason: z.string().trim().min(50, "Override reason must be at least 50 characters"),
});

export const gateLetterParam = z.enum(["A", "B", "C", "D", "E", "F"]);

// ─── Approvals ────────────────────────────────────────────────

const approvalTypeEnum = z.enum([
  "client", "internal", "technical", "material",
  "package_release", "tender_release", "execution_release", "closeout",
]);

export const createApprovalSchema = z.object({
  name: nonEmptyTrimmed,
  type: approvalTypeEnum,
  approverUserId: uuidParam.optional(),
  dueDate: dateString,
  relatedGate: gateLetterParam.optional(),
  relatedPhaseId: uuidParam.optional(),
  notes: optionalTrimmed,
});

// ─── Documents ────────────────────────────────────────────────

const documentTypeEnum = z.enum([
  "project_brief", "contract", "planning", "approval",
  "tender", "execution", "meeting_record", "correspondence", "evidence",
]);

export const createDocumentSchema = z.object({
  name: nonEmptyTrimmed,
  type: documentTypeEnum,
  relatedPhaseId: uuidParam.optional(),
  relatedPackageId: uuidParam.optional(),
});

// ─── Invitations ──────────────────────────────────────────────

const projectRoleEnum = z.enum([
  "architect_admin", "project_lead", "team_member", "client",
  "client_representative", "consultant", "reviewer", "approver",
  "document_controller", "bidder", "general_contractor", "trade_contractor",
]);

export const batchInvitationSchema = z.object({
  invitations: z.array(z.object({
    email,
    role: z.enum(["project_lead", "team_member"]),
  })).min(1, "At least one invitation is required"),
});

export const projectInvitationSchema = z.object({
  email,
  role: projectRoleEnum,
  gateAtInvitation: gateLetterParam.optional(),
});

// ─── Consultants ──────────────────────────────────────────────

export const createConsultantSchema = z.object({
  discipline: nonEmptyTrimmed,
  contactName: optionalTrimmed,
  company: optionalTrimmed,
  email: email.optional(),
});

// ─── Reviews ──────────────────────────────────────────────────

export const createReviewSchema = z.object({
  title: nonEmptyTrimmed,
  type: z.enum(["shop_drawing", "execution_evidence"]),
  packageName: optionalTrimmed,
  contractor: optionalTrimmed,
  submittedBy: nonEmptyTrimmed,
  submissionDate: z.string().date(),
  reviewerId: uuidParam.optional(),
  reviewDueDate: dateString,
});

// ─── Settings / Workspace ─────────────────────────────────────

export const updateWorkspaceSchema = z.object({
  name: optionalTrimmed,
  street: optionalTrimmed,
  city: optionalTrimmed,
  postcode: optionalTrimmed,
  country: optionalTrimmed,
  taxId: optionalTrimmed,
  defaultTimezone: optionalTrimmed,
}).refine((data) => Object.keys(data).length > 0, {
  message: "At least one field must be provided",
});

// ─── Common Param Schemas ─────────────────────────────────────

export const idParam = z.object({ id: uuidParam });
export const projectIdParam = z.object({ id: uuidParam });

// ─── Lifecycle State Machine ──────────────────────────────────

export const transitionStateSchema = z.object({
  targetState: z.enum([
    "input_received", "parsed", "needs_review", "confirmed",
    "structure_approved", "cost_ready", "detail_ready",
    "tender_ready", "released_for_tender",
  ]),
});

// ─── Structured Project Description (SPD) ─────────────────────

export const createSpdSchema = z.object({
  projectName: z.string().min(1).max(500),
  projectGoal: z.string().min(1).max(5000),
  projectType: z.string().min(1).max(200),
  location: z.string().min(1).max(1000),
  participants: z.array(z.object({
    name: z.string().min(1),
    role: z.string().min(1),
    company: z.string().optional(),
    email: z.string().email().optional(),
  })),
  scopeOfWork: z.string().min(1).max(10000),
  spatialScope: z.string().min(1).max(5000),
  relevantApprovedDocuments: z.array(z.string().uuid()).default([]),
  assumptions: z.array(z.string()).default([]),
  openPoints: z.array(z.object({
    point: z.string().min(1),
    priority: z.string().default("medium"),
    assignedTo: z.string().optional(),
  })).default([]),
  currentProjectPhase: z.string().min(1).max(200),
  approvedProjectResources: z.array(z.string().uuid()).default([]),
  currentDefinedProjectStatus: z.string().min(1).max(2000),
});

export const updateSpdSchema = createSpdSchema.partial();

// ─── Approved Resources ───────────────────────────────────────

export const approveResourceSchema = z.object({
  documentId: z.string().uuid(),
});

// ─── Tender Release ───────────────────────────────────────────

export const createTenderReleaseSchema = z.object({
  notes: z.string().max(5000).optional(),
});

export const updateTenderReleaseSchema = z.object({
  status: z.enum(["pending_review", "ready", "released", "recalled"]),
  recallReason: z.string().max(5000).optional(),
  notes: z.string().max(5000).optional(),
});

// ─── Participants ─────────────────────────────────────────────

export const createParticipantSchema = z.object({
  name: z.string().min(1).max(300),
  email: z.string().email().optional(),
  company: z.string().max(300).optional(),
  role: z.enum([
    "architect_admin", "project_lead", "team_member",
    "client", "client_representative", "consultant",
    "reviewer", "approver", "document_controller",
    "bidder", "general_contractor", "trade_contractor",
  ]),
  accessLevel: z.enum(["external_source", "lightweight", "full_account"]).default("external_source"),
  inferredFrom: z.object({
    source: z.string(),
    signals: z.array(z.string()),
    confidence: z.number().min(0).max(100),
  }).optional(),
});

export const updateParticipantSchema = createParticipantSchema.partial().extend({
  roleConfirmed: z.boolean().optional(),
});

// ─── Helper ───────────────────────────────────────────────────

/**
 * Parse and validate input with a Zod schema.
 * Returns { success: true, data } or { success: false, error }.
 */
export function validateBody<T extends z.ZodTypeAny>(
  schema: T,
  input: unknown
): { success: true; data: z.infer<T> } | { success: false; error: string } {
  const result = schema.safeParse(input);
  if (!result.success) {
    const messages = result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`);
    return { success: false, error: messages.join("; ") };
  }
  return { success: true, data: result.data };
}
