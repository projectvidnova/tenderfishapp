import {
  pgTable,
  uuid,
  text,
  varchar,
  timestamp,
  boolean,
  integer,
  jsonb,
  date,
  pgEnum,
  index,
} from "drizzle-orm/pg-core";

// ─── Enums ─────────────────────────────────────────────────────

export const workspacePlanEnum = pgEnum("workspace_plan", [
  "free",
  "starter",
  "professional",
  "enterprise",
]);

export const workspaceRoleEnum = pgEnum("workspace_role", [
  "architect_admin",
  "project_lead",
  "team_member",
]);

export const projectRoleEnum = pgEnum("project_role", [
  "architect_admin",
  "project_lead",
  "team_member",
  "client",
  "client_representative",
  "consultant",
  "reviewer",
  "approver",
  "document_controller",
  "bidder",
  "general_contractor",
  "trade_contractor",
]);

export const projectTypeEnum = pgEnum("project_type", [
  "new_build",
  "refurbishment",
  "conversion",
  "interior_fit_out",
  "mixed_use",
  "not_sure",
]);

export const projectStatusEnum = pgEnum("project_status", [
  "active",
  "on_hold",
  "archived",
]);

export const projectLifecycleStateEnum = pgEnum("project_lifecycle_state", [
  "input_received",
  "parsed",
  "needs_review",
  "confirmed",
  "structure_approved",
  "cost_ready",
  "detail_ready",
  "tender_ready",
  "released_for_tender",
  "awarded",    // Bidder awarded; contracts being signed
  "execution",  // Contracts signed; site work running
  "handover",   // Abnahme scheduled or in progress
  "closed",     // All Abnahmen complete; warranty period started
]);

export const procurementModelEnum = pgEnum("procurement_model", [
  "general_contractor",
  "single_trades",
  "unclear",
]);

export const healthScoreEnum = pgEnum("health_score", ["green", "amber", "red"]);

export const dataStateEnum = pgEnum("data_state", [
  "CONFIRMED",
  "DERIVED",
  "UNCLEAR",
  "MISSING",
]);

export const phaseStatusEnum = pgEnum("phase_status", [
  "not_started",
  "active",
  "complete",
]);

export const taskStatusEnum = pgEnum("task_status", [
  "not_started",
  "in_progress",
  "complete",
]);

export const taskTypeEnum = pgEnum("task_type", [
  "required_output",
  "work_package",
  "decision",
  "document",
  "dependency",
]);

export const milestoneTypeEnum = pgEnum("milestone_type", [
  "client_decision",
  "approval",
  "phase_gate",
  "authority",
  "handover",
]);

export const decisionStatusEnum = pgEnum("decision_status", [
  "open",
  "decided",
  "overdue",
]);

export const gateLetterEnum = pgEnum("gate_letter", ["A", "B", "C", "D", "E", "F"]);

export const gateStatusEnum = pgEnum("gate_status", [
  "locked",
  "in_progress",
  "complete",
  "overridden",
]);

export const approvalTypeEnum = pgEnum("approval_type", [
  "client",
  "internal",
  "technical",
  "material",
  "package_release",
  "tender_release",
  "execution_release",
  "closeout",
]);

export const approvalStatusEnum = pgEnum("approval_status", [
  "pending",
  "in_review",
  "approved",
  "rejected",
  "overdue",
]);

export const invitationStatusEnum = pgEnum("invitation_status", [
  "not_ready",
  "ready",
  "invited",
  "accepted",
]);

export const documentStatusEnum = pgEnum("document_status", [
  "draft",
  "internally_reviewed",
  "approved_for_issue",
  "issued",
  "superseded",
  "awarded_baseline",
  "archived",
]);

export const bauvorlvDocumentCategoryEnum = pgEnum("bauvorlv_document_category", [
  "cadastral_map",
  "site_plan",
  "construction_drawings",
  "structural_proofs",
  "fire_protection_plan",
  "noise_heat_insulation",
  "other",
]);

export const delayCauseEnum = pgEnum("delay_cause", [
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
]);

export const delayStatusEnum = pgEnum("delay_status", [
  "open",
  "under_review",
  "resolved",
  "escalated",
]);

export const reviewTypeEnum = pgEnum("review_type", [
  "shop_drawing",
  "execution_evidence",
]);

export const reviewStatusEnum = pgEnum("review_status", [
  "received",
  "completeness_check",
  "assigned",
  "under_review",
  "deviation_log",
  "closed",
]);

export const reviewOutcomeEnum = pgEnum("review_outcome", [
  "approved",
  "approved_with_comments",
  "resubmission_required",
  "rejected",
]);

export const constructionDiaryStatusEnum = pgEnum("construction_diary_status", [
  "draft",
  "signed_off",
  "disputed",
]);

export const inviteStatusEnum = pgEnum("invite_status", [
  "pending",
  "accepted",
  "expired",
  "revoked",
]);

export const inboxStatusEnum = pgEnum("inbox_status", [
  "unreviewed",
  "assigned",
  "archived",
  "auto_classified",
  "low_confidence",
  "needs_role_confirmation",
  "needs_project_assignment",
]);

// ─── Tables ────────────────────────────────────────────────────

