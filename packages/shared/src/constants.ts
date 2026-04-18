import type { GateLetter, HoaiFeeZone, LphNumber, ProjectLifecycleState, StateTransitionRule } from "./types";

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
      { key: "kostenrahmen", label: "DIN 276 Kostenrahmen available (cost framework)", autoCheck: true },
      { key: "hoai_fee_zone", label: "HOAI fee zone classified", autoCheck: true },
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
      { key: "kostenschaetzung", label: "DIN 276 Kostenschätzung available (LPH 2 cost estimate)", autoCheck: true },
      { key: "hoai_scope_defined", label: "HOAI service scope defined per discipline", autoCheck: false },
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
      { key: "kostenberechnung", label: "DIN 276 Kostenberechnung available (LPH 3 cost calculation)", autoCheck: true },
      { key: "vob_procedure_determined", label: "VOB tendering procedure determined", autoCheck: true },
      { key: "trade_packages_defined", label: "Trade packages defined with VOB/C references", autoCheck: true },
      { key: "bauantrag_submitted", label: "Bauantrag submitted (LPH 4)", autoCheck: false },
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
      { key: "kostenanschlag", label: "DIN 276 Kostenanschlag complete (tender-based costs)", autoCheck: true },
      { key: "sigeko_plan", label: "SiGePlan prepared (if required)", autoCheck: false },
      { key: "baugenehmigung", label: "Baugenehmigung granted", autoCheck: false },
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
      { key: "kostenfeststellung", label: "DIN 276 Kostenfeststellung complete (final costs)", autoCheck: true },
      { key: "abnahmen_complete", label: "All VOB Abnahmen (formal acceptances) complete", autoCheck: true },
      { key: "warranty_tracking", label: "Gewährleistung tracking active for all contracts", autoCheck: true },
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
  { key: "cost_estimation", label: "Generating DIN 276 Kostenrahmen" },
  { key: "hoai_fee_calc", label: "Calculating HOAI fee estimate" },
  { key: "vob_packages", label: "Defining VOB trade packages" },
  { key: "regulatory_check", label: "Checking regulatory requirements" },
  { key: "schedule_model", label: "Generating schedule model" },
  { key: "responsibility_structure", label: "Building responsibility structure" },
  { key: "gate_check", label: "Running gate eligibility check" },
  { key: "dashboard_config", label: "Generating dashboard configuration" },
] as const;

// ─── Required Fact Fields (AI extraction) ─────────────────────

export const REQUIRED_FACT_FIELDS = [
  // Project basics
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
  // DIN 276 cost fields
  "estimated_construction_cost",
  "cost_group_300_estimate",
  "cost_group_400_estimate",
  "cost_group_500_estimate",
  "cost_group_700_estimate",
  "gross_floor_area_bgf",
  "net_floor_area_ngf",
  "cost_per_sqm_estimate",
  "mentioned_budget_limit",
  "funding_source",
  // HOAI fields
  "hoai_fee_zone",
  "hoai_service_scope",
  "commissioned_phases",
  "special_services_mentioned",
  // VOB fields
  "procurement_model_vob",
  "tendering_procedure_type",
  "known_trade_packages",
  "contract_type_preference",
  // Regulatory fields
  "building_permit_status",
  "fire_protection_class",
  "energy_standard",
  "heritage_protection",
  "environmental_requirements",
  "accessibility_requirements",
  "sigeko_required",
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
  { key: "cost_budget_exceeded", label: "Cost budget exceeded threshold" },
  { key: "nachtrag_submitted", label: "Nachtrag (variation order) submitted" },
  { key: "abnahme_due", label: "Abnahme (acceptance) due" },
  { key: "gewaehrleistung_expiring", label: "Gewährleistung (warranty) expiring" },
] as const;

// ═══════════════════════════════════════════════════════════════
// DIN 276 — COST GROUPS (Kostengruppen)
// Standard: DIN 276:2018-12 — Kosten im Bauwesen
// Hierarchical cost classification: Level 1 (100s), Level 2 (10s), Level 3 (units)
// ═══════════════════════════════════════════════════════════════

export interface DIN276CostGroup {
  code: string;
  nameDe: string;
  nameEn: string;
  level: 1 | 2 | 3;
  parent?: string;
}

