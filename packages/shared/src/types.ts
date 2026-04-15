// ─── Core Entity Types ─────────────────────────────────────────

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  plan: WorkspacePlan;
  inboxEmail: string;
  logoUrl?: string;
  address?: Address;
  taxId?: string;
  defaultCountry: string;
  defaultTimezone: string;
  createdAt: Date;
}

export interface Address {
  street?: string;
  city?: string;
  postcode?: string;
  country: string;
}

export type WorkspacePlan = "free" | "starter" | "professional" | "enterprise";

export interface User {
  id: string;
  workspaceId: string;
  clerkId: string;
  email: string;
  name: string;
  role: WorkspaceRole;
  avatarUrl?: string;
  createdAt: Date;
}

export type WorkspaceRole = "architect_admin" | "project_lead" | "team_member";

export type ProjectRole =
  | "architect_admin"
  | "project_lead"
  | "team_member"
  | "client"
  | "client_representative"
  | "consultant"
  | "reviewer"
  | "approver"
  | "document_controller"
  | "bidder"
  | "general_contractor"
  | "trade_contractor";

// ─── Project ───────────────────────────────────────────────────

export interface Project {
  id: string;
  workspaceId: string;
  name: string;
  type: ProjectType;
  status: ProjectStatus;
  gateStatusA: GateStatus;
  gateStatusB: GateStatus;
  gateStatusC: GateStatus;
  gateStatusD: GateStatus;
  gateStatusE: GateStatus;
  gateStatusF: GateStatus;
  procurementModel: ProcurementModel;
  targetCompletion?: Date;
  healthScore: HealthScore;
  createdAt: Date;
}

export type ProjectType =
  | "new_build"
  | "refurbishment"
  | "conversion"
  | "interior_fit_out"
  | "mixed_use"
  | "not_sure";

export type ProjectStatus = "active" | "on_hold" | "archived";
export type ProcurementModel = "general_contractor" | "single_trades" | "unclear";
export type HealthScore = "green" | "amber" | "red";

// ─── Data State ────────────────────────────────────────────────

export type DataState = "CONFIRMED" | "DERIVED" | "UNCLEAR" | "MISSING";

export interface ProjectFact {
  id: string;
  projectId: string;
  fieldName: string;
  value: string | null;
  dataState: DataState;
  sourceRef?: string;
  createdAt: Date;
}

// ─── Phases ────────────────────────────────────────────────────

export interface Phase {
  id: string;
  projectId: string;
  lph: LphNumber;
  status: PhaseStatus;
  startDate?: Date;
  endDate?: Date;
  objective: string;
}

export type LphNumber = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
export type PhaseStatus = "not_started" | "active" | "complete";

// ─── Tasks ─────────────────────────────────────────────────────

export interface Task {
  id: string;
  projectId: string;
  phaseId: string;
  name: string;
  ownerUserId?: string;
  reviewerUserId?: string;
  approverUserId?: string;
  dueDate?: Date;
  status: TaskStatus;
  dependencies: string[];
  evidenceRef?: string;
}

export type TaskStatus = "not_started" | "in_progress" | "complete";

// ─── Gates ─────────────────────────────────────────────────────

export type GateLetter = "A" | "B" | "C" | "D" | "E" | "F";
export type GateStatus = "locked" | "in_progress" | "complete" | "overridden";

export interface Gate {
  id: string;
  projectId: string;
  gate: GateLetter;
  status: GateStatus;
  criteria: GateCriterion[];
  overrideActive: boolean;
  overrideReason?: string;
  overrideBy?: string;
  overrideAt?: Date;
}

export interface GateCriterion {
  key: string;
  label: string;
  met: boolean;
  autoCheck: boolean;
}

// ─── Approvals ─────────────────────────────────────────────────

export interface Approval {
  id: string;
  projectId: string;
  name: string;
  type: ApprovalType;
  status: ApprovalStatus;
  requestedBy: string;
  approverUserId?: string;
  dueDate?: Date;
  approvedAt?: Date;
  notes?: string;
}

export type ApprovalType =
  | "client"
  | "internal"
  | "technical"
  | "material"
  | "package_release"
  | "tender_release"
  | "execution_release"
  | "closeout";

export type ApprovalStatus = "pending" | "in_review" | "approved" | "rejected" | "overdue";

// ─── Consultants ───────────────────────────────────────────────

export interface Consultant {
  id: string;
  projectId: string;
  discipline: string;
  readinessCriteria: ConsultantReadinessCriterion[];
  invitationStatus: InvitationStatus;
  invitedAt?: Date;
  invitedBy?: string;
}

export interface ConsultantReadinessCriterion {
  key: string;
  label: string;
  met: boolean;
}

export type InvitationStatus = "not_ready" | "ready" | "invited" | "accepted";

// ─── Tender Packages ───────────────────────────────────────────