export const workspaces = pgTable("workspaces", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 255 }).notNull().unique(),
  plan: workspacePlanEnum("plan").notNull().default("free"),
  inboxEmail: varchar("inbox_email", { length: 255 }).notNull().unique(),
  logoUrl: text("logo_url"),
  street: varchar("street", { length: 255 }),
  city: varchar("city", { length: 255 }),
  postcode: varchar("postcode", { length: 20 }),
  country: varchar("country", { length: 100 }).notNull().default("Germany"),
  taxId: varchar("tax_id", { length: 100 }),
  defaultTimezone: varchar("default_timezone", { length: 100 }).notNull().default("Europe/Berlin"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id")
    .references(() => workspaces.id, { onDelete: "cascade" }),
  email: varchar("email", { length: 255 }).notNull().unique(),
  name: varchar("name", { length: 255 }).notNull(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  role: workspaceRoleEnum("role").notNull().default("team_member"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ─── Better Auth tables ────────────────────────────────────────

export const sessions = pgTable("sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  ipAddress: varchar("ip_address", { length: 255 }),
  userAgent: text("user_agent"),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
});

export const accounts = pgTable("accounts", {
  id: uuid("id").primaryKey().defaultRandom(),
  accountId: varchar("account_id", { length: 255 }).notNull(),
  providerId: varchar("provider_id", { length: 255 }).notNull(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const verifications = pgTable("verifications", {
  id: uuid("id").primaryKey().defaultRandom(),
  identifier: varchar("identifier", { length: 255 }).notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const projects = pgTable("projects", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 500 }).notNull(),
  type: projectTypeEnum("type").notNull().default("not_sure"),
  status: projectStatusEnum("status").notNull().default("active"),
  lifecycleState: projectLifecycleStateEnum("lifecycle_state").notNull().default("input_received"),
  procurementModel: procurementModelEnum("procurement_model").notNull().default("unclear"),
  targetCompletion: date("target_completion"),
  healthScore: healthScoreEnum("health_score").notNull().default("green"),
  objective: text("objective"),
  scopeSummary: text("scope_summary"),
  location: varchar("location", { length: 500 }),
  clientName: varchar("client_name", { length: 255 }),
  clientRepresentative: varchar("client_representative", { length: 255 }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("projects_workspace_id_idx").on(t.workspaceId), index("projects_status_idx").on(t.status), index("projects_lifecycle_state_idx").on(t.lifecycleState)]);

export const projectFacts = pgTable("project_facts", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  fieldName: varchar("field_name", { length: 255 }).notNull(),
  value: text("value"),
  dataState: dataStateEnum("data_state").notNull().default("MISSING"),
  sourceRef: text("source_ref"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const phases = pgTable("phases", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  lph: integer("lph").notNull(),
  status: phaseStatusEnum("status").notNull().default("not_started"),
  startDate: date("start_date"),
  endDate: date("end_date"),
  dateDataState: dataStateEnum("date_data_state").notNull().default("MISSING"),
  objective: text("objective").notNull(),
});

export const tasks = pgTable("tasks", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  phaseId: uuid("phase_id")
    .notNull()
    .references(() => phases.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 500 }).notNull(),
  description: text("description"),
  type: taskTypeEnum("type").notNull().default("work_package"),
  ownerUserId: uuid("owner_user_id").references(() => users.id),
  reviewerUserId: uuid("reviewer_user_id").references(() => users.id),
  approverUserId: uuid("approver_user_id").references(() => users.id),
  dueDate: date("due_date"),
  status: taskStatusEnum("status").notNull().default("not_started"),
  dependencies: jsonb("dependencies").$type<string[]>().default([]),
  evidenceRef: text("evidence_ref"),
  evidenceRequired: boolean("evidence_required").notNull().default(false),
  decisionMaker: varchar("decision_maker", { length: 255 }),
  decisionStatus: decisionStatusEnum("decision_status"),
  decisionNotes: text("decision_notes"),
  documentType: varchar("document_type", { length: 255 }),
  documentRequiredFor: varchar("document_required_for", { length: 500 }),
  documentFileRef: text("document_file_ref"),
  raciResponsible: varchar("raci_responsible", { length: 255 }),
  raciAccountable: varchar("raci_accountable", { length: 255 }),
  raciConsulted: jsonb("raci_consulted").$type<string[]>().default([]),
  raciInformed: jsonb("raci_informed").$type<string[]>().default([]),
}, (t) => [index("tasks_project_id_idx").on(t.projectId), index("tasks_phase_id_idx").on(t.phaseId), index("tasks_status_idx").on(t.status), index("tasks_due_date_idx").on(t.dueDate)]);

export const milestones = pgTable("milestones", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 500 }).notNull(),
  date: date("date").notNull(),
  type: milestoneTypeEnum("type").notNull(),
  ownerUserId: uuid("owner_user_id").references(() => users.id),
  relatedGate: varchar("related_gate", { length: 1 }),
  relatedPhaseId: uuid("related_phase_id").references(() => phases.id),
  dataState: dataStateEnum("data_state").notNull().default("DERIVED"),
  status: taskStatusEnum("status").notNull().default("not_started"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * One row in `gates.criteria` (JSONB array): a **read-only snapshot** of automated compliance state.
 * The `met` flag is derived exclusively by the server-side gate evaluator from `project_facts` and
 * document intake — never set or edited by clients. (Formal gate bypass uses `status = overridden`
 * and override columns, not manual criterion toggles.)
 */
export type GateCriterionStateSnapshot = {
  key: string;
  label: string;
  met: boolean;
  autoCheck: boolean;
};

/**
 * Compliance gates A–F. The `criteria` column stores evaluator output only (see {@link GateCriterionStateSnapshot}).
 */
export const gates = pgTable("gates", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  gate: gateLetterEnum("gate").notNull(),
  status: gateStatusEnum("status").notNull().default("locked"),
  criteria: jsonb("criteria")
    .$type<GateCriterionStateSnapshot[]>()
    .notNull()
    .default([]),
  overrideActive: boolean("override_active").notNull().default(false),
  overrideReason: text("override_reason"),
  overrideBy: uuid("override_by").references(() => users.id),
  overrideAt: timestamp("override_at", { withTimezone: true }),
});

export const consultants = pgTable("consultants", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  discipline: varchar("discipline", { length: 255 }).notNull(),
  contactName: varchar("contact_name", { length: 255 }),
  company: varchar("company", { length: 255 }),
  email: varchar("email", { length: 255 }),
  readinessCriteria: jsonb("readiness_criteria")
    .$type<{ key: string; label: string; met: boolean }[]>()
    .notNull()
    .default([]),
  invitationStatus: invitationStatusEnum("invitation_status").notNull().default("not_ready"),
  invitedAt: timestamp("invited_at", { withTimezone: true }),
  invitedBy: uuid("invited_by").references(() => users.id),
});

export const tenderPackages = pgTable("tender_packages", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 500 }).notNull(),
  description: text("description"),
  scope: text("scope"),
  procurementModel: procurementModelEnum("procurement_model").notNull().default("unclear"),
  leadUserId: uuid("lead_user_id").references(() => users.id),
  targetTenderDate: date("target_tender_date"),
  readinessScore: integer("readiness_score").notNull().default(0),
  tenderReady: boolean("tender_ready").notNull().default(false),
  invitationEnabled: boolean("invitation_enabled").notNull().default(false),
  blockers: jsonb("blockers")
    .$type<{ description: string; gateRef?: string; resolved: boolean }[]>()
    .notNull()
    .default([]),
});