export const DIN276_COST_GROUPS: DIN276CostGroup[] = [
  // KG 100 — Grundstück (Land)
  { code: "100", nameDe: "Grundstück", nameEn: "Land", level: 1 },
  { code: "110", nameDe: "Grundstückswert", nameEn: "Land Value", level: 2, parent: "100" },
  { code: "120", nameDe: "Grundstücksnebenkosten", nameEn: "Land Ancillary Costs", level: 2, parent: "100" },
  { code: "130", nameDe: "Freimachen", nameEn: "Site Clearance", level: 2, parent: "100" },

  // KG 200 — Vorbereitende Maßnahmen (Preliminary Works)
  { code: "200", nameDe: "Vorbereitende Maßnahmen", nameEn: "Preliminary Works", level: 1 },
  { code: "210", nameDe: "Herrichten", nameEn: "Site Preparation", level: 2, parent: "200" },
  { code: "211", nameDe: "Sicherungsmaßnahmen", nameEn: "Safety Measures", level: 3, parent: "210" },
  { code: "212", nameDe: "Abbruchmaßnahmen", nameEn: "Demolition", level: 3, parent: "210" },
  { code: "213", nameDe: "Altlastenbeseitigung", nameEn: "Contamination Removal", level: 3, parent: "210" },
  { code: "220", nameDe: "Öffentliche Erschließung", nameEn: "Public Infrastructure", level: 2, parent: "200" },
  { code: "230", nameDe: "Nichtöffentliche Erschließung", nameEn: "Private Infrastructure", level: 2, parent: "200" },
  { code: "240", nameDe: "Ausgleichsabgaben", nameEn: "Compensation Levies", level: 2, parent: "200" },
  { code: "250", nameDe: "Übergangsmaßnahmen", nameEn: "Temporary Measures", level: 2, parent: "200" },

  // KG 300 — Bauwerk – Baukonstruktionen (Building Construction)
  { code: "300", nameDe: "Bauwerk – Baukonstruktionen", nameEn: "Building Construction", level: 1 },
  { code: "310", nameDe: "Baugrube / Erdbau", nameEn: "Excavation / Earthworks", level: 2, parent: "300" },
  { code: "320", nameDe: "Gründung, Unterbau", nameEn: "Foundation", level: 2, parent: "300" },
  { code: "330", nameDe: "Außenwände / Vertikale Baukonstruktionen, außen", nameEn: "External Walls", level: 2, parent: "300" },
  { code: "331", nameDe: "Tragende Außenwände", nameEn: "Load-bearing External Walls", level: 3, parent: "330" },
  { code: "332", nameDe: "Nichttragende Außenwände", nameEn: "Non-load-bearing External Walls", level: 3, parent: "330" },
  { code: "333", nameDe: "Außenstützen", nameEn: "External Columns", level: 3, parent: "330" },
  { code: "334", nameDe: "Außentüren und -fenster", nameEn: "External Doors & Windows", level: 3, parent: "330" },
  { code: "335", nameDe: "Außenwandbekleidungen, außen", nameEn: "External Wall Cladding, Outside", level: 3, parent: "330" },
  { code: "336", nameDe: "Außenwandbekleidungen, innen", nameEn: "External Wall Cladding, Inside", level: 3, parent: "330" },
  { code: "337", nameDe: "Elementierte Außenwände", nameEn: "Prefab External Walls", level: 3, parent: "330" },
  { code: "338", nameDe: "Sonnenschutz", nameEn: "Sun Protection", level: 3, parent: "330" },
  { code: "339", nameDe: "Außenwände, sonstiges", nameEn: "External Walls, Other", level: 3, parent: "330" },
  { code: "340", nameDe: "Innenwände / Vertikale Baukonstruktionen, innen", nameEn: "Internal Walls", level: 2, parent: "300" },
  { code: "341", nameDe: "Tragende Innenwände", nameEn: "Load-bearing Internal Walls", level: 3, parent: "340" },
  { code: "342", nameDe: "Nichttragende Innenwände", nameEn: "Non-load-bearing Internal Walls", level: 3, parent: "340" },
  { code: "343", nameDe: "Innenstützen", nameEn: "Internal Columns", level: 3, parent: "340" },
  { code: "344", nameDe: "Innentüren und -fenster", nameEn: "Internal Doors & Windows", level: 3, parent: "340" },
  { code: "345", nameDe: "Innenwandbekleidungen", nameEn: "Internal Wall Finishes", level: 3, parent: "340" },
  { code: "346", nameDe: "Elementierte Innenwände", nameEn: "Prefab Internal Walls", level: 3, parent: "340" },
  { code: "349", nameDe: "Innenwände, sonstiges", nameEn: "Internal Walls, Other", level: 3, parent: "340" },
  { code: "350", nameDe: "Decken / Horizontale Baukonstruktionen", nameEn: "Floor Slabs / Horizontal Structures", level: 2, parent: "300" },
  { code: "351", nameDe: "Deckenkonstruktionen", nameEn: "Slab Structures", level: 3, parent: "350" },
  { code: "352", nameDe: "Deckenbeläge", nameEn: "Floor Finishes", level: 3, parent: "350" },
  { code: "353", nameDe: "Deckenbekleidungen", nameEn: "Ceiling Finishes", level: 3, parent: "350" },
  { code: "359", nameDe: "Decken, sonstiges", nameEn: "Slabs, Other", level: 3, parent: "350" },
  { code: "360", nameDe: "Dächer", nameEn: "Roofs", level: 2, parent: "300" },
  { code: "361", nameDe: "Dachkonstruktionen", nameEn: "Roof Structures", level: 3, parent: "360" },
  { code: "362", nameDe: "Dachfenster, Dachöffnungen", nameEn: "Roof Windows & Openings", level: 3, parent: "360" },
  { code: "363", nameDe: "Dachbeläge", nameEn: "Roof Coverings", level: 3, parent: "360" },
  { code: "364", nameDe: "Dachbekleidungen", nameEn: "Roof Cladding", level: 3, parent: "360" },
  { code: "369", nameDe: "Dächer, sonstiges", nameEn: "Roofs, Other", level: 3, parent: "360" },
  { code: "370", nameDe: "Baukonstruktive Einbauten", nameEn: "Built-in Construction Elements", level: 2, parent: "300" },
  { code: "390", nameDe: "Sonstige Maßnahmen für Baukonstruktionen", nameEn: "Other Construction Measures", level: 2, parent: "300" },

  // KG 400 — Bauwerk – Technische Anlagen (Building Services / MEP)
  { code: "400", nameDe: "Bauwerk – Technische Anlagen", nameEn: "Building Services (MEP)", level: 1 },
  { code: "410", nameDe: "Abwasser-, Wasser-, Gasanlagen", nameEn: "Plumbing & Gas Systems", level: 2, parent: "400" },
  { code: "411", nameDe: "Abwasseranlagen", nameEn: "Drainage Systems", level: 3, parent: "410" },
  { code: "412", nameDe: "Wasseranlagen", nameEn: "Water Supply Systems", level: 3, parent: "410" },
  { code: "413", nameDe: "Gasanlagen", nameEn: "Gas Systems", level: 3, parent: "410" },
  { code: "420", nameDe: "Wärmeversorgungsanlagen", nameEn: "Heating Systems", level: 2, parent: "400" },
  { code: "421", nameDe: "Wärmeerzeugungsanlagen", nameEn: "Heat Generation", level: 3, parent: "420" },
  { code: "422", nameDe: "Wärmeverteilnetze", nameEn: "Heat Distribution", level: 3, parent: "420" },
  { code: "423", nameDe: "Raumheizflächen", nameEn: "Room Heating Surfaces", level: 3, parent: "420" },
  { code: "430", nameDe: "Lufttechnische Anlagen", nameEn: "Ventilation & Air Conditioning", level: 2, parent: "400" },
  { code: "431", nameDe: "Lüftungsanlagen", nameEn: "Ventilation Systems", level: 3, parent: "430" },
  { code: "432", nameDe: "Teilklimaanlagen", nameEn: "Partial AC Systems", level: 3, parent: "430" },
  { code: "433", nameDe: "Klimaanlagen", nameEn: "Full AC Systems", level: 3, parent: "430" },
  { code: "434", nameDe: "Kälteanlagen", nameEn: "Cooling Systems", level: 3, parent: "430" },
  { code: "440", nameDe: "Starkstromanlagen", nameEn: "High-voltage Electrical Systems", level: 2, parent: "400" },
  { code: "441", nameDe: "Hoch- und Mittelspannungsanlagen", nameEn: "High/Medium Voltage", level: 3, parent: "440" },
  { code: "442", nameDe: "Eigenstromversorgungsanlagen", nameEn: "On-site Power Generation", level: 3, parent: "440" },
  { code: "443", nameDe: "Niederspannungsschaltanlagen", nameEn: "Low-voltage Switchgear", level: 3, parent: "440" },
  { code: "444", nameDe: "Niederspannungsinstallationsanlagen", nameEn: "Low-voltage Installation", level: 3, parent: "440" },
  { code: "445", nameDe: "Beleuchtungsanlagen", nameEn: "Lighting Systems", level: 3, parent: "440" },
  { code: "446", nameDe: "Blitzschutz- und Erdungsanlagen", nameEn: "Lightning & Grounding", level: 3, parent: "440" },
  { code: "450", nameDe: "Fernmelde- und informationstechnische Anlagen", nameEn: "Telecommunications & IT", level: 2, parent: "400" },
  { code: "460", nameDe: "Förderanlagen", nameEn: "Conveying Systems (Elevators)", level: 2, parent: "400" },
  { code: "461", nameDe: "Aufzugsanlagen", nameEn: "Elevators", level: 3, parent: "460" },
  { code: "462", nameDe: "Fahrtreppen, Fahrsteige", nameEn: "Escalators & Moving Walks", level: 3, parent: "460" },
  { code: "470", nameDe: "Nutzungsspezifische und verfahrenstechnische Anlagen", nameEn: "Use-specific & Process Systems", level: 2, parent: "400" },
  { code: "480", nameDe: "Gebäude- und Anlagenautomation", nameEn: "Building Automation", level: 2, parent: "400" },
  { code: "490", nameDe: "Sonstige Maßnahmen für Technische Anlagen", nameEn: "Other MEP Measures", level: 2, parent: "400" },

  // KG 500 — Außenanlagen und Freiflächen (External Works)
  { code: "500", nameDe: "Außenanlagen und Freiflächen", nameEn: "External Works & Landscaping", level: 1 },
  { code: "510", nameDe: "Erdbau", nameEn: "Earthworks (External)", level: 2, parent: "500" },
  { code: "520", nameDe: "Gründung, Unterbau", nameEn: "Foundations (External)", level: 2, parent: "500" },
  { code: "530", nameDe: "Oberbau, Deckschichten", nameEn: "Paving & Surface Layers", level: 2, parent: "500" },
  { code: "540", nameDe: "Baukonstruktionen in Außenanlagen", nameEn: "Structures in External Areas", level: 2, parent: "500" },
  { code: "550", nameDe: "Technische Anlagen in Außenanlagen", nameEn: "Services in External Areas", level: 2, parent: "500" },
  { code: "560", nameDe: "Einbauten in Außenanlagen", nameEn: "Fittings in External Areas", level: 2, parent: "500" },
  { code: "570", nameDe: "Vegetationsflächen", nameEn: "Planting Areas", level: 2, parent: "500" },
  { code: "590", nameDe: "Sonstige Außenanlagen", nameEn: "Other External Works", level: 2, parent: "500" },

  // KG 600 — Ausstattung und Kunstwerke (Furnishings & Artwork)
  { code: "600", nameDe: "Ausstattung und Kunstwerke", nameEn: "Furnishings & Artwork", level: 1 },
  { code: "610", nameDe: "Ausstattung", nameEn: "Furnishings", level: 2, parent: "600" },
  { code: "620", nameDe: "Kunstwerke", nameEn: "Artwork", level: 2, parent: "600" },

  // KG 700 — Baunebenkosten (Construction Ancillary Costs)
  { code: "700", nameDe: "Baunebenkosten", nameEn: "Construction Ancillary Costs", level: 1 },
  { code: "710", nameDe: "Bauherrenaufgaben", nameEn: "Client Tasks", level: 2, parent: "700" },
  { code: "720", nameDe: "Vorbereitung der Objektplanung", nameEn: "Preparation of Object Planning", level: 2, parent: "700" },
  { code: "730", nameDe: "Architekten- und Ingenieurleistungen", nameEn: "Architect & Engineer Fees", level: 2, parent: "700" },
  { code: "731", nameDe: "Gebäudeplanung", nameEn: "Building Design", level: 3, parent: "730" },
  { code: "732", nameDe: "Freianlagenplanung", nameEn: "Landscape Design", level: 3, parent: "730" },
  { code: "733", nameDe: "Tragwerksplanung", nameEn: "Structural Engineering", level: 3, parent: "730" },
  { code: "734", nameDe: "Technische Ausrüstung", nameEn: "MEP Engineering", level: 3, parent: "730" },
  { code: "739", nameDe: "Sonstige Ingenieurleistungen", nameEn: "Other Engineering Services", level: 3, parent: "730" },
  { code: "740", nameDe: "Gutachten und Beratung", nameEn: "Expert Reports & Consulting", level: 2, parent: "700" },
  { code: "741", nameDe: "Thermische Bauphysik", nameEn: "Thermal Building Physics", level: 3, parent: "740" },
  { code: "742", nameDe: "Schallschutz und Raumakustik", nameEn: "Sound Insulation & Acoustics", level: 3, parent: "740" },
  { code: "743", nameDe: "Bodenmechanik und Gründungsberatung", nameEn: "Soil Mechanics & Foundation Consulting", level: 3, parent: "740" },
  { code: "744", nameDe: "Vermessung", nameEn: "Surveying", level: 3, parent: "740" },
  { code: "750", nameDe: "Künstlerische Leistungen", nameEn: "Artistic Services", level: 2, parent: "700" },
  { code: "760", nameDe: "Finanzierung", nameEn: "Financing Costs", level: 2, parent: "700" },
  { code: "770", nameDe: "Allgemeine Baunebenkosten", nameEn: "General Ancillary Costs", level: 2, parent: "700" },
  { code: "790", nameDe: "Sonstige Baunebenkosten", nameEn: "Other Ancillary Costs", level: 2, parent: "700" },

  // KG 800 — Finanzierung (Financing) — NOTE: Not part of DIN 276:2018-12 (removed after 1993 edition). Retained for practical cost tracking.
  { code: "800", nameDe: "Finanzierung", nameEn: "Financing", level: 1 },
  { code: "810", nameDe: "Finanzierungskosten", nameEn: "Financing Costs", level: 2, parent: "800" },
  { code: "820", nameDe: "Eigenkapital", nameEn: "Equity", level: 2, parent: "800" },
  { code: "890", nameDe: "Sonstige Finanzierungskosten", nameEn: "Other Financing Costs", level: 2, parent: "800" },
];

