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
  workspaceId: string | null;
  email: string;
  name: string;
  emailVerified: boolean;
  image?: string | null;
  role: WorkspaceRole;
  createdAt: Date;
  updatedAt: Date;
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

export type ProjectLifecycleState =
  | "input_received"
  | "parsed"
  | "needs_review"
  | "confirmed"
  | "structure_approved"
  | "cost_ready"
  | "detail_ready"
  | "tender_ready"
  | "released_for_tender";

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

export type InboxStatus = "unreviewed" | "assigned" | "archived" | "auto_classified" | "low_confidence" | "needs_role_confirmation" | "needs_project_assignment";

// ═══════════════════════════════════════════════════════════════
// DIN 276 — COST MANAGEMENT TYPES
// ═══════════════════════════════════════════════════════════════

export type CostStage =
  | "kostenrahmen"
  | "kostenschaetzung"
  | "kostenberechnung"
  | "kostenanschlag"
  | "kostenfeststellung";

export type CostSnapshotStatus = "draft" | "submitted" | "approved" | "superseded";

export interface CostSnapshot {
  id: string;
  projectId: string;
  costStage: CostStage;
  phaseId?: string;
  snapshotDate: Date;
  totalGross: number;
  totalNet: number;
  vatRate: number;
  currency: string;
  notes?: string;
  status: CostSnapshotStatus;
  approvedBy?: string;
  approvedAt?: Date;
  createdBy?: string;
  createdAt: Date;
}

export interface CostLineItem {
  id: string;
  snapshotId: string;
  costGroupCode: string;
  costGroupLevel: 1 | 2 | 3;
  description?: string;
  amountNet: number;
  amountGross: number;
  quantity?: number;
  unit?: string;
  unitPrice?: number;
  source?: string;
  dataState: DataState;
  createdAt: Date;
}

export interface CostBenchmark {
  id: string;
  workspaceId: string;
  costGroupCode: string;
  projectType?: ProjectType;
  region?: string;
  pricePerUnit: number;
  unit: string;
  referenceYear: number;
  source?: string;
  notes?: string;
  createdAt: Date;
}

/**
 * Cost comparison row — used for tracking cost progression across stages.
 */
export interface CostComparisonRow {
  costGroupCode: string;
  costGroupName: string;
  kostenrahmen?: number;
  kostenschaetzung?: number;
  kostenberechnung?: number;
  kostenanschlag?: number;
  kostenfeststellung?: number;
  deviationPercent?: number;
}

// ═══════════════════════════════════════════════════════════════
// HOAI — FEE CALCULATION TYPES
// ═══════════════════════════════════════════════════════════════

export type HoaiFeeZone = "I" | "II" | "III" | "IV" | "V";

export type HoaiServiceType =
  | "gebaeudeplanung"
  | "freianlagenplanung"
  | "tragwerksplanung"
  | "technische_ausruestung";

export interface HoaiFeeCalculation {
  id: string;
  projectId: string;
  serviceType: HoaiServiceType;
  feeZone: HoaiFeeZone;
  anrechenbareKosten: number;
  feePositionInZone: number;
  baseFee: number;
  agreedPercentage?: number;
  commissionedPhases: number[];
  phaseFees: HoaiPhaseFee[];
  modifiers: HoaiFeeModifier[];
  totalFee: number;
  notes?: string;
  calculatedAt: Date;
  createdBy?: string;
}

export interface HoaiPhaseFee {
  lph: number;
  percentage: number;
  fee: number;
}

export interface HoaiFeeModifier {
  key: string;
  label: string;
  factor: number;
}

// ═══════════════════════════════════════════════════════════════
// VOB — CONTRACT MANAGEMENT TYPES
// ═══════════════════════════════════════════════════════════════

export type VobTenderingProcedure =
  | "oeffentliche_ausschreibung"
  | "beschraenkte_ausschreibung"
  | "beschraenkte_ausschreibung_mit_tw"
  | "verhandlungsvergabe"
  | "verhandlungsvergabe_mit_tw"
  | "wettbewerblicher_dialog"
  | "direktauftrag";

export type VobContractType = "vob_b" | "bgb_werkvertrag";

export type ContractStatus =
  | "draft"
  | "tendered"
  | "awarded"
  | "active"
  | "in_warranty"
  | "closed"
  | "terminated";

export interface Contract {
  id: string;
  projectId: string;
  packageId?: string;
  contractNumber?: string;
  title: string;
  contractType: VobContractType;
  tenderingProcedure?: VobTenderingProcedure;
  contractorCompany: string;
  contractorContact?: string;
  contractorEmail?: string;
  awardDate?: Date;
  commencementDate?: Date;
  completionDate?: Date;
  abnahmeDate?: Date;
  warrantyEndDate?: Date;
  warrantyPeriodMonths: number;
  contractValueNet: number;
  contractValueGross: number;
  retentionPercentage: number;
  retentionAmount: number;
  status: ContractStatus;
  vobCReference?: string;
  costGroupCode?: string;
  notes?: string;
  createdBy?: string;
  createdAt: Date;
}