export const documents = pgTable("documents", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 500 }).notNull(),
  type: varchar("type", { length: 100 }).notNull(),
  versions: jsonb("versions")
    .$type<
      {
        version: number;
        date: string;
        uploadedBy: string;
        status: string;
        changesNote?: string;
        filePath: string;
      }[]
    >()
    .notNull()
    .default([]),
  currentVersion: integer("current_version").notNull().default(1),
  status: documentStatusEnum("status").notNull().default("draft"),
  isApprovedResource: boolean("is_approved_resource").notNull().default(false),
  approvedResourceAt: timestamp("approved_resource_at", { withTimezone: true }),
  approvedResourceBy: uuid("approved_resource_by").references(() => users.id),
  sourceChannel: varchar("source_channel", { length: 100 }),
  confidence: integer("confidence"), // 0-100
  provenanceData: jsonb("provenance_data").$type<{
    source?: string;
    sender?: string;
    timestamp?: string;
    rawRef?: string;
    transformationHistory?: string[];
  }>(),
  createdBy: uuid("created_by").references(() => users.id),
  relatedPhaseId: uuid("related_phase_id").references(() => phases.id),
  relatedPackageId: uuid("related_package_id").references(() => tenderPackages.id),
  bauvorlvCategory: bauvorlvDocumentCategoryEnum("bauvorlv_category"),
  documentDate: date("document_date"),
  scaleMetric: varchar("scale_metric", { length: 50 }),
  hasCertifiedSignature: boolean("has_certified_signature"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("documents_project_id_idx").on(t.projectId), index("documents_status_idx").on(t.status)]);

// ─── Risks ────────────────────────────────────────────────────

export const riskCategoryEnum = pgEnum("risk_category", [
  "missing_information",
  "deadline_risk",
  "coordination_risk",
  "approval_risk",
  "execution_risk",
  "communication_risk",
  "contract_interface_risk",
  "external_authority",
]);

export const riskStatusEnum = pgEnum("risk_status", [
  "open",
  "mitigated",
  "closed",
  "accepted",
]);

export const riskLevelEnum = pgEnum("risk_level", ["low", "medium", "high"]);

export const risks = pgTable("risks", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 500 }).notNull(),
  category: riskCategoryEnum("category").notNull(),
  description: text("description"),
  probability: riskLevelEnum("probability").notNull().default("medium"),
  impact: riskLevelEnum("impact").notNull().default("medium"),
  ownerUserId: uuid("owner_user_id").references(() => users.id),
  status: riskStatusEnum("status").notNull().default("open"),
  mitigationAction: text("mitigation_action"),
  linkedDocuments: jsonb("linked_documents").$type<string[]>().default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const approvals = pgTable("approvals", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 500 }).notNull(),
  type: approvalTypeEnum("type").notNull(),
  status: approvalStatusEnum("status").notNull().default("pending"),
  requestedBy: uuid("requested_by")
    .notNull()
    .references(() => users.id),
  approverUserId: uuid("approver_user_id").references(() => users.id),
  dueDate: date("due_date"),
  approvedAt: timestamp("approved_at", { withTimezone: true }),
  notes: text("notes"),
  relatedGate: varchar("related_gate", { length: 1 }),
  relatedPhaseId: uuid("related_phase_id").references(() => phases.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("approvals_project_id_idx").on(t.projectId), index("approvals_status_idx").on(t.status), index("approvals_due_date_idx").on(t.dueDate)]);

export const delayEvents = pgTable("delay_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  eventDate: date("event_date").notNull(),
  reportedBy: varchar("reported_by", { length: 255 }).notNull(),
  description: text("description").notNull(),
  causeCategory: delayCauseEnum("cause_category").notNull(),
  affectedTasks: jsonb("affected_tasks").$type<string[]>().default([]),
  evidenceRefs: jsonb("evidence_refs").$type<string[]>().default([]),
  scheduleImpactDays: integer("schedule_impact_days").notNull().default(0),
  initialResponsibility: text("initial_responsibility"),
  status: delayStatusEnum("status").notNull().default("open"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const reviewSubmissions = pgTable("review_submissions", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  title: varchar("title", { length: 500 }).notNull(),
  type: reviewTypeEnum("type").notNull(),
  packageName: varchar("package_name", { length: 255 }),
  contractor: varchar("contractor", { length: 255 }),
  submittedBy: varchar("submitted_by", { length: 255 }).notNull(),
  submissionDate: date("submission_date").notNull(),
  status: reviewStatusEnum("status").notNull().default("received"),
  deviations: jsonb("deviations")
    .$type<
      {
        itemNo: number;
        description: string;
        severity: string;
        designImpact: string;
        technicalImpact: string;
        scheduleImpact: string;
        status: string;
        resolutionNotes?: string;
      }[]
    >()
    .notNull()
    .default([]),
  reviewerId: uuid("reviewer_id").references(() => users.id),
  reviewDueDate: date("review_due_date"),
  reviewOutcome: reviewOutcomeEnum("review_outcome"),
  reviewComment: text("review_comment"),
  reviewDate: timestamp("review_date", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("review_submissions_project_id_idx").on(t.projectId), index("review_submissions_status_idx").on(t.status)]);

export const invitations = pgTable("invitations", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  projectId: uuid("project_id").references(() => projects.id, { onDelete: "cascade" }),
  email: varchar("email", { length: 255 }).notNull(),
  role: projectRoleEnum("role").notNull(),
  gateAtInvitation: varchar("gate_at_invitation", { length: 1 }),
  invitedBy: uuid("invited_by")
    .notNull()
    .references(() => users.id),
  status: inviteStatusEnum("status").notNull().default("pending"),
  token: varchar("token", { length: 255 }).notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  acceptedAt: timestamp("accepted_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const auditLogs = pgTable("audit_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  projectId: uuid("project_id").references(() => projects.id, { onDelete: "set null" }),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id),
  action: varchar("action", { length: 255 }).notNull(),
  entityType: varchar("entity_type", { length: 100 }).notNull(),
  entityId: uuid("entity_id").notNull(),
  beforeState: jsonb("before_state").$type<Record<string, unknown>>(),
  afterState: jsonb("after_state").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("audit_logs_workspace_id_idx").on(t.workspaceId), index("audit_logs_project_id_idx").on(t.projectId), index("audit_logs_user_id_idx").on(t.userId), index("audit_logs_action_idx").on(t.action)]);

export const inboxMessages = pgTable("inbox_messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  projectId: uuid("project_id").references(() => projects.id, { onDelete: "set null" }),
  fromEmail: varchar("from_email", { length: 255 }).notNull(),
  subject: varchar("subject", { length: 1000 }).notNull(),
  body: text("body").notNull(),
  attachments: jsonb("attachments")
    .$type<{ name: string; contentType: string; size: number; storagePath: string }[]>()
    .notNull()
    .default([]),
  aiSuggestions: jsonb("ai_suggestions").$type<{
    suggestedProjectId?: string;
    suggestedProjectName?: string;
    confidence?: number;
    documentType?: string;
    signals: string[];
  }>(),
  status: inboxStatusEnum("status").notNull().default("unreviewed"),
  confidence: integer("confidence"), // 0-100
  classifiedType: varchar("classified_type", { length: 100 }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("inbox_messages_workspace_id_idx").on(t.workspaceId), index("inbox_messages_status_idx").on(t.status)]);

// ─── Notifications ────────────────────────────────────────────

export const notificationTypeEnum = pgEnum("notification_type", [
  "gate_blocked",
  "approval_overdue",
  "approval_requested",
  "consultant_invitation_ready",
  "tender_package_ready",
  "gate_override",
  "review_submission_received",
  "review_overdue",
  "inbox_unreviewed",
  "general",
]);

export const notifications = pgTable("notifications", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  projectId: uuid("project_id").references(() => projects.id, { onDelete: "set null" }),
  type: notificationTypeEnum("type").notNull(),
  title: varchar("title", { length: 500 }).notNull(),
  body: text("body"),
  entityType: varchar("entity_type", { length: 100 }),
  entityId: uuid("entity_id"),
  read: boolean("read").notNull().default(false),
  emailSent: boolean("email_sent").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("notifications_user_id_idx").on(t.userId), index("notifications_read_idx").on(t.read)]);