// Helpers to navigate DIN 276 hierarchy
export function getDIN276Level1Groups(): DIN276CostGroup[] {
  return DIN276_COST_GROUPS.filter((g) => g.level === 1);
}

export function getDIN276Children(parentCode: string): DIN276CostGroup[] {
  return DIN276_COST_GROUPS.filter((g) => g.parent === parentCode);
}

export function getDIN276GroupByCode(code: string): DIN276CostGroup | undefined {
  return DIN276_COST_GROUPS.find((g) => g.code === code);
}

// ═══════════════════════════════════════════════════════════════
// DIN 276 — COST STAGES (Kostenstufen)
// Maps cost estimation stages to HOAI service phases
// ═══════════════════════════════════════════════════════════════

export interface CostStageDefinition {
  key: string;
  nameDe: string;
  nameEn: string;
  hoaiPhase: LphNumber;
  accuracy: string;
  din276Level: 1 | 2 | 3;
  description: string;
}

export const COST_STAGES: CostStageDefinition[] = [
  {
    key: "kostenrahmen",
    nameDe: "Kostenrahmen",
    nameEn: "Cost Framework",
    hoaiPhase: 1,
    accuracy: "±30–40%",
    din276Level: 1,
    description: "High-level cost framework based on benchmarks and area estimates. KG level 1 only.",
  },
  {
    key: "kostenschaetzung",
    nameDe: "Kostenschätzung",
    nameEn: "Cost Estimate",
    hoaiPhase: 2,
    accuracy: "±20–30%",
    din276Level: 2,
    description: "Preliminary cost estimate based on preliminary design. DIN 276:2018 requires at least KG level 2.",
  },
  {
    key: "kostenberechnung",
    nameDe: "Kostenberechnung",
    nameEn: "Cost Calculation",
    hoaiPhase: 3,
    accuracy: "±10–15%",
    din276Level: 3,
    description: "Detailed cost calculation based on design development. DIN 276:2018 requires at least KG level 3.",
  },
  {
    key: "kostenanschlag",
    nameDe: "Kostenanschlag",
    nameEn: "Cost Tender / Bid Estimate",
    hoaiPhase: 7,
    accuracy: "±5–10%",
    din276Level: 3,
    description: "Cost estimate based on actual tender returns and bid evaluations (LPH 6–7). Full KG level 3 breakdown.",
  },
  {
    key: "kostenfeststellung",
    nameDe: "Kostenfeststellung",
    nameEn: "Final Cost Determination",
    hoaiPhase: 8,
    accuracy: "Actual",
    din276Level: 3,
    description: "Final account of actual costs upon project completion. Full KG level 3 with actuals.",
  },
];

