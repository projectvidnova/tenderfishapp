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
  forceRelease: z.boolean().optional(),
  overrideReason: z.string().min(1).max(5000).optional(),
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

// ─── Contracts (post-tender) ─────────────────────────────────

export const createContractSchema = z.object({
  packageId: z.string().uuid().optional(),
  contractNumber: z.string().max(100).optional(),
  title: z.string().min(1).max(500),
  contractType: z.enum(["vob_b", "bgb_werkvertrag"]).default("vob_b"),
  tenderingProcedure: z
    .enum([
      "oeffentliche_ausschreibung",
      "beschraenkte_ausschreibung",
      "beschraenkte_ausschreibung_mit_tw",
      "verhandlungsvergabe",
      "verhandlungsvergabe_mit_tw",
      "wettbewerblicher_dialog",
      "direktauftrag",
    ])
    .optional(),
  contractorCompany: z.string().min(1).max(255),
  contractorContact: z.string().max(255).optional(),
  contractorEmail: z.string().email().optional(),
  awardDate: z.string().optional(),
  commencementDate: z.string().optional(),
  completionDate: z.string().optional(),
  contractValueNet: z.number().int().nonnegative().default(0),
  contractValueGross: z.number().int().nonnegative().default(0),
  retentionPercentage: z.number().int().nonnegative().default(500),
  warrantyPeriodMonths: z.number().int().nonnegative().default(48),
  costGroupCode: z.string().max(10).optional(),
  notes: z.string().max(5000).optional(),
});

export const updateContractSchema = createContractSchema.partial().extend({
  status: z.enum(["draft", "tendered", "awarded", "active", "in_warranty", "closed", "terminated"]).optional(),
  abnahmeDate: z.string().optional(),
  warrantyEndDate: z.string().optional(),
  retentionAmount: z.number().int().nonnegative().optional(),
});

// ─── Payments ────────────────────────────────────────────────

export const createPaymentSchema = z.object({
  paymentNumber: z.string().min(1).max(50),
  type: z.enum(["abschlagszahlung", "teilschlussrechnung", "schlussrechnung", "sicherheitseinbehalt"]),
  invoiceDate: z.string(),
  invoiceRef: z.string().max(255).optional(),
  amountNet: z.number().int().nonnegative(),
  amountGross: z.number().int().nonnegative(),
  vatRate: z.number().int().nonnegative().default(1900),
  retentionDeducted: z.number().int().nonnegative().default(0),
  dueDate: z.string().optional(),
  notes: z.string().max(5000).optional(),
});

export const updatePaymentSchema = z.object({
  status: z.enum(["submitted", "under_review", "approved", "paid", "disputed"]).optional(),
  paidDate: z.string().optional(),
  notes: z.string().max(5000).optional(),
});

// ─── Abnahmen ────────────────────────────────────────────────

export const createAbnahmeSchema = z.object({
  type: z.enum(["foermliche_abnahme", "stillschweigende_abnahme", "teilabnahme", "fiktive_abnahme"]),
  scheduledDate: z.string(),
  attendees: z
    .array(
      z.object({
        name: z.string(),
        role: z.string(),
        company: z.string().optional(),
      })
    )
    .default([]),
  notes: z.string().max(5000).optional(),
});

export const updateAbnahmeSchema = z.object({
  actualDate: z.string().optional(),
  status: z
    .enum(["scheduled", "completed_without_defects", "completed_with_defects", "refused"])
    .optional(),
  defects: z
    .array(
      z.object({
        description: z.string(),
        severity: z.string(),
        deadline: z.string().optional(),
        resolved: z.boolean().default(false),
      })
    )
    .optional(),
  warrantyStartDate: z.string().optional(),
  protocolRef: z.string().optional(),
  notes: z.string().max(5000).optional(),
});

// ─── Nachträge (change orders) ───────────────────────────────

export const createNachtragSchema = z.object({
  nachtragNumber: z.string().min(1).max(50),
  title: z.string().min(1).max(500),
  type: z.enum([
    "mengenabweichung",
    "geaenderte_leistung",
    "zusaetzliche_leistung",
    "selbst_uebernahme",
    "behinderung",
    "stundenlohn",
  ]),
  vobReference: z.string().max(100).optional(),
  description: z.string().min(1),
  requestedAmountNet: z.number().int().default(0),
  scheduleImpactDays: z.number().int().default(0),
  submittedBy: z.string().min(1).max(255),
  supportingDocuments: z.array(z.string()).default([]),
});