// ─── Bidders (for tender package bid tracking) ────────────────

export const bidderStatusEnum = pgEnum("bidder_status", [
  "invited",
  "pending",
  "returned",
  "late",
  "withdrawn",
  "awarded",
]);

export const bidders = pgTable("bidders", {
  id: uuid("id").primaryKey().defaultRandom(),
  packageId: uuid("package_id")
    .notNull()
    .references(() => tenderPackages.id, { onDelete: "cascade" }),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  company: varchar("company", { length: 255 }).notNull(),
  contactName: varchar("contact_name", { length: 255 }),
  email: varchar("email", { length: 255 }),
  invitedAt: timestamp("invited_at", { withTimezone: true }).notNull().defaultNow(),
  returnDue: date("return_due"),
  status: bidderStatusEnum("status").notNull().default("invited"),
  offerAmount: integer("offer_amount"), // in cents
  offerNotes: text("offer_notes"),
  craftsRegisterValid: boolean("crafts_register_valid"),
  a1CertificateValid: boolean("a1_certificate_valid"),
  pqVereinStatus: boolean("pq_verein_status"),
  complianceExpiryDate: date("compliance_expiry_date"),
  returnedAt: timestamp("returned_at", { withTimezone: true }),
  awardedAt: timestamp("awarded_at", { withTimezone: true }),
  awardedBy: uuid("awarded_by").references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ─── Jobs (for AI pipeline tracking) ──────────────────────────

export const jobStatusEnum = pgEnum("job_status", [
  "pending",
  "processing",
  "complete",
  "failed",
]);

export const jobs = pgTable("jobs", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  projectId: uuid("project_id").references(() => projects.id, { onDelete: "set null" }),
  type: varchar("type", { length: 100 }).notNull(),
  status: jobStatusEnum("status").notNull().default("pending"),
  currentStep: varchar("current_step", { length: 100 }),
  steps: jsonb("steps")
    .$type<{ key: string; label: string; status: string }[]>()
    .notNull()
    .default([]),
  result: jsonb("result").$type<Record<string, unknown>>(),
  error: text("error"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ═══════════════════════════════════════════════════════════════
// DIN 276 — COST MANAGEMENT
// ═══════════════════════════════════════════════════════════════

export const costStageEnum = pgEnum("cost_stage", [
  "kostenrahmen",
  "kostenschaetzung",
  "kostenberechnung",
  "kostenanschlag",
  "kostenfeststellung",
]);

export const costSnapshotStatusEnum = pgEnum("cost_snapshot_status", [
  "draft",
  "submitted",
  "approved",
  "superseded",
]);

/**
 * Cost snapshots — captures the full cost picture at a given HOAI phase / cost stage.
 * Each snapshot is an immutable record; new snapshots supersede old ones.
 */
export const costSnapshots = pgTable("cost_snapshots", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  costStage: costStageEnum("cost_stage").notNull(),
  phaseId: uuid("phase_id").references(() => phases.id),
  snapshotDate: date("snapshot_date").notNull(),
  totalGross: integer("total_gross").notNull().default(0), // cents
  totalNet: integer("total_net").notNull().default(0), // cents
  vatRate: integer("vat_rate").notNull().default(1900), // basis points (19% = 1900)
  currency: varchar("currency", { length: 3 }).notNull().default("EUR"),
  notes: text("notes"),
  status: costSnapshotStatusEnum("status").notNull().default("draft"),
  approvedBy: uuid("approved_by").references(() => users.id),
  approvedAt: timestamp("approved_at", { withTimezone: true }),
  createdBy: uuid("created_by").references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("cost_snapshots_project_id_idx").on(t.projectId), index("cost_snapshots_stage_idx").on(t.costStage)]);

/**
 * Cost line items — DIN 276 cost group entries within a snapshot.
 * Each line maps to a DIN 276 Kostengruppe at level 1, 2, or 3.
 */
export const costLineItems = pgTable("cost_line_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  snapshotId: uuid("snapshot_id")
    .notNull()
    .references(() => costSnapshots.id, { onDelete: "cascade" }),
  costGroupCode: varchar("cost_group_code", { length: 10 }).notNull(), // DIN 276 code, e.g. "300", "330", "331"
  costGroupLevel: integer("cost_group_level").notNull(), // 1, 2, or 3
  description: text("description"),
  amountNet: integer("amount_net").notNull().default(0), // cents
  amountGross: integer("amount_gross").notNull().default(0), // cents
  quantity: integer("quantity"), // optional — for detailed items
  unit: varchar("unit", { length: 50 }), // m², m³, Stk, psch, etc.
  unitPrice: integer("unit_price"), // cents per unit
  source: varchar("source", { length: 255 }), // e.g. "tender_return", "estimate", "actual_invoice"
  dataState: dataStateEnum("data_state").notNull().default("DERIVED"),
  din276Confidence: integer("din276_confidence"), // 0..100, nullable
  din276Source: varchar("din276_source", { length: 16 }), // 'ai' | 'manual' | 'rule'
  din276Rationale: text("din276_rationale"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("cost_line_items_snapshot_id_idx").on(t.snapshotId), index("cost_line_items_cost_group_idx").on(t.costGroupCode)]);

/**
 * Cost benchmarks — reference values for cost estimation per KG and project type.
 * Used by AI pipeline to generate Kostenrahmen / Kostenschätzung.
 */
export const costBenchmarks = pgTable("cost_benchmarks", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  costGroupCode: varchar("cost_group_code", { length: 10 }).notNull(),
  projectType: projectTypeEnum("project_type"),
  region: varchar("region", { length: 255 }),
  pricePerUnit: integer("price_per_unit").notNull(), // cents
  unit: varchar("unit", { length: 50 }).notNull(), // e.g. "€/m² BGF"
  referenceYear: integer("reference_year").notNull(),
  source: varchar("source", { length: 255 }),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ═══════════════════════════════════════════════════════════════
// HOAI — FEE CALCULATION
// ═══════════════════════════════════════════════════════════════

export const hoaiFeeZoneEnum = pgEnum("hoai_fee_zone", ["I", "II", "III", "IV", "V"]);

export const hoaiServiceTypeEnum = pgEnum("hoai_service_type", [
  "gebaeudeplanung",
  "freianlagenplanung",
  "tragwerksplanung",
  "technische_ausruestung",
]);

/**
 * HOAI fee calculations — stores the fee calculation for a project or discipline.
 * Based on HOAI 2021 orientation values.
 */
export const hoaiFeeCalculations = pgTable("hoai_fee_calculations", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  serviceType: hoaiServiceTypeEnum("service_type").notNull(),
  feeZone: hoaiFeeZoneEnum("fee_zone").notNull(),
  anrechenbareKosten: integer("anrechenbare_kosten").notNull(), // cents — eligible costs (KG 300+400 typically)
  feePositionInZone: integer("fee_position_in_zone").notNull().default(50), // 0=min, 100=max within zone (percentage)
  baseFee: integer("base_fee").notNull().default(0), // cents — calculated total base fee
  agreedPercentage: integer("agreed_percentage"), // basis points — optional agreed % if deviating from table
  commissionedPhases: jsonb("commissioned_phases").$type<number[]>().notNull().default([1, 2, 3, 4, 5, 6, 7, 8, 9]),
  phaseFees: jsonb("phase_fees").$type<{ lph: number; percentage: number; fee: number }[]>().notNull().default([]),
  modifiers: jsonb("modifiers").$type<{ key: string; label: string; factor: number }[]>().default([]),
  totalFee: integer("total_fee").notNull().default(0), // cents
  notes: text("notes"),
  calculatedAt: timestamp("calculated_at", { withTimezone: true }).notNull().defaultNow(),
  createdBy: uuid("created_by").references(() => users.id),
});

// ═══════════════════════════════════════════════════════════════
// VOB — CONTRACT MANAGEMENT
// ═══════════════════════════════════════════════════════════════

export const vobTenderingProcedureEnum = pgEnum("vob_tendering_procedure", [
  "oeffentliche_ausschreibung",
  "beschraenkte_ausschreibung",
  "beschraenkte_ausschreibung_mit_tw",
  "verhandlungsvergabe",
  "verhandlungsvergabe_mit_tw",
  "wettbewerblicher_dialog",
  "direktauftrag",
]);

export const vobContractTypeEnum = pgEnum("vob_contract_type", [
  "vob_b",
  "bgb_werkvertrag",
]);

export const contractStatusEnum = pgEnum("contract_status", [
  "draft",
  "tendered",
  "awarded",
  "active",
  "in_warranty",
  "closed",
  "terminated",
]);

/**
 * VOB-compliant construction contracts — tracks each trade/package contract.
 */
export const contracts = pgTable("contracts", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  packageId: uuid("package_id").references(() => tenderPackages.id),
  contractNumber: varchar("contract_number", { length: 100 }),
  title: varchar("title", { length: 500 }).notNull(),
  contractType: vobContractTypeEnum("contract_type").notNull().default("vob_b"),
  tenderingProcedure: vobTenderingProcedureEnum("tendering_procedure"),
  contractorCompany: varchar("contractor_company", { length: 255 }).notNull(),
  contractorContact: varchar("contractor_contact", { length: 255 }),
  contractorEmail: varchar("contractor_email", { length: 255 }),
  awardDate: date("award_date"),
  commencementDate: date("commencement_date"),
  completionDate: date("completion_date"),
  abnahmeDate: date("abnahme_date"), // formal acceptance date
  warrantyEndDate: date("warranty_end_date"),
  warrantyPeriodMonths: integer("warranty_period_months").notNull().default(48), // 4 years VOB/B default
  contractValueNet: integer("contract_value_net").notNull().default(0), // cents
  contractValueGross: integer("contract_value_gross").notNull().default(0), // cents
  retentionPercentage: integer("retention_percentage").notNull().default(500), // basis points (5% = 500)
  retentionAmount: integer("retention_amount").notNull().default(0), // cents
  status: contractStatusEnum("status").notNull().default("draft"),
  vobCReference: varchar("vob_c_reference", { length: 100 }), // e.g. "DIN 18331" for concrete
  costGroupCode: varchar("cost_group_code", { length: 10 }), // DIN 276 mapping
  notes: text("notes"),
  createdBy: uuid("created_by").references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("contracts_project_id_idx").on(t.projectId), index("contracts_status_idx").on(t.status)]);

/**
 * VOB/B Nachträge (variation/change orders)
 */
export const nachtragStatusEnum = pgEnum("nachtrag_status", [
  "draft",
  "submitted",
  "under_review",
  "approved",
  "rejected",
  "partially_approved",
]);

export const nachtragTypeEnum = pgEnum("nachtrag_type", [
  "mengenabweichung",
  "geaenderte_leistung",
  "zusaetzliche_leistung",
  "selbst_uebernahme",
  "behinderung",
  "stundenlohn",
]);

export const nachtraege = pgTable("nachtraege", {
  id: uuid("id").primaryKey().defaultRandom(),
  contractId: uuid("contract_id")
    .notNull()
    .references(() => contracts.id, { onDelete: "cascade" }),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  nachtragNumber: varchar("nachtrag_number", { length: 50 }).notNull(), // e.g. "NT-001"
  title: varchar("title", { length: 500 }).notNull(),
  type: nachtragTypeEnum("type").notNull(),
  vobReference: varchar("vob_reference", { length: 100 }), // e.g. "§2 Abs. 5 VOB/B"
  description: text("description").notNull(),
  requestedAmountNet: integer("requested_amount_net").notNull().default(0), // cents
  approvedAmountNet: integer("approved_amount_net"), // cents — set after review
  scheduleImpactDays: integer("schedule_impact_days").notNull().default(0),
  submittedBy: varchar("submitted_by", { length: 255 }).notNull(),
  submittedAt: timestamp("submitted_at", { withTimezone: true }).notNull().defaultNow(),
  reviewedBy: uuid("reviewed_by").references(() => users.id),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  status: nachtragStatusEnum("status").notNull().default("draft"),
  supportingDocuments: jsonb("supporting_documents").$type<string[]>().default([]),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("nachtraege_contract_id_idx").on(t.contractId), index("nachtraege_project_id_idx").on(t.projectId), index("nachtraege_status_idx").on(t.status)]);

/**
 * VOB/B payment tracking — Abschlagszahlungen, Schlussrechnung
 */
export const paymentTypeEnum = pgEnum("payment_type", [
  "abschlagszahlung",
  "teilschlussrechnung",
  "schlussrechnung",
  "sicherheitseinbehalt",
]);

export const paymentStatusEnum = pgEnum("payment_status", [
  "submitted",
  "under_review",
  "approved",
  "paid",
  "disputed",
]);

export const payments = pgTable("payments", {
  id: uuid("id").primaryKey().defaultRandom(),
  contractId: uuid("contract_id")
    .notNull()
    .references(() => contracts.id, { onDelete: "cascade" }),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  paymentNumber: varchar("payment_number", { length: 50 }).notNull(),
  type: paymentTypeEnum("type").notNull(),
  invoiceDate: date("invoice_date").notNull(),
  invoiceRef: varchar("invoice_ref", { length: 255 }),
  amountNet: integer("amount_net").notNull(), // cents
  amountGross: integer("amount_gross").notNull(), // cents
  vatRate: integer("vat_rate").notNull().default(1900), // basis points
  cumulativeNet: integer("cumulative_net").notNull().default(0), // running total
  retentionDeducted: integer("retention_deducted").notNull().default(0), // cents
  dueDate: date("due_date"),
  paidDate: date("paid_date"),
  status: paymentStatusEnum("status").notNull().default("submitted"),
  reviewedBy: uuid("reviewed_by").references(() => users.id),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("payments_contract_id_idx").on(t.contractId), index("payments_project_id_idx").on(t.projectId)]);

/**
 * VOB/B Abnahme (formal acceptance) records
 */
export const abnahmeTypeEnum = pgEnum("abnahme_type", [
  "foermliche_abnahme",    // Formal acceptance §12 Abs. 4 VOB/B
  "stillschweigende_abnahme", // Implied acceptance §12 Abs. 5 VOB/B
  "teilabnahme",           // Partial acceptance §12 Abs. 2 VOB/B
  "fiktive_abnahme",       // Deemed acceptance after 12 working days
]);

export const abnahmeStatusEnum = pgEnum("abnahme_status", [
  "scheduled",
  "completed_without_defects",
  "completed_with_defects",
  "refused",
]);

export const abnahmen = pgTable("abnahmen", {
  id: uuid("id").primaryKey().defaultRandom(),
  contractId: uuid("contract_id")
    .notNull()
    .references(() => contracts.id, { onDelete: "cascade" }),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  type: abnahmeTypeEnum("type").notNull(),
  scheduledDate: date("scheduled_date").notNull(),
  actualDate: date("actual_date"),
  status: abnahmeStatusEnum("status").notNull().default("scheduled"),
  attendees: jsonb("attendees").$type<{ name: string; role: string; company: string }[]>().default([]),
  defects: jsonb("defects").$type<{ description: string; severity: string; deadline: string; resolved: boolean }[]>().default([]),
  warrantyStartDate: date("warranty_start_date"), // Gewährleistung starts at Abnahme
  protocolRef: text("protocol_ref"), // reference to signed acceptance protocol document
  notes: text("notes"),
  createdBy: uuid("created_by").references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("abnahmen_contract_id_idx").on(t.contractId), index("abnahmen_project_id_idx").on(t.projectId)]);

// ═══════════════════════════════════════════════════════════════
// GAEB — BILL OF QUANTITIES (Leistungsverzeichnis)
// ═══════════════════════════════════════════════════════════════

export const gaebExchangePhaseEnum = pgEnum("gaeb_exchange_phase", [
  "gaeb_81",
  "gaeb_82",
  "gaeb_83",
  "gaeb_84",
  "gaeb_85",
  "gaeb_86",
  "gaeb_87",
  "gaeb_89",
  "gaeb_90",
  "gaeb_da11",
]);

export const gaebPositionTypeEnum = pgEnum("gaeb_position_type", [
  "normalposition",
  "alternativposition",
  "eventuaposition",
  "bedarfsposition",
  "grundposition",
  "wahlposition",
  "zuschlagsposition",
  "pauschalposition",
  "stundenlohnarbeiten",
]);

/**
 * Leistungsverzeichnisse (Bills of Quantities) — GAEB-structured BoQ documents.
 */
export const leistungsverzeichnisse = pgTable("leistungsverzeichnisse", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  packageId: uuid("package_id").references(() => tenderPackages.id),
  contractId: uuid("contract_id").references(() => contracts.id),
  title: varchar("title", { length: 500 }).notNull(),
  lvNumber: varchar("lv_number", { length: 100 }), // e.g. "LV-01 Rohbau"
  exchangePhase: gaebExchangePhaseEnum("exchange_phase").notNull().default("gaeb_83"),
  costGroupCode: varchar("cost_group_code", { length: 10 }), // DIN 276 mapping
  vobCReference: varchar("vob_c_reference", { length: 100 }), // e.g. "DIN 18331"
  totalNet: integer("total_net").notNull().default(0), // cents
  totalGross: integer("total_gross").notNull().default(0), // cents
  positionCount: integer("position_count").notNull().default(0),
  gaebFileRef: text("gaeb_file_ref"), // GCS path to original GAEB file
  gaebVersion: varchar("gaeb_version", { length: 20 }), // e.g. "GAEB XML 3.3"
  parentLvId: uuid("parent_lv_id"), // for X84 corrected bids — points at the LV being superseded
  version: integer("version").notNull().default(1),
  notes: text("notes"),
  createdBy: uuid("created_by").references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("lv_project_id_idx").on(t.projectId), index("lv_parent_id_idx").on(t.parentLvId)]);

/**
 * LV Positionen (BoQ line items) — individual positions within a Leistungsverzeichnis.
 */
export const lvPositionen = pgTable("lv_positionen", {
  id: uuid("id").primaryKey().defaultRandom(),
  lvId: uuid("lv_id")
    .notNull()
    .references(() => leistungsverzeichnisse.id, { onDelete: "cascade" }),
  ordnungszahl: varchar("ordnungszahl", { length: 50 }).notNull(), // position number, e.g. "01.02.003"
  titel: varchar("titel", { length: 500 }), // section/title grouping
  titelLevel: integer("titel_level").notNull().default(0), // 0 = position, 1+ = title nesting level
  positionType: gaebPositionTypeEnum("position_type").notNull().default("normalposition"),
  kurztext: varchar("kurztext", { length: 500 }).notNull(), // short description
  langtext: text("langtext"), // full specification text
  menge: integer("menge").notNull().default(0), // quantity (in minor units × 1000 for precision)
  einheit: varchar("einheit", { length: 50 }).notNull(), // unit: m², m³, Stk, kg, psch, etc.
  einheitspreis: integer("einheitspreis").notNull().default(0), // unit price in cents
  gesamtpreis: integer("gesamtpreis").notNull().default(0), // total price = menge × einheitspreis (in cents)
  costGroupCode: varchar("cost_group_code", { length: 10 }), // DIN 276 mapping at position level
  din276Confidence: integer("din276_confidence"), // 0..100, nullable
  din276Source: varchar("din276_source", { length: 16 }), // 'ai' | 'manual' | 'rule'
  din276Rationale: text("din276_rationale"),
  linkedPositionId: uuid("linked_position_id"), // for alternative/optional links
  notes: text("notes"),
}, (t) => [index("lv_positionen_lv_id_idx").on(t.lvId)]);

/**
 * GAEB file exchange log — tracks import/export of GAEB files.
 */
export const gaebExchangeLog = pgTable("gaeb_exchange_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  lvId: uuid("lv_id").references(() => leistungsverzeichnisse.id),
  direction: varchar("direction", { length: 10 }).notNull(), // "import" | "export"
  exchangePhase: gaebExchangePhaseEnum("exchange_phase").notNull(),
  fileName: varchar("file_name", { length: 500 }).notNull(),
  fileRef: text("file_ref").notNull(), // GCS storage path
  fileSize: integer("file_size").notNull(),
  gaebVersion: varchar("gaeb_version", { length: 20 }),
  positionsImported: integer("positions_imported"),
  errorLog: text("error_log"),
  importedBy: uuid("imported_by").references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ═══════════════════════════════════════════════════════════════
// REGULATORY COMPLIANCE TRACKING
// ═══════════════════════════════════════════════════════════════

export const complianceAreaEnum = pgEnum("compliance_area", [
  "bauordnung",
  "brandschutz",
  "geg_energy",
  "sigeko",
  "denkmalschutz",
  "umweltschutz",
  "schallschutz",
  "barrierefreiheit",
]);

export const complianceStatusEnum = pgEnum("compliance_status", [
  "not_applicable",
  "not_started",
  "in_preparation",
  "submitted",
  "approved",
  "conditionally_approved",
  "rejected",
  "expired",
]);

export const regulatorySubmissions = pgTable("regulatory_submissions", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  area: complianceAreaEnum("area").notNull(),
  submissionType: varchar("submission_type", { length: 255 }).notNull(), // e.g. "bauantrag", "brandschutzkonzept"
  title: varchar("title", { length: 500 }).notNull(),
  authority: varchar("authority", { length: 255 }), // e.g. "Bauaufsichtsbehörde Berlin-Mitte"
  referenceNumber: varchar("reference_number", { length: 255 }), // authority file number
  submittedDate: date("submitted_date"),
  expectedResponseDate: date("expected_response_date"),
  approvedDate: date("approved_date"),
  expiryDate: date("expiry_date"),
  status: complianceStatusEnum("status").notNull().default("not_started"),
  conditions: jsonb("conditions").$type<{ condition: string; met: boolean; deadline?: string }[]>().default([]),
  relatedPhaseId: uuid("related_phase_id").references(() => phases.id),
  documentRef: text("document_ref"), // GCS path
  responsibleUserId: uuid("responsible_user_id").references(() => users.id),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("regulatory_submissions_project_id_idx").on(t.projectId), index("regulatory_submissions_area_idx").on(t.area), index("regulatory_submissions_status_idx").on(t.status)]);

export const constructionDiaryEntries = pgTable("construction_diary_entries", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  entryDate: date("entry_date").notNull(),
  weatherData: jsonb("weather_data").$type<{
    temperature?: string;
    precipitation?: string;
    wind?: string;
  }>(),
  personnelOnSite: jsonb("personnel_on_site").$type<{
    participantId: string;
    headcount: number;
  }[]>().default([]),
  defectsLogged: jsonb("defects_logged").$type<{
    description: string;
    severity: string;
    coordinates: {
      x: number;
      y: number;
      z?: number;
    };
  }[]>().default([]),
  photoEvidenceRefs: jsonb("photo_evidence_refs").$type<string[]>().default([]),
  activitiesPerformed: text("activities_performed"),
  status: constructionDiaryStatusEnum("status").notNull().default("draft"),
  signedOffBy: uuid("signed_off_by").references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("construction_diary_entries_project_id_idx").on(t.projectId), index("construction_diary_entries_entry_date_idx").on(t.entryDate), index("construction_diary_entries_status_idx").on(t.status)]);