// ═══════════════════════════════════════════════════════════════
// HOAI — FEE CALCULATION (Honorarordnung)
// HOAI 2021 fee structure for Gebäudeplanung (§35)
// ═══════════════════════════════════════════════════════════════

export interface HoaiPhasePercentage {
  lph: LphNumber;
  percentage: number;
}

/**
 * HOAI §35 — Standard fee percentages per Leistungsphase for Gebäudeplanung
 * (Building design/Object planning). Total = 100%.
 */
export const HOAI_PHASE_PERCENTAGES: HoaiPhasePercentage[] = [
  { lph: 1, percentage: 2 },
  { lph: 2, percentage: 7 },
  { lph: 3, percentage: 15 },
  { lph: 4, percentage: 3 },
  { lph: 5, percentage: 25 },
  { lph: 6, percentage: 10 },
  { lph: 7, percentage: 4 },
  { lph: 8, percentage: 32 },
  { lph: 9, percentage: 2 },
];

/**
 * HOAI Honorarzone classification — determines fee level based on complexity.
 * Zone I = simplest, Zone V = most complex.
 */
export const HOAI_FEE_ZONES: Record<HoaiFeeZone, { nameDe: string; nameEn: string; description: string }> = {
  I: { nameDe: "Honorarzone I", nameEn: "Fee Zone I", description: "Very low planning requirements (e.g. simple sheds, garages)" },
  II: { nameDe: "Honorarzone II", nameEn: "Fee Zone II", description: "Low planning requirements (e.g. simple residential, warehouses)" },
  III: { nameDe: "Honorarzone III", nameEn: "Fee Zone III", description: "Average planning requirements (e.g. standard housing, offices)" },
  IV: { nameDe: "Honorarzone IV", nameEn: "Fee Zone IV", description: "Above-average planning requirements (e.g. hospitals, schools)" },
  V: { nameDe: "Honorarzone V", nameEn: "Fee Zone V", description: "Very high planning requirements (e.g. concert halls, laboratories)" },
};

/**
 * HOAI 2021 fee table (Tafel) for Gebäudeplanung — §35
 * Anrechenbare Kosten (eligible costs) thresholds and interpolation boundaries.
 * Values in EUR. Each row: { anrechenbareKosten, minFee (Zone I bottom), maxFee (Zone V top) }
 * In practice, fees are interpolated between zones using linear interpolation.
 * 
 * NOTE: Since HOAI 2021, these are orientation values (Orientierungswerte), no longer mandatory.
 * The table below covers major thresholds for interpolation.
 */
export const HOAI_FEE_TABLE_GEBAEUDE: { anrechenbareKosten: number; fees: Record<HoaiFeeZone, { min: number; max: number }> }[] = [
  {
    anrechenbareKosten: 25000,
    fees: {
      I: { min: 3650, max: 4490 },
      II: { min: 4490, max: 5580 },
      III: { min: 5580, max: 6670 },
      IV: { min: 6670, max: 7920 },
      V: { min: 7920, max: 9170 },
    },
  },
  {
    anrechenbareKosten: 50000,
    fees: {
      I: { min: 5930, max: 7290 },
      II: { min: 7290, max: 9070 },
      III: { min: 9070, max: 10830 },
      IV: { min: 10830, max: 12870 },
      V: { min: 12870, max: 14900 },
    },
  },
  {
    anrechenbareKosten: 150000,
    fees: {
      I: { min: 13160, max: 16180 },
      II: { min: 16180, max: 20120 },
      III: { min: 20120, max: 24040 },
      IV: { min: 24040, max: 28560 },
      V: { min: 28560, max: 33070 },
    },
  },
  {
    anrechenbareKosten: 300000,
    fees: {
      I: { min: 21370, max: 26270 },
      II: { min: 26270, max: 32660 },
      III: { min: 32660, max: 39030 },
      IV: { min: 39030, max: 46370 },
      V: { min: 46370, max: 53680 },
    },
  },
  {
    anrechenbareKosten: 500000,
    fees: {
      I: { min: 30240, max: 37190 },
      II: { min: 37190, max: 46240 },
      III: { min: 46240, max: 55260 },
      IV: { min: 55260, max: 65650 },
      V: { min: 65650, max: 76010 },
    },
  },
  {
    anrechenbareKosten: 1000000,
    fees: {
      I: { min: 49130, max: 60420 },
      II: { min: 60420, max: 75120 },
      III: { min: 75120, max: 89750 },
      IV: { min: 89750, max: 106630 },
      V: { min: 106630, max: 123440 },
    },
  },
  {
    anrechenbareKosten: 2000000,
    fees: {
      I: { min: 79800, max: 98130 },
      II: { min: 98130, max: 122000 },
      III: { min: 122000, max: 145760 },
      IV: { min: 145760, max: 173170 },
      V: { min: 173170, max: 200500 },
    },
  },
  {
    anrechenbareKosten: 5000000,
    fees: {
      I: { min: 145660, max: 179100 },
      II: { min: 179100, max: 222660 },
      III: { min: 222660, max: 266080 },
      IV: { min: 266080, max: 316100 },
      V: { min: 316100, max: 365970 },
    },
  },
  {
    anrechenbareKosten: 10000000,
    fees: {
      I: { min: 236560, max: 290900 },
      II: { min: 290900, max: 361700 },
      III: { min: 361700, max: 432200 },
      IV: { min: 432200, max: 513500 },
      V: { min: 513500, max: 594570 },
    },
  },
  {
    anrechenbareKosten: 25000000,
    fees: {
      I: { min: 443370, max: 545270 },
      II: { min: 545270, max: 677980 },
      III: { min: 677980, max: 810000 },
      IV: { min: 810000, max: 962390 },
      V: { min: 962390, max: 1114310 },
    },
  },
];

/**
 * HOAI Fachplanungsleistungen (specialist planning services) — percentage shares
 * for Tragwerksplanung (structural) and Technische Ausrüstung (MEP).
 */
