import type { GateLetter, LphNumber } from "./types";

// ─── HOAI LPH Phase Definitions ──────────────────────────────

export const LPH_PHASES: Record<LphNumber, { name: string; nameDe: string; objective: string }> = {
  1: {
    name: "Basic Evaluation",
    nameDe: "Grundlagenermittlung",
    objective: "Clarify the project brief, define requirements, and compile initial constraints.",
  },
  2: {
    name: "Preliminary Design",
    nameDe: "Vorplanung",
    objective: "Develop the design concept, analyse feasibility, and estimate costs.",
  },
  3: {
    name: "Design Development",
    nameDe: "Entwurfsplanung",
    objective: "Refine the design to a coordinated scheme with integrated specialist inputs.",
  },
  4: {
    name: "Approval Planning",
    nameDe: "Genehmigungsplanung",
    objective: "Prepare and submit documentation required for building authority approval.",
  },
  5: {
    name: "Detailed Design",
    nameDe: "Ausführungsplanung",
    objective: "Produce construction-level drawings and specifications for execution.",
  },
  6: {
    name: "Tender Preparation",
    nameDe: "Vorbereitung der Vergabe",
    objective: "Prepare bills of quantities, tender documents, and procurement packages.",
  },
  7: {
    name: "Tender & Award",
    nameDe: "Mitwirkung bei der Vergabe",
    objective: "Evaluate bids, conduct negotiations, and recommend contract awards.",
  },
  8: {
    name: "Construction Supervision",
    nameDe: "Objektüberwachung (Bauüberwachung)",
    objective: "Supervise construction, manage quality, and track progress on site.",
  },
  9: {
    name: "Project Closeout",
    nameDe: "Objektbetreuung",
    objective: "Manage defect liability, documentation handover, and project completion.",
  },
};

// ─── Gate Definitions ─────────────────────────────────────────

export interface GateDefinition {
  letter: GateLetter;
  name: string;
  purpose: string;
  unlocks: string[];
  defaultCriteria: { key: string; label: string; autoCheck: boolean }[];
}

export const GATE_DEFINITIONS: Record<GateLetter, GateDefinition> = {
  A: {
    letter: "A",
    name: "Project Intake Complete",
    purpose: "Confirms that sufficient baseline information exists to begin structured planning.",
    unlocks: ["Project dashboard", "Phase planning", "Risk register", "Document management"],
    defaultCriteria: [
      { key: "project_name", label: "Project name available", autoCheck: true },
      { key: "location", label: "Project location identified", autoCheck: true },
      { key: "client", label: "Client identified", autoCheck: true },
      { key: "time_anchor", label: "At least one time anchor (deadline or target date)", autoCheck: true },
      { key: "scope_description", label: "Scope description available", autoCheck: true },
    ],
  },
  B: {
    letter: "B",
    name: "Planning Ready",
    purpose: "Confirms the project objective is clear and a first risk scan has been performed.",
    unlocks: ["Schedule generation", "Responsibility matrix", "Approval workflows"],
    defaultCriteria: [
      { key: "project_objective", label: "Project objective defined", autoCheck: true },
      { key: "constraints_identified", label: "Main constraints identified", autoCheck: true },
      { key: "risk_scan", label: "First risk scan completed", autoCheck: false },
      { key: "lph_roadmap", label: "LPH roadmap generated", autoCheck: true },
      { key: "responsibility_draft", label: "Initial responsibility structure created", autoCheck: true },
    ],
  },
  C: {
    letter: "C",
    name: "Consultant Invitation Ready",
    purpose: "Confirms that sufficient project documentation exists to invite external consultants.",
    unlocks: ["Consultant invitations", "Discipline-specific scope sharing"],
    defaultCriteria: [
      { key: "scope_per_discipline", label: "Scope defined for each discipline", autoCheck: false },
      { key: "project_state_visible", label: "Current project state documented", autoCheck: true },
      { key: "outputs_defined", label: "Expected outputs per consultant defined", autoCheck: false },
      { key: "input_docs_available", label: "Required input documents available or tracked", autoCheck: false },
      { key: "interfaces_identified", label: "Interfaces between disciplines identified", autoCheck: false },
      { key: "internal_approval_to_invite", label: "Internal approval to invite obtained", autoCheck: false },
    ],
  },
  D: {
    letter: "D",
    name: "Tender Ready",
    purpose: "Confirms that procurement packages are complete and ready for market issue.",
    unlocks: ["Bidder invitations", "Tender issue", "Bid return tracking"],
    defaultCriteria: [
      { key: "tender_docs_approved", label: "Tender documents approved for issue", autoCheck: true },
      { key: "consultant_inputs_complete", label: "All consultant inputs received", autoCheck: true },
      { key: "open_decisions_resolved", label: "All open decisions in packages resolved", autoCheck: true },
      { key: "pricing_model_ready", label: "Internal pricing / comparison model prepared", autoCheck: false },
      { key: "procurement_model_confirmed", label: "Procurement model confirmed", autoCheck: true },
    ],
  },
  E: {
    letter: "E",
    name: "Execution Ready",
    purpose: "Confirms that contracts are in place and the project is ready for site execution.",
    unlocks: ["Execution evidence tracking", "Shop drawing reviews", "Site submissions"],
    defaultCriteria: [
      { key: "contracts_awarded", label: "All relevant contracts awarded", autoCheck: true },
      { key: "execution_drawings_approved", label: "Execution drawings approved", autoCheck: false },
      { key: "review_workflow_configured", label: "Review workflow configured", autoCheck: false },
      { key: "site_team_onboarded", label: "Site team members onboarded", autoCheck: false },
      { key: "quality_plan_ready", label: "Quality assurance plan in place", autoCheck: false },
    ],
  },
  F: {
    letter: "F",
    name: "Closeout Ready",
    purpose: "Confirms that all execution is complete and the project is ready for handover.",
    unlocks: ["Project closeout", "Final documentation", "Defect liability management"],
    defaultCriteria: [
      { key: "punch_list_closed", label: "All punch list items closed", autoCheck: true },
      { key: "final_docs_submitted", label: "Final documentation package submitted", autoCheck: false },
      { key: "all_reviews_closed", label: "All review submissions closed", autoCheck: true },
      { key: "client_acceptance", label: "Client acceptance obtained", autoCheck: false },
      { key: "invoicing_complete", label: "All invoicing confirmed", autoCheck: true },
    ],
  },
};