export type NachtragStatus =
  | "draft"
  | "submitted"
  | "under_review"
  | "approved"
  | "rejected"
  | "partially_approved";

export type NachtragType =
  | "mengenabweichung"
  | "geaenderte_leistung"
  | "zusaetzliche_leistung"
  | "selbst_uebernahme"
  | "behinderung"
  | "stundenlohn";

export interface Nachtrag {
  id: string;
  contractId: string;
  projectId: string;
  nachtragNumber: string;
  title: string;
  type: NachtragType;
  vobReference?: string;
  description: string;
  requestedAmountNet: number;
  approvedAmountNet?: number;
  scheduleImpactDays: number;
  submittedBy: string;
  submittedAt: Date;
  reviewedBy?: string;
  reviewedAt?: Date;
  status: NachtragStatus;
  supportingDocuments: string[];
  notes?: string;
  createdAt: Date;
}

export type PaymentType =
  | "abschlagszahlung"
  | "teilschlussrechnung"
  | "schlussrechnung"
  | "sicherheitseinbehalt";

export type PaymentStatus =
  | "submitted"
  | "under_review"
  | "approved"
  | "paid"
  | "disputed";

export interface Payment {
  id: string;
  contractId: string;
  projectId: string;
  paymentNumber: string;
  type: PaymentType;
  invoiceDate: Date;
  invoiceRef?: string;
  amountNet: number;
  amountGross: number;
  vatRate: number;
  cumulativeNet: number;
  retentionDeducted: number;
  dueDate?: Date;
  paidDate?: Date;
  status: PaymentStatus;
  reviewedBy?: string;
  notes?: string;
  createdAt: Date;
}

export type AbnahmeType =
  | "foermliche_abnahme"
  | "stillschweigende_abnahme"
  | "teilabnahme"
  | "fiktive_abnahme";

export type AbnahmeStatus =
  | "scheduled"
  | "completed_without_defects"
  | "completed_with_defects"
  | "refused";

export interface AbnahmeDefect {
  description: string;
  severity: string;
  deadline: string;
  resolved: boolean;
}

export interface AbnahmeAttendee {
  name: string;
  role: string;
  company: string;
}

export interface Abnahme {
  id: string;
  contractId: string;
  projectId: string;
  type: AbnahmeType;
  scheduledDate: Date;
  actualDate?: Date;
  status: AbnahmeStatus;
  attendees: AbnahmeAttendee[];
  defects: AbnahmeDefect[];
  warrantyStartDate?: Date;
  protocolRef?: string;
  notes?: string;
  createdBy?: string;
  createdAt: Date;
}

// ═══════════════════════════════════════════════════════════════
// GAEB — BILL OF QUANTITIES TYPES
// ═══════════════════════════════════════════════════════════════

export type GaebExchangePhase =
  | "gaeb_81"
  | "gaeb_82"
  | "gaeb_83"
  | "gaeb_84"
  | "gaeb_85"
  | "gaeb_86"
  | "gaeb_87"
  | "gaeb_89"
  | "gaeb_90"
  | "gaeb_da11";

export type GaebPositionType =
  | "normalposition"
  | "alternativposition"
  | "eventuaposition"
  | "bedarfsposition"
  | "grundposition"
  | "wahlposition"
  | "zuschlagsposition"
  | "pauschalposition"
  | "stundenlohnarbeiten";

export interface Leistungsverzeichnis {
  id: string;
  projectId: string;
  packageId?: string;
  contractId?: string;
  title: string;
  lvNumber?: string;
  exchangePhase: GaebExchangePhase;
  costGroupCode?: string;
  vobCReference?: string;
  totalNet: number;
  totalGross: number;
  positionCount: number;
  gaebFileRef?: string;
  gaebVersion?: string;
  notes?: string;
  createdBy?: string;
  createdAt: Date;
}

export interface LvPosition {
  id: string;
  lvId: string;
  ordnungszahl: string;
  titel?: string;
  titelLevel: number;
  positionType: GaebPositionType;
  kurztext: string;
  langtext?: string;
  menge: number;
  einheit: string;
  einheitspreis: number;
  gesamtpreis: number;
  costGroupCode?: string;
  linkedPositionId?: string;
  notes?: string;
}

export interface GaebExchangeLogEntry {
  id: string;
  projectId: string;
  lvId?: string;
  direction: "import" | "export";
  exchangePhase: GaebExchangePhase;
  fileName: string;
  fileRef: string;
  fileSize: number;
  gaebVersion?: string;
  positionsImported?: number;
  errorLog?: string;
  importedBy?: string;
  createdAt: Date;
}

// ═══════════════════════════════════════════════════════════════
// REGULATORY COMPLIANCE TYPES
// ═══════════════════════════════════════════════════════════════

export type ComplianceArea =
  | "bauordnung"
  | "brandschutz"
  | "geg_energy"
  | "sigeko"
  | "denkmalschutz"
  | "umweltschutz"
  | "schallschutz"
  | "barrierefreiheit";

export type ComplianceStatus =
  | "not_applicable"
  | "not_started"
  | "in_preparation"
  | "submitted"
  | "approved"
  | "conditionally_approved"
  | "rejected"
  | "expired";