export const HOAI_SPECIALIST_PHASE_PERCENTAGES: Record<string, HoaiPhasePercentage[]> = {
  tragwerksplanung: [
    { lph: 1, percentage: 3 },
    { lph: 2, percentage: 10 },
    { lph: 3, percentage: 15 },
    { lph: 4, percentage: 30 },
    { lph: 5, percentage: 40 },
    { lph: 6, percentage: 2 },
    { lph: 7, percentage: 0 },
    { lph: 8, percentage: 0 },
    { lph: 9, percentage: 0 },
  ],
  technische_ausruestung: [
    { lph: 1, percentage: 2 },
    { lph: 2, percentage: 9 },
    { lph: 3, percentage: 17 },
    { lph: 4, percentage: 2 },
    { lph: 5, percentage: 22 },
    { lph: 6, percentage: 7 },
    { lph: 7, percentage: 5 },
    { lph: 8, percentage: 34 },
    { lph: 9, percentage: 2 },
  ],
};

// ═══════════════════════════════════════════════════════════════
// VOB — VERGABE- UND VERTRAGSORDNUNG FÜR BAULEISTUNGEN
// German construction tendering and contract regulations
// ═══════════════════════════════════════════════════════════════

/**
 * VOB/A — Tendering procedures (Vergabearten)
 */
export const VOB_TENDERING_PROCEDURES = [
  { value: "oeffentliche_ausschreibung", nameDe: "Öffentliche Ausschreibung", nameEn: "Open Tendering", description: "Public invitation, any qualified company may bid. §3 VOB/A" },
  { value: "beschraenkte_ausschreibung", nameDe: "Beschränkte Ausschreibung", nameEn: "Restricted Tendering", description: "Only pre-selected companies are invited to bid. §3 VOB/A" },
  { value: "beschraenkte_ausschreibung_mit_tw", nameDe: "Beschränkte Ausschreibung mit Teilnahmewettbewerb", nameEn: "Restricted Tendering with Competition", description: "Pre-qualification phase followed by invitation. §3 VOB/A" },
  { value: "verhandlungsvergabe", nameDe: "Verhandlungsvergabe", nameEn: "Negotiated Procedure", description: "Direct negotiations with selected companies. §3 VOB/A" },
  { value: "verhandlungsvergabe_mit_tw", nameDe: "Verhandlungsvergabe mit Teilnahmewettbewerb", nameEn: "Negotiated Procedure with Competition", description: "Pre-qualification then negotiation. §3 VOB/A" },
  { value: "wettbewerblicher_dialog", nameDe: "Wettbewerblicher Dialog", nameEn: "Competitive Dialogue", description: "Multi-stage dialogue to develop solutions. EU threshold. §3 VOB/A EU" },
  { value: "direktauftrag", nameDe: "Direktauftrag", nameEn: "Direct Award", description: "Direct contract without formal procedure. Below threshold. §3 VOB/A" },
] as const;

/**
 * VOB/B — Key contract terms and milestones
 * These represent standard contractual events in a VOB/B construction contract.
 */
export const VOB_CONTRACT_MILESTONES = [
  { value: "zuschlag", nameDe: "Zuschlagserteilung", nameEn: "Contract Award", description: "Formal acceptance of the bid and contract formation. §18 VOB/A" },
  { value: "ausfuehrungsbeginn", nameDe: "Ausführungsbeginn", nameEn: "Commencement of Works", description: "Contractor begins physical work on site. §5 VOB/B" },
  { value: "abnahme", nameDe: "Abnahme", nameEn: "Formal Acceptance", description: "Client formally accepts the completed works. §12 VOB/B" },
  { value: "maengelanzeige", nameDe: "Mängelanzeige", nameEn: "Defect Notification", description: "Notification of defects discovered during or after works. §13 VOB/B" },
  { value: "maengelbeseitigung", nameDe: "Mängelbeseitigung", nameEn: "Defect Rectification", description: "Contractor obligation to remedy defects. §13 Abs. 5 VOB/B" },
  { value: "schlussrechnung", nameDe: "Schlussrechnung", nameEn: "Final Invoice", description: "Contractor submits final account. §14 VOB/B" },
  { value: "schlusszahlung", nameDe: "Schlusszahlung", nameEn: "Final Payment", description: "Client makes final payment after verification. §16 VOB/B" },
  { value: "gewaehrleistungsende", nameDe: "Gewährleistungsende", nameEn: "End of Warranty Period", description: "Expiry of defect liability period (typically 4 years VOB/B). §13 Abs. 4 VOB/B" },
] as const;

/**
 * VOB/B — Nachtrag (variation/change order) types
 * §2 Abs. 5, 6, 7, 8 VOB/B
 */
export const VOB_NACHTRAG_TYPES = [
  { value: "mengenabweichung", nameDe: "Mengenabweichung", nameEn: "Quantity Deviation", description: "Deviation >10% from tendered quantities. §2 Abs. 3 VOB/B", vobRef: "§2 Abs. 3" },
  { value: "geaenderte_leistung", nameDe: "Geänderte Leistung", nameEn: "Changed Scope", description: "Client-instructed change to contracted scope. §2 Abs. 5 VOB/B", vobRef: "§2 Abs. 5" },
  { value: "zusaetzliche_leistung", nameDe: "Zusätzliche Leistung", nameEn: "Additional Scope", description: "New work not in original contract, ordered by client. §2 Abs. 6 VOB/B", vobRef: "§2 Abs. 6" },
  { value: "selbst_uebernahme", nameDe: "Selbstübernahme", nameEn: "Self-performance", description: "Client performs work originally contracted. §2 Abs. 4 VOB/B", vobRef: "§2 Abs. 4" },
  { value: "behinderung", nameDe: "Behinderungsanzeige / Mehrkosten", nameEn: "Disruption / Additional Costs", description: "Costs arising from obstruction or delay by client. §6 VOB/B", vobRef: "§6" },
  { value: "stundenlohn", nameDe: "Stundenlohnarbeiten", nameEn: "Daywork / Hourly Rate", description: "Work executed on daywork/hourly basis. §2 Abs. 10 VOB/B", vobRef: "§2 Abs. 10" },
] as const;

/**
 * VOB/B — Payment types and schedule milestones
 */
export const VOB_PAYMENT_TYPES = [
  { value: "abschlagszahlung", nameDe: "Abschlagszahlung", nameEn: "Interim Payment", description: "Progress payment based on work performed. §16 Abs. 1 VOB/B" },
  { value: "teilschlussrechnung", nameDe: "Teilschlussrechnung", nameEn: "Partial Final Invoice", description: "Final invoice for a completed section of works." },
  { value: "schlussrechnung", nameDe: "Schlussrechnung", nameEn: "Final Invoice", description: "Contractor's final account for all works. §14 VOB/B" },
  { value: "sicherheitseinbehalt", nameDe: "Sicherheitseinbehalt", nameEn: "Retention", description: "Retention amount withheld as security (typically 5%). §17 VOB/B" },
] as const;

/**
 * VOB/B — Standard Gewährleistung (warranty/defect liability) periods
 */