export const updateNachtragSchema = z.object({
  status: z
    .enum(["draft", "submitted", "under_review", "approved", "rejected", "partially_approved"])
    .optional(),
  approvedAmountNet: z.number().int().nullable().optional(),
  notes: z.string().max(5000).optional(),
});

// ─── Site/execution data (matches existing UI shape) ──────────

export const createExecutionSubmissionSchema = z.object({
  title: z.string().min(1).max(500),
  packageName: z.string().max(500).optional(),
  contractor: z.string().max(255).optional(),
  submittedBy: z.string().max(255).optional(),
  submissionDate: z.string(),
});

export const reviewExecutionSubmissionSchema = z.object({
  reviewOutcome: z
    .enum(["approved", "approved_with_comments", "resubmission_required", "rejected"])
    .optional(),
  reviewComment: z.string().max(5000).optional(),
  status: z
    .enum(["received", "completeness_check", "assigned", "under_review", "deviation_log", "closed"])
    .optional(),
});

export const createDelaySchema = z.object({
  eventDate: z.string(),
  reportedBy: z.string().min(1).max(255),
  description: z.string().min(1),
  causeCategory: z.enum([
    "client_delay",
    "missing_approval",
    "design_change",
    "missing_information",
    "consultant_delay",
    "contractor_delay",
    "site_condition",
    "authority_issue",
    "logistics_issue",
    "unknown",
  ]),
  scheduleImpactDays: z.number().int().default(0),
  initialResponsibility: z.string().optional(),
});

export const updateDelaySchema = z.object({
  status: z.enum(["open", "under_review", "resolved", "escalated"]).optional(),
  scheduleImpactDays: z.number().int().optional(),
  initialResponsibility: z.string().optional(),
});

export const createRiskSchema = z.object({
  name: z.string().min(1).max(500),
  category: z.enum([
    "missing_information",
    "deadline_risk",
    "coordination_risk",
    "approval_risk",
    "execution_risk",
    "communication_risk",
    "contract_interface_risk",
    "external_authority",
  ]),
  description: z.string().optional(),
  probability: z.enum(["low", "medium", "high"]).default("medium"),
  impact: z.enum(["low", "medium", "high"]).default("medium"),
  mitigationAction: z.string().optional(),
});

export const updateRiskSchema = createRiskSchema.partial().extend({
  status: z.enum(["open", "mitigated", "closed", "accepted"]).optional(),
  ownerUserId: z.string().uuid().nullable().optional(),
});

export const createDiaryEntrySchema = z.object({
  entryDate: z.string(),
  weatherData: z
    .object({
      temperature: z.string().optional(),
      precipitation: z.string().optional(),
      wind: z.string().optional(),
    })
    .optional(),
  personnelOnSite: z
    .array(z.object({ participantId: z.string(), headcount: z.number().int().nonnegative() }))
    .default([]),
  defectsLogged: z
    .array(
      z.object({
        description: z.string(),
        severity: z.string(),
        coordinates: z.object({ x: z.number(), y: z.number(), z: z.number().optional() }),
      })
    )
    .default([]),
  photoEvidenceRefs: z.array(z.string()).default([]),
  activitiesPerformed: z.string().optional(),
});

export const updateDiaryEntrySchema = z.object({
  status: z.enum(["draft", "signed_off", "disputed"]).optional(),
  activitiesPerformed: z.string().optional(),
});

// ─── HOAI fee calculation ─────────────────────────────────────

const hoaiFeeZoneEnum = z.enum(["I", "II", "III", "IV", "V"]);
const hoaiServiceTypeEnum = z.enum([
  "gebaeudeplanung",
  "freianlagenplanung",
  "tragwerksplanung",
  "technische_ausruestung",
]);

const hoaiModifierSchema = z.object({
  key: nonEmptyTrimmed,
  label: nonEmptyTrimmed,
  factor: z.number().min(-1).max(2),
});

export const createHoaiCalculationSchema = z.object({
  serviceType: hoaiServiceTypeEnum,
  feeZone: hoaiFeeZoneEnum,
  // Cents (integer). Allow up to 100 billion EUR-cents which is well above HOAI table ceiling.
  anrechenbareKosten: z.number().int().min(0).max(10_000_000_000_00),
  feePositionInZone: z.number().int().min(0).max(100).default(50),
  commissionedPhases: z
    .array(z.number().int().min(1).max(9))
    .min(1)
    .max(9)
    .default([1, 2, 3, 4, 5, 6, 7, 8, 9]),
  modifiers: z.array(hoaiModifierSchema).max(10).default([]),
  notes: z.string().trim().max(2000).optional(),
});

export const updateHoaiCalculationSchema = createHoaiCalculationSchema.partial();

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