// ═══════════════════════════════════════════════════════════════
// STRUCTURED PROJECT DESCRIPTION (SPD)
// ═══════════════════════════════════════════════════════════════

export const spdStatusEnum = pgEnum("spd_status", [
  "draft",
  "submitted",
  "approved",
  "revision_requested",
]);

/**
 * Structured Project Description — first-class entity with 13 mandatory fields.
 * Derived from project facts, approved by architect/lead.
 */
export const projectDescriptions = pgTable("project_descriptions", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  version: integer("version").notNull().default(1),
  status: spdStatusEnum("status").notNull().default("draft"),
  // ─── 13 Mandatory Fields ───────────────────────────────
  projectName: varchar("project_name", { length: 500 }),
  projectGoal: text("project_goal"),
  projectType: varchar("project_type", { length: 100 }),
  location: text("location"),
  participants: jsonb("participants").$type<{ name: string; role: string; company?: string; email?: string }[]>().default([]),
  scopeOfWork: text("scope_of_work"),
  spatialScope: text("spatial_scope"),
  relevantApprovedDocuments: jsonb("relevant_approved_documents").$type<string[]>().default([]), // document IDs
  assumptions: jsonb("assumptions").$type<string[]>().default([]),
  openPoints: jsonb("open_points").$type<{ point: string; priority: string; assignedTo?: string }[]>().default([]),
  currentProjectPhase: varchar("current_project_phase", { length: 100 }),
  approvedProjectResources: jsonb("approved_project_resources").$type<string[]>().default([]), // document IDs
  currentDefinedProjectStatus: text("current_defined_project_status"),
  // ─── Approval ──────────────────────────────────────────
  approvedBy: uuid("approved_by").references(() => users.id),
  approvedAt: timestamp("approved_at", { withTimezone: true }),
  createdBy: uuid("created_by").references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("project_descriptions_project_id_idx").on(t.projectId)]);