export interface TenderPackage {
  id: string;
  projectId: string;
  name: string;
  procurementModel: ProcurementModel;
  readinessScore: number;
  tenderReady: boolean;
  invitationEnabled: boolean;
  blockers: TenderBlocker[];
}

export interface TenderBlocker {
  description: string;
  gateRef?: string;
  resolved: boolean;
}

// ─── Documents ─────────────────────────────────────────────────

export interface Document {
  id: string;
  projectId: string;
  name: string;
  type: DocumentType;
  versions: DocumentVersion[];
  currentVersion: number;
  status: DocumentStatus;
  createdBy: string;
}

export type DocumentType =
  | "project_brief"
  | "contract"
  | "planning"
  | "approval"
  | "tender"
  | "execution"
  | "meeting_record"
  | "correspondence"
  | "evidence";

export type DocumentStatus =
  | "draft"
  | "internally_reviewed"
  | "approved_for_issue"
  | "issued"
  | "superseded"
  | "awarded_baseline"
  | "archived";

export interface DocumentVersion {
  version: number;
  date: Date;
  uploadedBy: string;
  status: DocumentStatus;
  changesNote?: string;
  filePath: string;
}

// ─── Delays ────────────────────────────────────────────────────

export interface DelayEvent {
  id: string;
  projectId: string;
  eventDate: Date;
  reportedBy: string;
  description: string;
  causeCategory: DelayCause;
  affectedTasks: string[];
  evidenceRefs: string[];
  scheduleImpactDays: number;
  status: DelayStatus;
}

export type DelayCause =
  | "client_delay"
  | "missing_approval"
  | "design_change"
  | "missing_information"
  | "consultant_delay"
  | "contractor_delay"
  | "site_condition"
  | "authority_issue"
  | "logistics_issue"
  | "unknown";

export type DelayStatus = "open" | "under_review" | "resolved" | "escalated";

// ─── Reviews ───────────────────────────────────────────────────

export interface ReviewSubmission {
  id: string;
  projectId: string;
  type: ReviewType;
  submittedBy: string;
  status: ReviewStatus;
  deviations: ReviewDeviation[];
  reviewerId?: string;
  reviewOutcome?: ReviewOutcome;
}

export type ReviewType = "shop_drawing" | "execution_evidence";

export type ReviewStatus =
  | "received"
  | "completeness_check"
  | "assigned"
  | "under_review"
  | "deviation_log"
  | "closed";

export type ReviewOutcome =
  | "approved"
  | "approved_with_comments"
  | "resubmission_required"
  | "rejected";

export interface ReviewDeviation {
  itemNo: number;
  description: string;
  severity: "minor" | "major" | "critical";
  designImpact: string;
  technicalImpact: string;
  scheduleImpact: string;
  status: "open" | "resolved" | "accepted";
  resolutionNotes?: string;
}

// ─── Invitations ───────────────────────────────────────────────

export interface Invitation {
  id: string;
  projectId: string;
  userId?: string;
  email: string;
  role: ProjectRole;
  gateAtInvitation: GateLetter;
  invitedBy: string;
  status: "pending" | "accepted" | "expired" | "revoked";
  token: string;
  expiresAt: Date;
  acceptedAt?: Date;
}

// ─── Audit Logs ────────────────────────────────────────────────

export interface AuditLog {
  id: string;
  workspaceId: string;
  projectId?: string;
  userId: string;
  action: string;
  entityType: string;
  entityId: string;
  beforeState?: Record<string, unknown>;
  afterState?: Record<string, unknown>;
  createdAt: Date;
}

// ─── Inbox ─────────────────────────────────────────────────────

export interface InboxMessage {
  id: string;
  workspaceId: string;
  projectId?: string;
  fromEmail: string;
  subject: string;
  body: string;
  attachments: InboxAttachment[];
  aiSuggestions?: InboxAiSuggestion;
  status: InboxStatus;
  createdAt: Date;
}

export interface InboxAttachment {
  name: string;
  contentType: string;
  size: number;
  storagePath: string;
}

export interface InboxAiSuggestion {
  suggestedProjectId?: string;
  suggestedProjectName?: string;
  confidence?: number;
  documentType?: string;
  signals: string[];
}

export type InboxStatus = "unreviewed" | "assigned" | "archived";

// ─── API Response Types ────────────────────────────────────────

export interface ApiResponse<T> {
  data: T;
  meta?: { total?: number; page?: number; pageSize?: number };
}

export interface ApiError {
  error: string;
  message: string;
  statusCode: number;
}

export interface JobStatus {
  jobId: string;
  status: "pending" | "processing" | "complete" | "failed";
  currentStep?: string;
  steps: JobStep[];
  result?: { projectId: string };
  error?: string;
}

export interface JobStep {
  key: string;
  label: string;
  status: "pending" | "processing" | "complete" | "failed";
}