export interface RegulatoryCondition {
  condition: string;
  met: boolean;
  deadline?: string;
}

export interface RegulatorySubmission {
  id: string;
  projectId: string;
  area: ComplianceArea;
  submissionType: string;
  title: string;
  authority?: string;
  referenceNumber?: string;
  submittedDate?: Date;
  expectedResponseDate?: Date;
  approvedDate?: Date;
  expiryDate?: Date;
  status: ComplianceStatus;
  conditions: RegulatoryCondition[];
  relatedPhaseId?: string;
  documentRef?: string;
  responsibleUserId?: string;
  notes?: string;
  createdAt: Date;
}

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

// ═══════════════════════════════════════════════════════════════
// STRUCTURED PROJECT DESCRIPTION (SPD)
// ═══════════════════════════════════════════════════════════════

export type SpdStatus = "draft" | "submitted" | "approved" | "revision_requested";

export interface SpdParticipant {
  name: string;
  role: string;
  company?: string;
  email?: string;
}

export interface SpdOpenPoint {
  point: string;
  priority: string;
  assignedTo?: string;
}

export interface ProjectDescription {
  id: string;
  projectId: string;
  version: number;
  status: SpdStatus;
  projectName?: string;
  projectGoal?: string;
  projectType?: string;
  location?: string;
  participants: SpdParticipant[];
  scopeOfWork?: string;
  spatialScope?: string;
  relevantApprovedDocuments: string[];
  assumptions: string[];
  openPoints: SpdOpenPoint[];
  currentProjectPhase?: string;
  approvedProjectResources: string[];
  currentDefinedProjectStatus?: string;
  approvedBy?: string;
  approvedAt?: Date;
  createdBy?: string;
  createdAt: Date;
}

/** The 13 mandatory fields in an SPD */
export const SPD_MANDATORY_FIELDS = [
  "projectName",
  "projectGoal",
  "projectType",
  "location",
  "participants",
  "scopeOfWork",
  "spatialScope",
  "relevantApprovedDocuments",
  "assumptions",
  "openPoints",
  "currentProjectPhase",
  "approvedProjectResources",
  "currentDefinedProjectStatus",
] as const;

export type SpdMandatoryField = typeof SPD_MANDATORY_FIELDS[number];

// ═══════════════════════════════════════════════════════════════
// TENDER RELEASE STATE
// ═══════════════════════════════════════════════════════════════

export type TenderReleaseStatus = "pending_review" | "ready" | "released" | "recalled";

export interface TenderReleasePrerequisite {
  key: string;
  label: string;
  met: boolean;
  category: string;
}

export interface TenderRelease {
  id: string;
  projectId: string;
  status: TenderReleaseStatus;
  prerequisites: TenderReleasePrerequisite[];
  releasedBy?: string;
  releasedAt?: Date;
  recalledBy?: string;
  recalledAt?: Date;
  recallReason?: string;
  notes?: string;
  createdAt: Date;
}

// ═══════════════════════════════════════════════════════════════
// PARTICIPANTS
// ═══════════════════════════════════════════════════════════════

export type ParticipantAccessLevel = "external_source" | "lightweight" | "full_account";

export interface ParticipantInferenceData {
  source: string;
  signals: string[];
  confidence: number;
}

export interface Participant {
  id: string;
  projectId: string;
  name: string;
  email?: string;
  company?: string;
  role: ProjectRole;
  accessLevel: ParticipantAccessLevel;
  roleConfirmed: boolean;
  inferredFrom?: ParticipantInferenceData;
  userId?: string;
  confirmedBy?: string;
  confirmedAt?: Date;
  createdAt: Date;
}

// ═══════════════════════════════════════════════════════════════
// PROJECT VERSIONS
// ═══════════════════════════════════════════════════════════════

export interface ProjectVersion {
  id: string;
  projectId: string;
  versionNumber: number;
  label: string;
  snapshotData: Record<string, unknown>;
  isCurrent: boolean;
  createdBy?: string;
  createdAt: Date;
}

// ═══════════════════════════════════════════════════════════════
// READINESS ENGINE
// ═══════════════════════════════════════════════════════════════

export interface ReadinessCheck {
  key: string;
  label: string;
  met: boolean;
  linkTo?: string; // page/section to resolve
}

export interface ReadinessLevel {
  level: string;
  label: string;
  score: number;
  total: number;
  checks: ReadinessCheck[];
}

export interface ProjectReadiness {
  spd: ReadinessLevel;
  cost: ReadinessLevel;
  detail: ReadinessLevel;
  tender: ReadinessLevel;
}

// ═══════════════════════════════════════════════════════════════
// PROVENANCE
// ═══════════════════════════════════════════════════════════════

export interface ProvenanceData {
  source?: string;
  sender?: string;
  timestamp?: string;
  rawRef?: string;
  transformationHistory?: string[];
}

// ═══════════════════════════════════════════════════════════════
// STATE MACHINE
// ═══════════════════════════════════════════════════════════════

export interface StateTransitionRule {
  from: ProjectLifecycleState;
  to: ProjectLifecycleState;
  automatic: boolean;
  humanRequired: boolean;
  description: string;
}