// ═══════════════════════════════════════════════════════════════
// TENDER RELEASE STATE
// ═══════════════════════════════════════════════════════════════

export const tenderReleaseStatusEnum = pgEnum("tender_release_status", [
  "pending_review",
  "ready",
  "released",
  "recalled",
]);

/**
 * Tender Release State — explicit end-state object for formal tender release.
 * Cannot exist without approval prerequisites being met.
 */
export const tenderReleases = pgTable("tender_releases", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  status: tenderReleaseStatusEnum("status").notNull().default("pending_review"),
  prerequisites: jsonb("prerequisites")
    .$type<{ key: string; label: string; met: boolean; category: string }[]>()
    .notNull()
    .default([]),
  releasedBy: uuid("released_by").references(() => users.id),
  releasedAt: timestamp("released_at", { withTimezone: true }),
  recalledBy: uuid("recalled_by").references(() => users.id),
  recalledAt: timestamp("recalled_at", { withTimezone: true }),
  recallReason: text("recall_reason"),
  gaebMathVerified: boolean("gaeb_math_verified").notNull().default(false),
  gaebMathErrors: jsonb("gaeb_math_errors").$type<Array<{ ordnungszahl: string; expected: number; actual: number; delta: number; kind: "line" | "group" | "total"; lvId?: string }>>().notNull().default([]),
  gaebMathCheckedAt: timestamp("gaeb_math_checked_at", { withTimezone: true }),
  mathOverrideReason: text("math_override_reason"),
  mathOverrideBy: uuid("math_override_by").references(() => users.id),
  mathOverrideAt: timestamp("math_override_at", { withTimezone: true }),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("tender_releases_project_id_idx").on(t.projectId)]);

