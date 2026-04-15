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
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  clerkId: varchar("clerk_id", { length: 255 }).notNull().unique(),
  email: varchar("email", { length: 255 }).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  role: workspaceRoleEnum("role").notNull().default("team_member"),
  avatarUrl: text("avatar_url"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const projects = pgTable("projects", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 500 }).notNull(),
  type: projectTypeEnum("type").notNull().default("not_sure"),
  status: projectStatusEnum("status").notNull().default("active"),
  procurementModel: procurementModelEnum("procurement_model").notNull().default("unclear"),
  targetCompletion: date("target_completion"),
  healthScore: healthScoreEnum("health_score").notNull().default("green"),
  objective: text("objective"),
  scopeSummary: text("scope_summary"),
  location: varchar("location", { length: 500 }),
  clientName: varchar("client_name", { length: 255 }),
  clientRepresentative: varchar("client_representative", { length: 255 }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("projects_workspace_id_idx").on(t.workspaceId), index("projects_status_idx").on(t.status)]);

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

export const gates = pgTable("gates", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  gate: gateLetterEnum("gate").notNull(),
  status: gateStatusEnum("status").notNull().default("locked"),
  criteria: jsonb("criteria")
    .$type<{ key: string; label: string; met: boolean; autoCheck: boolean }[]>()
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
  createdBy: uuid("created_by").references(() => users.id),
  relatedPhaseId: uuid("related_phase_id").references(() => phases.id),
  relatedPackageId: uuid("related_package_id").references(() => tenderPackages.id),
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