export const VOB_WARRANTY_PERIODS = {
  standard_vob: { years: 4, description: "Standard VOB/B warranty period (§13 Abs. 4 Nr. 1 VOB/B)" },
  standard_bgb: { years: 5, description: "Standard BGB warranty period (§634a BGB — for non-VOB contracts)" },
  fire_protection: { years: 5, description: "Extended period for fire-protection-relevant works" },
  waterproofing: { years: 5, description: "Extended period for waterproofing works (Abdichtung)" },
} as const;

/**
 * VOB/C — ATV (Allgemeine Technische Vertragsbedingungen) reference list
 * Key DIN 18xxx norms for trade-specific technical specifications.
 */
export const VOB_C_ATV_REFERENCES = [
  { din: "DIN 18299", nameDe: "Allgemeine Regelungen für Bauarbeiten jeder Art", nameEn: "General Rules for All Construction Works" },
  { din: "DIN 18300", nameDe: "Erdarbeiten", nameEn: "Earthworks" },
  { din: "DIN 18330", nameDe: "Mauerarbeiten", nameEn: "Masonry Works" },
  { din: "DIN 18331", nameDe: "Betonarbeiten", nameEn: "Concrete Works" },
  { din: "DIN 18332", nameDe: "Naturwerksteinarbeiten", nameEn: "Natural Stone Works" },
  { din: "DIN 18333", nameDe: "Betonwerksteinarbeiten", nameEn: "Precast Concrete Works" },
  { din: "DIN 18334", nameDe: "Zimmer- und Holzbauarbeiten", nameEn: "Timber & Carpentry Works" },
  { din: "DIN 18335", nameDe: "Stahlbauarbeiten", nameEn: "Steelwork" },
  { din: "DIN 18336", nameDe: "Abdichtungsarbeiten", nameEn: "Waterproofing Works" },
  { din: "DIN 18338", nameDe: "Dachdeckungs- und Dachabdichtungsarbeiten", nameEn: "Roofing & Roof Sealing" },
  { din: "DIN 18339", nameDe: "Klempnerarbeiten", nameEn: "Sheet Metal Works" },
  { din: "DIN 18340", nameDe: "Trockenbauarbeiten", nameEn: "Dry Construction (Drywall)" },
  { din: "DIN 18345", nameDe: "Wärmedämm-Verbundsysteme", nameEn: "External Thermal Insulation (ETICS)" },
  { din: "DIN 18349", nameDe: "Betonerhaltungsarbeiten", nameEn: "Concrete Repair Works" },
  { din: "DIN 18350", nameDe: "Putz- und Stuckarbeiten", nameEn: "Plastering & Stucco" },
  { din: "DIN 18351", nameDe: "Vorgehängte hinterlüftete Fassaden", nameEn: "Ventilated Façades" },
  { din: "DIN 18352", nameDe: "Fliesen- und Plattenarbeiten", nameEn: "Tiling Works" },
  { din: "DIN 18353", nameDe: "Estricharbeiten", nameEn: "Screed Works" },
  { din: "DIN 18354", nameDe: "Gussasphaltarbeiten", nameEn: "Mastic Asphalt Works" },
  { din: "DIN 18355", nameDe: "Tischlerarbeiten", nameEn: "Joinery Works" },
  { din: "DIN 18356", nameDe: "Parkettarbeiten", nameEn: "Parquet Works" },
  { din: "DIN 18357", nameDe: "Beschlagarbeiten", nameEn: "Ironmongery Works" },
  { din: "DIN 18358", nameDe: "Rollladenarbeiten", nameEn: "Roller Shutter Works" },
  { din: "DIN 18360", nameDe: "Metallbauarbeiten", nameEn: "Metalwork" },
  { din: "DIN 18361", nameDe: "Verglasungsarbeiten", nameEn: "Glazing Works" },
  { din: "DIN 18363", nameDe: "Maler- und Lackierarbeiten", nameEn: "Painting & Coating" },
  { din: "DIN 18365", nameDe: "Bodenbelagarbeiten", nameEn: "Floor Covering Works" },
  { din: "DIN 18366", nameDe: "Tapezierarbeiten", nameEn: "Wallpapering" },
  { din: "DIN 18379", nameDe: "Raumlufttechnische Anlagen", nameEn: "HVAC Installations" },
  { din: "DIN 18380", nameDe: "Heizanlagen und zentrale Wassererwärmungsanlagen", nameEn: "Heating & Hot Water Systems" },
  { din: "DIN 18381", nameDe: "Gas-, Wasser- und Entwässerungsanlagen", nameEn: "Gas, Water & Drainage" },
  { din: "DIN 18382", nameDe: "Nieder- und Mittelspannungsanlagen", nameEn: "Low/Medium Voltage Electrical" },
  { din: "DIN 18384", nameDe: "Blitzschutzanlagen", nameEn: "Lightning Protection" },
  { din: "DIN 18385", nameDe: "Förderanlagen", nameEn: "Conveying Systems" },
  { din: "DIN 18386", nameDe: "Gebäudeautomation", nameEn: "Building Automation" },
] as const;

// ═══════════════════════════════════════════════════════════════
// GAEB — GEMEINSAMER AUSSCHUSS ELEKTRONIK IM BAUWESEN
// Standard electronic data exchange for construction
// ═══════════════════════════════════════════════════════════════

/**
 * GAEB exchange phase types — maps to project lifecycle
 */
export const GAEB_EXCHANGE_PHASES = [
  { value: "gaeb_81", extension: ".x81", nameDe: "Kostenansatz (Kostenschätzung)", nameEn: "Cost Estimate Data", description: "Cost estimation data exchange — maps to DIN 276 Kostenschätzung." },
  { value: "gaeb_82", extension: ".x82", nameDe: "Kostenanschlag (Vergabeeinheit)", nameEn: "Cost Tender Estimate Data", description: "Cost data per procurement unit — maps to DIN 276 Kostenanschlag." },
  { value: "gaeb_83", extension: ".x83", nameDe: "Ausschreibung (Leistungsverzeichnis)", nameEn: "Tender (Bill of Quantities)", description: "Tender-phase BoQ sent to bidders — no prices." },
  { value: "gaeb_84", extension: ".x84", nameDe: "Angebotsabgabe", nameEn: "Bid Submission", description: "Bidder returns priced BoQ." },
  { value: "gaeb_85", extension: ".x85", nameDe: "Nebenangebot", nameEn: "Alternative Bid", description: "Bidder submits alternative/variant offer." },
  { value: "gaeb_86", extension: ".x86", nameDe: "Auftrag", nameEn: "Contract Award", description: "Awarded contract (priced BoQ as contract basis)." },
  { value: "gaeb_87", extension: ".x87", nameDe: "Aufmaß", nameEn: "Measurement / Quantity Survey", description: "As-built quantity records for invoicing." },
  { value: "gaeb_89", extension: ".x89", nameDe: "Nachtrag", nameEn: "Variation Order", description: "Change/variation order data exchange." },
  { value: "gaeb_90", extension: ".x90", nameDe: "Katalogdaten", nameEn: "Catalogue Data", description: "Product catalogue data exchange." },
  { value: "gaeb_da11", extension: ".x11", nameDe: "Mengenermittlung", nameEn: "Quantity Determination", description: "Quantity take-off data." },
] as const;