// ─── Roles & Permissions ──────────────────────────────────────

export const PROJECT_ROLES = [
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
] as const;

export const DELAY_CAUSES = [
  { value: "client_delay", label: "Client Delay" },
  { value: "missing_approval", label: "Missing Approval" },
  { value: "design_change", label: "Design Change" },
  { value: "missing_information", label: "Missing Information" },
  { value: "consultant_delay", label: "Consultant Delay" },
  { value: "contractor_delay", label: "Contractor Delay" },
  { value: "site_condition", label: "Site Condition" },
  { value: "authority_issue", label: "Authority Issue" },
  { value: "logistics_issue", label: "Logistics Issue" },
  { value: "unknown", label: "Unknown" },
] as const;

export const RISK_CATEGORIES = [
  { value: "missing_information", label: "Missing Information" },
  { value: "deadline_risk", label: "Deadline Risk" },
  { value: "coordination_risk", label: "Coordination Risk" },
  { value: "approval_risk", label: "Approval Risk" },
  { value: "execution_risk", label: "Execution Risk" },
  { value: "communication_risk", label: "Communication Risk" },
  { value: "contract_interface_risk", label: "Contract Interface Risk" },
  { value: "external_authority", label: "External / Authority" },
] as const;

export const DOCUMENT_TYPES = [
  { value: "project_brief", label: "Project Briefs" },
  { value: "contract", label: "Contracts" },
  { value: "planning", label: "Planning Documents" },
  { value: "approval", label: "Approval Documents" },
  { value: "tender", label: "Tender Documents" },
  { value: "execution", label: "Execution Documents" },
  { value: "meeting_record", label: "Meeting Records" },
  { value: "correspondence", label: "Correspondence" },
  { value: "evidence", label: "Evidence" },
] as const;

export const APPROVAL_TYPES = [
  { value: "client", label: "Client" },
  { value: "internal", label: "Internal" },
  { value: "technical", label: "Technical" },
  { value: "material", label: "Material" },
  { value: "package_release", label: "Package Release" },
  { value: "tender_release", label: "Tender Release" },
  { value: "execution_release", label: "Execution Release" },
  { value: "closeout", label: "Closeout" },
] as const;

// ─── AI Pipeline Steps ────────────────────────────────────────

export const AI_PIPELINE_STEPS = [
  { key: "file_parse", label: "Files received and parsed" },
  { key: "fact_extraction", label: "Running fact extraction" },
  { key: "classification", label: "Classifying project type" },
  { key: "lph_mapping", label: "Mapping to HOAI LPH 1–9" },
  { key: "schedule_model", label: "Generating schedule model" },
  { key: "responsibility_structure", label: "Building responsibility structure" },
  { key: "gate_check", label: "Running gate eligibility check" },
  { key: "dashboard_config", label: "Generating dashboard configuration" },
] as const;

// ─── Required Fact Fields (AI extraction) ─────────────────────

export const REQUIRED_FACT_FIELDS = [
  "project_name",
  "project_type",
  "location",
  "client_name",
  "client_representative",
  "decision_authority",
  "scope_description",
  "procurement_model",
  "target_completion",
  "known_deadlines",
  "known_consultants",
  "known_constraints",
  "mentioned_risks",
  "mentioned_approvals",
  "lph_start_estimate",
] as const;

// ─── Notification Event Types ─────────────────────────────────

export const NOTIFICATION_EVENTS = [
  { key: "gate_blocked", label: "Gate becomes blocked" },
  { key: "approval_overdue", label: "Approval overdue" },
  { key: "approval_requested", label: "Approval request received" },
  { key: "consultant_ready", label: "Consultant invitation ready" },
  { key: "tender_ready", label: "Tender package becomes ready" },
  { key: "gate_override", label: "Gate override performed" },
  { key: "review_received", label: "Review submission received" },
  { key: "review_overdue", label: "Review overdue" },
  { key: "delay_logged", label: "Delay event logged" },
  { key: "inbox_unreviewed", label: "Inbox message received" },
] as const;