// ═══════════════════════════════════════════════════════════════
// PARTICIPANTS
// ═══════════════════════════════════════════════════════════════

export const participantAccessLevelEnum = pgEnum("participant_access_level", [
  "external_source",
  "lightweight",
  "full_account",
]);

/**
 * Participants — unified entity for all project contributors.
 * Supports role inference, confirmation, and access level management.
 */
export const participants = pgTable("participants", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 255 }).notNull(),
  email: varchar("email", { length: 255 }),
  company: varchar("company", { length: 255 }),
  role: projectRoleEnum("role").notNull().default("team_member"),
  accessLevel: participantAccessLevelEnum("access_level").notNull().default("external_source"),
  roleConfirmed: boolean("role_confirmed").notNull().default(false),
  inferredFrom: jsonb("inferred_from").$type<{
    source: string;
    signals: string[];
    confidence: number;
  }>(),
  craftsRegisterValid: boolean("crafts_register_valid"),
  a1CertificateValid: boolean("a1_certificate_valid"),
  pqVereinStatus: boolean("pq_verein_status"),
  complianceExpiryDate: date("compliance_expiry_date"),
  userId: uuid("user_id").references(() => users.id),
  confirmedBy: uuid("confirmed_by").references(() => users.id),
  confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("participants_project_id_idx").on(t.projectId), index("participants_email_idx").on(t.email)]);

// ═══════════════════════════════════════════════════════════════
// PROJECT VERSIONS
// ═══════════════════════════════════════════════════════════════

/**
 * Project Versions — frozen snapshots of project state.
 */
export const projectVersions = pgTable("project_versions", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  versionNumber: integer("version_number").notNull(),
  label: varchar("label", { length: 255 }).notNull(),
  snapshotData: jsonb("snapshot_data").$type<Record<string, unknown>>().notNull(),
  isCurrent: boolean("is_current").notNull().default(false),
  createdBy: uuid("created_by").references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("project_versions_project_id_idx").on(t.projectId)]);