/**
 * GAEB Leistungsverzeichnis (BoQ) hierarchy
 */
export const GAEB_LV_HIERARCHY = [
  { level: "los", nameDe: "Los", nameEn: "Lot", description: "Top-level grouping (optional)" },
  { level: "titel", nameDe: "Titel / Abschnitt", nameEn: "Title / Section", description: "Section grouping within a BoQ" },
  { level: "position", nameDe: "Position", nameEn: "Item / Position", description: "Individual line item with quantity and unit" },
] as const;

/**
 * Common GAEB position types
 */
export const GAEB_POSITION_TYPES = [
  { value: "normalposition", nameDe: "Normalposition", nameEn: "Standard Item", description: "Standard priced item with quantity and unit price" },
  { value: "alternativposition", nameDe: "Alternativposition", nameEn: "Alternative Item", description: "Alternative to another position (not summed by default)" },
  { value: "eventuaposition", nameDe: "Eventualposition", nameEn: "Provisional Item", description: "May or may not be executed (contingency)" },
  { value: "bedarfsposition", nameDe: "Bedarfsposition", nameEn: "As-needed Item", description: "Executed only if required" },
  { value: "grundposition", nameDe: "Grundposition", nameEn: "Base Item", description: "Base item with linked alternative" },
  { value: "wahlposition", nameDe: "Wahlposition", nameEn: "Optional Item", description: "Optional upgrade/choice item" },
  { value: "zuschlagsposition", nameDe: "Zuschlagsposition", nameEn: "Surcharge Item", description: "Additional surcharge on another position" },
  { value: "pauschalposition", nameDe: "Pauschalposition", nameEn: "Lump Sum Item", description: "Lump-sum item without quantity breakdown" },
  { value: "stundenlohnarbeiten", nameDe: "Stundenlohnarbeiten", nameEn: "Daywork Item", description: "Time-based (hourly) work item" },
] as const;

// ═══════════════════════════════════════════════════════════════
// ADDITIONAL GERMAN REGULATORY STANDARDS
// ═══════════════════════════════════════════════════════════════

/**
 * GEG (Gebäudeenergiegesetz) — Building Energy Act
 * Replaces EnEV + EEWärmeG since Nov 2020.
 */
export const GEG_REQUIREMENTS = [
  { value: "energieausweis", nameDe: "Energieausweis", nameEn: "Energy Certificate", description: "Mandatory energy performance certificate for buildings" },
  { value: "waermeschutznachweis", nameDe: "Wärmeschutznachweis", nameEn: "Thermal Protection Proof", description: "Proof of thermal insulation compliance" },
  { value: "primaerenergiebedarf", nameDe: "Primärenergiebedarf", nameEn: "Primary Energy Demand", description: "Maximum allowed primary energy consumption" },
  { value: "erneuerbare_energien", nameDe: "Erneuerbare Energien Anteil", nameEn: "Renewable Energy Share", description: "Minimum renewable energy share requirement" },
] as const;

/**
 * Bauordnung — Building Permit Authority Submissions
 * Key regulatory submissions in the German building permit process.
 */
export const BAUORDNUNG_SUBMISSIONS = [
  { value: "bauvoranfrage", nameDe: "Bauvoranfrage", nameEn: "Preliminary Building Enquiry", description: "Pre-application enquiry to planning authority" },
  { value: "bauantrag", nameDe: "Bauantrag", nameEn: "Building Permit Application", description: "Formal building permit application (LPH 4)" },
  { value: "baugenehmigung", nameDe: "Baugenehmigung", nameEn: "Building Permit", description: "Granted building permit" },
  { value: "baubeginn_anzeige", nameDe: "Baubeginnanzeige", nameEn: "Commencement Notice", description: "Mandatory notice to authority before starting works" },
  { value: "rohbauabnahme", nameDe: "Rohbauabnahme", nameEn: "Structural Completion Inspection", description: "Authority inspection at structural completion" },
  { value: "schlussabnahme", nameDe: "Schlussabnahme (behördlich)", nameEn: "Final Authority Inspection", description: "Final inspection before occupancy" },
  { value: "nutzungsaenderung", nameDe: "Nutzungsänderung", nameEn: "Change of Use Application", description: "Application for change of building use" },
] as const;

/**
 * SiGeKo — Sicherheits- und Gesundheitsschutzkoordinator
 * Safety and Health Coordination per Baustellenverordnung (BaustellV).
 */
export const SIGEKO_DOCUMENTS = [
  { value: "sigeko_plan", nameDe: "Sicherheits- und Gesundheitsschutzplan (SiGePlan)", nameEn: "Health & Safety Plan", description: "Mandatory H&S plan per BaustellV §2" },
  { value: "vorankuendigung", nameDe: "Vorankündigung", nameEn: "Prior Notice to Authority", description: "Advance notification to H&S authority. Required if >20 workers or >500 person-days" },
  { value: "unterlage", nameDe: "Unterlage für spätere Arbeiten", nameEn: "File for Future Maintenance", description: "Documentation for safe future maintenance & repair" },
] as const;

/**
 * Brandschutz — Fire Protection compliance documents
 */
export const BRANDSCHUTZ_REQUIREMENTS = [
  { value: "brandschutzkonzept", nameDe: "Brandschutzkonzept", nameEn: "Fire Protection Concept", description: "Fire safety concept prepared by fire protection planner" },
  { value: "brandschutznachweis", nameDe: "Brandschutznachweis", nameEn: "Fire Protection Certificate", description: "Statutory fire protection proof (Bauvorlage)" },
  { value: "flucht_rettungsplan", nameDe: "Flucht- und Rettungsplan", nameEn: "Escape & Rescue Plan", description: "Emergency evacuation plans per ASR A2.3" },
  { value: "feuerwiderstandsklassen", nameDe: "Feuerwiderstandsklassen", nameEn: "Fire Resistance Classes", description: "Classification of building elements (F30, F60, F90, etc.)" },
] as const;

/**
 * AHO — Fee structure for Projektsteuerung / Project Management
 * AHO-Schriftenreihe Nr. 9 — for project management services.
 */
export const AHO_PROJECT_MANAGEMENT_PHASES = [
  { phase: 1, nameDe: "Projektvorbereitung", nameEn: "Project Preparation", percentage: 9 },
  { phase: 2, nameDe: "Planung", nameEn: "Planning", percentage: 26 },
  { phase: 3, nameDe: "Ausführungsvorbereitung", nameEn: "Execution Preparation", percentage: 22 },
  { phase: 4, nameDe: "Ausführung", nameEn: "Execution", percentage: 35 },
  { phase: 5, nameDe: "Projektabschluss", nameEn: "Project Closeout", percentage: 8 },
] as const;

export const AHO_HANDLUNGSBEREICHE = [
  { key: "A", nameDe: "Organisation, Information, Koordination und Dokumentation", nameEn: "Organisation, Information, Coordination & Documentation" },
  { key: "B", nameDe: "Qualitäten und Quantitäten", nameEn: "Qualities & Quantities" },
  { key: "C", nameDe: "Kosten und Finanzierung", nameEn: "Costs & Financing" },
  { key: "D", nameDe: "Termine, Kapazitäten und Logistik", nameEn: "Schedule, Capacities & Logistics" },
  { key: "E", nameDe: "Verträge und Versicherungen", nameEn: "Contracts & Insurance" },
] as const;

// ═══════════════════════════════════════════════════════════════
// PROJECT LIFECYCLE STATE MACHINE
// ═══════════════════════════════════════════════════════════════

export const PROJECT_LIFECYCLE_STATES: Record<ProjectLifecycleState, { label: string; labelDe: string; description: string }> = {
  input_received: { label: "Input Received", labelDe: "Eingabe erhalten", description: "Raw input exists in intake engine" },
  parsed: { label: "Parsed", labelDe: "Analysiert", description: "System has extracted candidate structure" },
  needs_review: { label: "Needs Review", labelDe: "Prüfung erforderlich", description: "Human review required before project truth" },
  confirmed: { label: "Confirmed", labelDe: "Bestätigt", description: "Candidate accepted by responsible user" },
  structure_approved: { label: "Structure Approved", labelDe: "Struktur freigegeben", description: "Structured project description and resources formally approved" },
  cost_ready: { label: "Cost Ready", labelDe: "Kosten bereit", description: "Cost estimate can be generated from approved state" },
  detail_ready: { label: "Detail Ready", labelDe: "Detailplanung bereit", description: "Detailed planning and packaging sufficient for tender prep" },
  tender_ready: { label: "Tender Ready", labelDe: "Vergabe bereit", description: "All release prerequisites are complete" },
  released_for_tender: { label: "Released for Tender", labelDe: "Zur Vergabe freigegeben", description: "Tender package formally released" },
};

export const PROJECT_STATE_TRANSITIONS: StateTransitionRule[] = [
  // Automatic transitions (system-driven)
  { from: "input_received", to: "parsed", automatic: true, humanRequired: false, description: "AI pipeline completes parsing" },
  { from: "parsed", to: "needs_review", automatic: true, humanRequired: false, description: "Low confidence triggers review" },
  { from: "parsed", to: "confirmed", automatic: false, humanRequired: true, description: "User confirms parsed output" },
  // Human-required transitions
  { from: "needs_review", to: "confirmed", automatic: false, humanRequired: true, description: "User confirms after review" },
  { from: "confirmed", to: "structure_approved", automatic: false, humanRequired: true, description: "Architect approves SPD" },
  { from: "structure_approved", to: "cost_ready", automatic: false, humanRequired: true, description: "Cost estimate signed off" },
  { from: "cost_ready", to: "detail_ready", automatic: false, humanRequired: true, description: "Package structure defined and approved" },
  { from: "detail_ready", to: "tender_ready", automatic: false, humanRequired: true, description: "All tender prerequisites complete" },
  { from: "tender_ready", to: "released_for_tender", automatic: false, humanRequired: true, description: "Explicit human release action" },
];

/**
 * Get allowed next states from a given lifecycle state.
 */
export function getAllowedTransitions(currentState: ProjectLifecycleState): ProjectLifecycleState[] {
  return PROJECT_STATE_TRANSITIONS
    .filter(t => t.from === currentState)
    .map(t => t.to);
}

/**
 * Check if a transition is valid.
 */
export function isValidTransition(from: ProjectLifecycleState, to: ProjectLifecycleState): boolean {
  return PROJECT_STATE_TRANSITIONS.some(t => t.from === from && t.to === to);
}

// ═══════════════════════════════════════════════════════════════
// READINESS RULES (Checklist-Backed)
// ═══════════════════════════════════════════════════════════════

export const READINESS_RULES = {
  spd: {
    level: "spd",
    label: "Structured Description Readiness",
    labelDe: "Projektbeschreibung Bereitschaft",
    checks: [
      { key: "spd_exists", label: "Structured project description created" },
      { key: "spd_name", label: "Project name defined" },
      { key: "spd_goal", label: "Project goal defined" },
      { key: "spd_type", label: "Project type defined" },
      { key: "spd_location", label: "Location defined" },
      { key: "spd_scope", label: "Scope of work defined" },
      { key: "spd_participants", label: "Participants identified" },
      { key: "spd_approved_resources", label: "Approved resources selected" },
      { key: "spd_open_points", label: "Open points captured" },
      { key: "spd_approved", label: "Description approved by architect/lead" },
    ],
  },
  cost: {
    level: "cost",
    label: "Cost Estimate Readiness",
    labelDe: "Kostenschätzung Bereitschaft",
    checks: [
      { key: "cost_structure_approved", label: "Project structure approved" },
      { key: "cost_groups_created", label: "DIN 276 cost groups created" },
      { key: "cost_items_present", label: "Cost line items present" },
      { key: "cost_approved_resources", label: "Required approved resources present" },
      { key: "cost_snapshot_exists", label: "Cost snapshot created" },
      { key: "cost_snapshot_approved", label: "Cost estimate signed off" },
    ],
  },
  detail: {
    level: "detail",
    label: "Detailed Planning Readiness",
    labelDe: "Detailplanung Bereitschaft",
    checks: [
      { key: "detail_packages_defined", label: "Package structure defined" },
      { key: "detail_package_descriptions", label: "Package descriptions present" },
      { key: "detail_documents_linked", label: "Relevant documents linked" },
      { key: "detail_cost_linked", label: "Cost linked to packages" },
      { key: "detail_critical_gaps", label: "Critical gaps reduced to threshold" },
      { key: "detail_packages_approved", label: "Package definitions approved" },
    ],
  },
  tender: {
    level: "tender",
    label: "Tender Readiness",
    labelDe: "Vergabe Bereitschaft",
    checks: [
      { key: "tender_all_approvals", label: "All mandatory approvals complete" },
      { key: "tender_approved_resources", label: "Required approved resources complete" },
      { key: "tender_cost_signed_off", label: "Cost estimate signed off" },
      { key: "tender_packages_complete", label: "Package definition complete" },
      { key: "tender_spd_approved", label: "Project description approved" },
      { key: "tender_release_available", label: "Tender release object available" },
      { key: "tender_released", label: "Tender formally released" },
    ],
  },
} as const;

// ═══════════════════════════════════════════════════════════════
// TENDER RELEASE PREREQUISITES
// ═══════════════════════════════════════════════════════════════

export const TENDER_RELEASE_PREREQUISITES = [
  { key: "spd_approved", label: "Structured project description approved", category: "structure" },
  { key: "approved_resources_complete", label: "All required resources approved", category: "documents" },
  { key: "cost_estimate_approved", label: "Cost estimate signed off", category: "cost" },
  { key: "packages_defined", label: "All tender packages defined", category: "packages" },
  { key: "packages_ready", label: "All packages marked tender-ready", category: "packages" },
  { key: "mandatory_approvals", label: "All mandatory approvals complete", category: "approvals" },
  { key: "gate_d_complete", label: "Gate D (Tender Preparation) complete", category: "gates" },
] as const;
