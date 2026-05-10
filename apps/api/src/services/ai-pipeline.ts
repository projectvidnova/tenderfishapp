/**
 * AI Pipeline service — fact extraction, classification, structure generation,
 * cost estimation, and regulatory compliance analysis using the Anthropic Claude API.
 *
 * Standards integrated:
 * - HOAI (Leistungsphasen 1–9, fee calculation)
 * - DIN 276 (Kostengruppen, cost stages)
 * - VOB (tendering procedures, contract types)
 * - GAEB (data exchange awareness)
 * - GEG, Bauordnung, Brandschutz, SiGeKo compliance
 */

import { aiChat, aiVision, type VisionImageMediaType } from "../lib/ai-client";
import { isVisionSupportedImageMime } from "./file-parser";
import { getEnv } from "../lib/env";
import OpenAI from "openai";
import { z } from "zod";
import { parseFile, type FileParseInput } from "./file-parser";

function parseModelJson<T>(rawText: string): T {
  const normalized = rawText.trim();

  try {
    return JSON.parse(normalized) as T;
  } catch {
    // continue with salvage strategies
  }

  // Strip markdown code fences if the model included them.
  const withoutFences = normalized
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  // Extract the largest JSON object/array payload.
  const objectStart = withoutFences.indexOf("{");
  const objectEnd = withoutFences.lastIndexOf("}");
  const arrayStart = withoutFences.indexOf("[");
  const arrayEnd = withoutFences.lastIndexOf("]");
  const useObject =
    objectStart !== -1 && objectEnd !== -1 && objectStart < objectEnd;
  const useArray = arrayStart !== -1 && arrayEnd !== -1 && arrayStart < arrayEnd;

  let candidate = withoutFences;
  if (useObject && (!useArray || objectStart <= arrayStart)) {
    candidate = withoutFences.slice(objectStart, objectEnd + 1);
  } else if (useArray) {
    candidate = withoutFences.slice(arrayStart, arrayEnd + 1);
  }

  // Remove common JSON-breaking trailing commas.
  candidate = candidate.replace(/,\s*([}\]])/g, "$1");

  return JSON.parse(candidate) as T;
}

async function parseOrRepairModelJson<T>(
  rawText: string,
  schemaHint: string
): Promise<T> {
  try {
    return parseModelJson<T>(rawText);
  } catch (initialError) {
    const repaired = await aiChat({
      maxTokens: 4096,
      messages: [
        {
          role: "user",
          content: `Repair the following malformed JSON so it is strictly valid JSON matching the requested schema.\n\nSchema hint:\n${schemaHint}\n\nMalformed JSON:\n${rawText}`,
        },
      ],
      system:
        "You are a JSON repair tool. Return ONLY valid JSON. No markdown, no explanation.",
    });

    try {
      return parseModelJson<T>(repaired);
    } catch (repairError) {
      const initialMessage =
        initialError instanceof Error ? initialError.message : "Unknown parse error";
      const repairMessage =
        repairError instanceof Error ? repairError.message : "Unknown repair parse error";
      throw new Error(`Failed to parse AI JSON output. Initial: ${initialMessage}. Repair: ${repairMessage}`);
    }
  }
}

// ─── Step 2: Fact Extraction ───────────────────────────────────

interface ExtractedFact {
  field: string;
  value: string | null;
  data_state: "CONFIRMED" | "DERIVED" | "UNCLEAR" | "MISSING";
  source_quote: string | null;
  confidence: number;
}

interface FactExtractionResult {
  facts: ExtractedFact[];
}

export async function extractFacts(
  documentText: string,
  formContext?: Record<string, string>
): Promise<FactExtractionResult> {
  const contextSection = formContext
    ? `\n\nUser-provided context:\n${Object.entries(formContext)
        .filter(([, v]) => v)
        .map(([k, v]) => `- ${k}: ${v}`)
        .join("\n")}`
    : "";

  const env = getEnv();

  const text = await aiChat({
    maxTokens: env.AI_MAX_TOKENS_EXTRACT,
    messages: [
      {
        role: "user",
        content: `Analyse the following project material and extract structured facts.${contextSection}\n\n--- PROJECT MATERIAL ---\n${documentText.slice(0, env.AI_FACT_EXTRACTION_MAX_CHARS)}`,
      },
    ],
    system: `You are an expert AI project analyst for German architectural projects under HOAI (Honorarordnung für Architekten und Ingenieure), with deep knowledge of DIN 276 cost classification, VOB tendering regulations, GAEB data exchange, and German building regulations (Bauordnung, GEG, Brandschutz, SiGeKo).

Extract structured facts from the input material. For each fact, assign a data_state:
- CONFIRMED: Explicitly stated in the source material
- DERIVED: Logically inferred from context but not directly stated
- UNCLEAR: Ambiguous, contradictory, or partially mentioned
- MISSING: Required but not found in any source

Return ONLY valid JSON. No preamble. No markdown fences. No explanation.

Schema:
{
  "facts": [
    {
      "field": "string (snake_case field name)",
      "value": "string or null",
      "data_state": "CONFIRMED|DERIVED|UNCLEAR|MISSING",
      "source_quote": "string or null (brief quote from source)",
      "confidence": 0.0-1.0
    }
  ]
}

Required fields to extract:
— Project basics: project_name, project_type, location, client_name, client_representative, decision_authority, scope_description, procurement_model, target_completion, known_deadlines, known_consultants, known_constraints, mentioned_risks, mentioned_approvals, lph_start_estimate
— Cost (DIN 276): estimated_construction_cost, cost_group_300_estimate, cost_group_400_estimate, cost_group_500_estimate, cost_group_700_estimate, gross_floor_area_bgf, net_floor_area_ngf, cost_per_sqm_estimate, mentioned_budget_limit, funding_source
— HOAI: hoai_fee_zone, hoai_service_scope, commissioned_phases, special_services_mentioned
— VOB: procurement_model_vob, tendering_procedure_type, known_trade_packages, contract_type_preference
— Regulatory: building_permit_status, fire_protection_class, energy_standard, heritage_protection, environmental_requirements, accessibility_requirements, sigeko_required
— BauVorlV document checks: bauvorlv_category, document_date, scale_metric, has_certified_signature

For BauVorlV fields use these normalized conventions:
- bauvorlv_category values: cadastral_map | site_plan | construction_drawings | structural_proofs | fire_protection_plan | noise_heat_insulation | other
- document_date format: YYYY-MM-DD when present
- scale_metric examples: 1:100, 1:200 (preserve explicit notation found in source)
- has_certified_signature: "true" | "false" as string value`,
  });

  return parseOrRepairModelJson<FactExtractionResult>(
    text,
    'Object with key "facts": array of extracted fact objects'
  );
}

// ─── Step 3: Project Classification ────────────────────────────

interface ClassificationResult {
  type: string;
  delivery_model: string;
  planning_state: string;
  complexity_level: string;
  lph_current: number;
  lph_implied_start: number;
  special_flags: string[];
  hoai_fee_zone: string;
  hoai_fee_zone_reasoning: string;
  din276_primary_cost_groups: string[];
  vob_recommended_procedure: string;
  vob_contract_type: string;
  estimated_trade_packages: string[];
  regulatory_requirements: {
    bauantrag_required: boolean;
    fire_protection_class: string | null;
    geg_compliance: string | null;
    heritage_protection: boolean;
    sigeko_required: boolean;
    environmental_assessment: boolean;
    accessibility_din18040: boolean;
  };
}

export async function classifyProject(
  documentText: string,
  facts: ExtractedFact[]
): Promise<ClassificationResult> {
  const factsContext = facts
    .filter((f) => f.value && f.data_state !== "MISSING")
    .map((f) => `- ${f.field}: ${f.value} (${f.data_state})`)
    .join("\n");

  const env = getEnv();

  const text = await aiChat({
    maxTokens: env.AI_MAX_TOKENS_CLASSIFY,
    messages: [
      {
        role: "user",
        content: `Classify this architectural project based on the following material and extracted facts.\n\nExtracted facts:\n${factsContext}\n\nSource material (excerpt):\n${documentText.slice(0, env.AI_CLASSIFICATION_MAX_CHARS)}`,
      },
    ],
    system: `You are an expert classifier for German HOAI architectural projects with knowledge of DIN 276 cost structures, VOB procurement models, and German building regulations.

Classify the project and return ONLY valid JSON. No preamble. No markdown fences.

Schema:
{
  "type": "new_build|refurbishment|conversion|interior_fit_out|mixed_use",
  "delivery_model": "general_contractor|single_trades|unclear",
  "planning_state": "pre_planning|early_planning|mid_planning|late_planning|execution|post_completion",
  "complexity_level": "simple|moderate|complex|very_complex",
  "lph_current": 1-9,
  "lph_implied_start": 1-9,
  "special_flags": ["string array of notable characteristics"],
  "hoai_fee_zone": "I|II|III|IV|V",
  "hoai_fee_zone_reasoning": "Brief justification for fee zone selection",
  "din276_primary_cost_groups": ["300", "400", "500"],
  "vob_recommended_procedure": "oeffentliche_ausschreibung|beschraenkte_ausschreibung|verhandlungsvergabe|direktauftrag",
  "vob_contract_type": "vob_b|bgb_werkvertrag",
  "estimated_trade_packages": ["Rohbau", "Fassade", "Haustechnik", "Elektro", ...],
  "regulatory_requirements": {
    "bauantrag_required": true,
    "fire_protection_class": "string or null",
    "geg_compliance": "standard|kfw40|kfw55|passivhaus|effizienzhaus40|null",
    "heritage_protection": false,
    "sigeko_required": true,
    "environmental_assessment": false,
    "accessibility_din18040": true
  }
}`,
  });

  const classification = await parseOrRepairModelJson<ClassificationResult>(
    text,
    "Project classification object with enum-like fields and regulatory_requirements"
  );

  // BaustellV safeguard: multiple distinct trades require SiGeKo by policy.
  const distinctTrades = new Set(
    classification.estimated_trade_packages
      .map((trade) => trade.trim().toLowerCase())
      .filter((trade) => trade.length > 0)
  );
  if (distinctTrades.size > 1) {
    classification.regulatory_requirements.sigeko_required = true;
  }

  return classification;
}

interface VobADisqualificationFlag {
  code: "VOBA_16_MISSING_UNIT_PRICE" | "VOBA_16_DESCRIPTION_ALTERED" | "VOBA_16_MISSING_SIGNATURE";
  severity: "critical";
  triggered: boolean;
  evidence: string[];
  affected_line_items?: string[];
}

interface VobABidAuditLog {
  summary: string;
  is_disqualified: boolean;
  validation_log: {
    compared_documents: {
      original: "DA83";
      submitted: "DA84";
    };
    checks: {
      missing_or_null_unit_prices: {
        passed: boolean;
        details: string[];
      };
      altered_technical_descriptions: {
        passed: boolean;
        details: string[];
      };
      mandatory_signatures_present: {
        passed: boolean;
        details: string[];
      };
    };
    disqualification_flags: VobADisqualificationFlag[];
  };
}

export async function auditVobABid(
  originalDa83Text: string,
  submittedDa84Text: string
): Promise<VobABidAuditLog> {
  const env = getEnv();
  const text = await aiChat({
    maxTokens: env.AI_MAX_TOKENS_EXTRACT,
    messages: [
      {
        role: "user",
        content: `Audit the DA84 bidder submission against the DA83 original request for quotation.\n\n--- ORIGINAL DA83 ---\n${originalDa83Text.slice(0, env.AI_FACT_EXTRACTION_MAX_CHARS)}\n\n--- SUBMITTED DA84 ---\n${submittedDa84Text.slice(0, env.AI_FACT_EXTRACTION_MAX_CHARS)}`,
      },
    ],
    system: `You are a procurement compliance auditor for German public tendering under VOB/A.

Perform a strict integrity audit comparing DA83 (original request for quotation) and DA84 (submitted bid).

STRICT VOB/A §16 DISQUALIFICATION RULES:
1) Trigger disqualification if any DA84 line item has missing, empty, "null", or non-numeric unit price.
2) Trigger disqualification if any original DA83 technical description text for a line item was altered, rewritten, or materially changed by the bidder in DA84.
3) Trigger disqualification if mandatory physical or digital signatures are missing from DA84 submission evidence.

Return ONLY valid JSON with this schema:
{
  "summary": "string",
  "is_disqualified": true,
  "validation_log": {
    "compared_documents": {
      "original": "DA83",
      "submitted": "DA84"
    },
    "checks": {
      "missing_or_null_unit_prices": {
        "passed": false,
        "details": ["string"]
      },
      "altered_technical_descriptions": {
        "passed": false,
        "details": ["string"]
      },
      "mandatory_signatures_present": {
        "passed": false,
        "details": ["string"]
      }
    },
    "disqualification_flags": [
      {
        "code": "VOBA_16_MISSING_UNIT_PRICE|VOBA_16_DESCRIPTION_ALTERED|VOBA_16_MISSING_SIGNATURE",
        "severity": "critical",
        "triggered": true,
        "evidence": ["string"],
        "affected_line_items": ["string"]
      }
    ]
  }
}

Rules:
- Set is_disqualified=true if any disqualification flag is triggered.
- Evidence must include exact snippets or line-item references where available.
- Do not invent evidence; if unavailable, state that explicitly in details.
- Be strict and deterministic.`,
  });

  return parseOrRepairModelJson<VobABidAuditLog>(
    text,
    'Object containing "summary", "is_disqualified", and "validation_log" with strict VOB/A §16 checks'
  );
}

interface Din276MappingInput {
  description: string;
  costGroupCode: string;
  amount: number;
}

interface Din276MappingVerificationEntry {
  description: string;
  submitted_cost_group_code: string;
  submitted_amount: number;
  is_mapping_valid: boolean;
  recommended_cost_group_code: string;
  rationale: string;
  severity: "none" | "low" | "medium" | "high";
}

interface Din276MappingVerificationReport {
  report_type: "Cost Group Mapping Verification Report";
  overall_status: "PASS" | "FAIL";
  summary: string;
  totals: {
    total_line_items: number;
    valid_mappings: number;
    flagged_anomalies: number;
  };
  results: Din276MappingVerificationEntry[];
}

export async function auditDin276Mapping(
  lineItems: { description: string; costGroupCode: string; amount: number }[]
): Promise<Din276MappingVerificationReport> {
  const text = await aiChat({
    maxTokens: 4096,
    messages: [
      {
        role: "user",
        content: `Audit the following DIN 276 mapping set for correctness.\n\n${JSON.stringify(
          lineItems,
          null,
          2
        )}`,
      },
    ],
    system: `You are a strict DIN 276 cost auditor for German construction cost planning and controlling.

Task:
- Review EVERY single line item.
- Determine whether each item description is correctly mapped to the submitted DIN 276 cost group code.
- Validate against DIN 276 cost groups 100 through 800.

DIN 276 group anchors to enforce:
- 100: Grundstück (land, site acquisition, plot-related costs)
- 200: Herrichten und Erschließen (site preparation, enabling works, utilities connection)
- 300: Bauwerk - Baukonstruktionen (building construction works, structural/architectural fabric)
- 400: Bauwerk - Technische Anlagen (MEP/technical building systems)
- 500: Außenanlagen und Freiflächen (external works, landscaping, exterior areas)
- 600: Ausstattung und Kunstwerke (equipment, furnishings, art)
- 700: Baunebenkosten (planning/design/consultancy fees, approvals, insurance, financing side costs)
- 800: Finanzierung and other project-related overhead categories where applicable in project accounting context

Strict anomaly logic:
- If the submitted group is semantically wrong for the description, mark is_mapping_valid=false and provide recommended_cost_group_code.
- Explicitly flag professional fees (e.g., architectural drafting/planning fees, engineering consultancy) when mapped to 300/400/500/600 and recommend 700.
- Example rule: "Architectural Drafting Fees" mapped to 300 is incorrect and must be reclassified to 700.
- Do not skip any input line item.

Return ONLY valid JSON with this schema:
{
  "report_type": "Cost Group Mapping Verification Report",
  "overall_status": "PASS|FAIL",
  "summary": "string",
  "totals": {
    "total_line_items": number,
    "valid_mappings": number,
    "flagged_anomalies": number
  },
  "results": [
    {
      "description": "string",
      "submitted_cost_group_code": "string",
      "submitted_amount": number,
      "is_mapping_valid": true,
      "recommended_cost_group_code": "string",
      "rationale": "string",
      "severity": "none|low|medium|high"
    }
  ]
}

Output rules:
- overall_status must be FAIL when any anomaly exists; otherwise PASS.
- totals must be numerically consistent with results.
- For valid rows, recommended_cost_group_code should equal submitted_cost_group_code and severity should be "none".
- For invalid rows, provide clear rationale and the best reclassification code.
- Be deterministic and compliance-oriented.`,
  });

  return parseOrRepairModelJson<Din276MappingVerificationReport>(
    text,
    'Object with report_type "Cost Group Mapping Verification Report", totals, and per-line mapping results'
  );
}

interface SiteRiskContractor {
  name: string;
  role?: string | null;
  pqVereinStatus?: boolean | null;
  selected?: boolean | null;
}

interface SiteRiskClassificationLike {
  regulatory_requirements?: {
    sigeko_required?: boolean;
  };
}

interface SiteRiskAlert {
  priority: "high" | "medium";
  title: string;
  message: string;
}

export function generateSiteRiskAlert(
  classification: SiteRiskClassificationLike,
  contractors: SiteRiskContractor[]
): SiteRiskAlert[] {
  const alerts: SiteRiskAlert[] = [];
  const sigekoRequired = Boolean(classification.regulatory_requirements?.sigeko_required);

  const assignedSigeko = contractors.some((contractor) =>
    (contractor.role || "").toLowerCase().includes("sigeko")
  );

  if (sigekoRequired && !assignedSigeko) {
    alerts.push({
      priority: "high",
      title: "SiGeKo Legal Mandate Alert",
      message:
        "BaustellV indicates SiGeKo is required, but no participant with a SiGeKo role is currently assigned.",
    });
  }

  const selectedContractors = contractors.filter((contractor) => contractor.selected !== false);
  const contractorsWithInvalidPq = selectedContractors.filter(
    (contractor) => contractor.pqVereinStatus === false
  );

  if (contractorsWithInvalidPq.length > 0) {
    alerts.push({
      priority: "medium",
      title: "PQ-Verein Compliance Warning",
      message: `Selected contractors with failed prequalification status: ${contractorsWithInvalidPq
        .map((contractor) => contractor.name)
        .join(", ")}.`,
    });
  }

  return alerts;
}

export interface BimComplianceReport {
  report_type: "3D Spatial and Regulatory Clash Report";
  status: "stub";
  summary: string;
  findings: string[];
}

/**
 * Generates a BIM compliance report from parsed IFC-derived data and local code references.
 *
 * Planned Automated Compliance Checking scope:
 * 1) IFC geometric parsing and normalization
 *    - Consume parsed IFC entities and convert B-Rep/mesh/topology primitives into
 *      normalized geometric boundaries (site limits, building envelope, facade planes,
 *      roof projections, openings, and level references).
 *    - Harmonize coordinates into one consistent project CRS and establish a stable
 *      spatial index for deterministic geometric querying.
 *
 * 2) Rule model preparation for German local code checks
 *    - Translate jurisdiction-specific building code logic into machine-verifiable rules,
 *      including minimum clearance surfaces and contextual constraints.
 *    - Parameterize rules by zoning context, adjacent parcels, building class, and
 *      edge-case exemptions defined by local authority interpretation guidance.
 *
 * 3) Abstandsflächen (minimum distance surface) verification
 *    - Compute required Abstandsflächen volumes/surfaces from IFC boundary geometry
 *      and facade-relevant reference elements.
 *    - Intersect required clearance geometry against actual parcel limits, neighboring
 *      boundary conditions, and modeled built elements.
 *    - Detect spatial clashes where required minimum distances are violated.
 *
 * 4) Clash evidence and audit traceability
 *    - For every violation, capture deterministic evidence bundles:
 *      source IFC elements, rule ID, threshold values, measured distance, and
 *      machine-readable geometry references.
 *    - Preserve reproducible calculation snapshots so compliance outcomes are
 *      auditable under review or dispute scenarios.
 *
 * 5) Output contract
 *    - Produce a formal "3D Spatial and Regulatory Clash Report" containing
 *      pass/fail summaries, rule-by-rule findings, and spatially anchored clash items
 *      that can be consumed by downstream approval workflows and UI viewers.
 */
export function generateBimComplianceReport(
  ifcData: unknown,
  localBuildingCode: string
): BimComplianceReport {
  void ifcData;
  void localBuildingCode;

  return {
    report_type: "3D Spatial and Regulatory Clash Report",
    status: "stub",
    summary:
      "BIM compliance stub initialized. IFC spatial checks and automated Abstandsflaechen rule validation are not yet implemented.",
    findings: [
      "Placeholder only: parse IFC geometry into spatial boundaries.",
      "Placeholder only: execute local building-code rule engine for distance surfaces.",
      "Placeholder only: return deterministic 3D regulatory clash evidence.",
    ],
  };
}

// ─── Step 4: Gate Eligibility Check (Deterministic) ────────────

interface GateCheck {
  gate: string;
  pass: boolean;
  criteria: { key: string; label: string; met: boolean }[];
}

export function checkGateEligibility(facts: ExtractedFact[]): GateCheck[] {
  function factState(field: string): string {
    const f = facts.find((x) => x.field === field);
    return f?.data_state || "MISSING";
  }

  function factNotMissing(field: string): boolean {
    return factState(field) !== "MISSING";
  }

  const hasTimeAnchor =
    factNotMissing("target_completion") || factNotMissing("known_deadlines");

  const gateA: GateCheck = {
    gate: "A",
    pass: false,
    criteria: [
      { key: "project_name", label: "Project name identified", met: factNotMissing("project_name") },
      { key: "location", label: "Location identified", met: factNotMissing("location") },
      { key: "client_name", label: "Client identified", met: factNotMissing("client_name") },
      { key: "time_anchor", label: "At least one time anchor", met: hasTimeAnchor },
      { key: "scope_description", label: "Scope description available", met: factNotMissing("scope_description") },
    ],
  };
  gateA.pass = gateA.criteria.every((c) => c.met);

  const gateB: GateCheck = {
    gate: "B",
    pass: false,
    criteria: [
      { key: "scope_description", label: "Project objective defined", met: factNotMissing("scope_description") },
      { key: "constraints", label: "Main constraints identified", met: factNotMissing("known_constraints") },
      { key: "risk_scan", label: "First risk scan completed", met: factNotMissing("mentioned_risks") },
      { key: "kostenrahmen", label: "DIN 276 Kostenrahmen available (cost framework)", met: factNotMissing("estimated_construction_cost") },
      { key: "hoai_fee_zone", label: "HOAI fee zone classified", met: factNotMissing("hoai_fee_zone") },
    ],
  };
  gateB.pass = gateB.criteria.every((c) => c.met);

  const gateC: GateCheck = {
    gate: "C",
    pass: false,
    criteria: [
      { key: "approvals_listed", label: "Authority documents listed", met: factNotMissing("mentioned_approvals") },
      { key: "client_brief", label: "Client brief confirmed", met: factNotMissing("decision_authority") },
      { key: "kostenschaetzung", label: "DIN 276 Kostenschätzung prepared (LPH 2 cost estimate)", met: factNotMissing("cost_per_sqm_estimate") },
      { key: "hoai_scope", label: "HOAI service scope defined per discipline", met: factNotMissing("hoai_service_scope") },
    ],
  };
  gateC.pass = gateC.criteria.every((c) => c.met);

  const gateD: GateCheck = {
    gate: "D",
    pass: false,
    criteria: [
      { key: "procurement_model", label: "Procurement model defined", met: factNotMissing("procurement_model") },
      { key: "consultants", label: "Consultant disciplines identified", met: factNotMissing("known_consultants") },
      { key: "kostenberechnung", label: "DIN 276 Kostenberechnung available (LPH 3 cost calculation)", met: false },
      { key: "vob_procedure", label: "VOB tendering procedure determined", met: factNotMissing("tendering_procedure_type") },
      { key: "trade_packages", label: "Trade packages defined with VOB/C references", met: factNotMissing("known_trade_packages") },
      { key: "building_permit", label: "Bauantrag submitted (LPH 4)", met: factState("building_permit_status") === "CONFIRMED" },
    ],
  };
  gateD.pass = gateD.criteria.every((c) => c.met);

  // Gates E and F require execution-stage data — typically not passable at intake
  const gateE: GateCheck = {
    gate: "E",
    pass: false,
    criteria: [
      { key: "contracts_awarded", label: "All VOB contracts awarded", met: false },
      { key: "site_logistics", label: "Site logistics plan approved", met: false },
      { key: "kostenanschlag", label: "DIN 276 Kostenanschlag complete (tender-based costs)", met: false },
      { key: "sigeko_plan", label: "SiGePlan prepared (if required)", met: false },
      { key: "building_permit_granted", label: "Baugenehmigung granted", met: false },
    ],
  };

  const gateF: GateCheck = {
    gate: "F",
    pass: false,
    criteria: [
      { key: "defects_resolved", label: "All Mängel (defects) resolved", met: false },
      { key: "final_account", label: "Schlussrechnung (final account) signed", met: false },
      { key: "kostenfeststellung", label: "DIN 276 Kostenfeststellung complete (final costs)", met: false },
      { key: "abnahme_complete", label: "All VOB Abnahmen (formal acceptances) complete", met: false },
      { key: "warranty_tracking", label: "Gewährleistung tracking active for all contracts", met: false },
    ],
  };

  return [gateA, gateB, gateC, gateD, gateE, gateF];
}

interface BauVorlVGapCheck {
  requirement: string;
  status: "PASS" | "FAIL";
  details: string;
}

interface BauVorlVReport {
  overallStatus: "PASS" | "FAIL";
  checks: BauVorlVGapCheck[];
}

function parseBooleanFactValue(value: string | null): boolean {
  if (!value) return false;
  const normalized = value.trim().toLowerCase();
  return normalized === "true" || normalized === "yes" || normalized === "ja" || normalized === "1";
}

function parseDateFactValue(value: string | null): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function generateBauVorlVReport(facts: ExtractedFact[]): BauVorlVReport {
  const now = new Date();
  const sixMonthsAgo = new Date(now);
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

  const getFactsByField = (field: string): ExtractedFact[] =>
    facts.filter((fact) => fact.field === field && fact.value && fact.data_state !== "MISSING");

  const categories = getFactsByField("bauvorlv_category")
    .map((fact) => fact.value?.trim().toLowerCase())
    .filter((value): value is string => Boolean(value));

  const documentDates = getFactsByField("document_date")
    .map((fact) => parseDateFactValue(fact.value))
    .filter((value): value is Date => value !== null);

  const scales = getFactsByField("scale_metric")
    .map((fact) => fact.value?.trim().toLowerCase())
    .filter((value): value is string => Boolean(value));

  const signatures = getFactsByField("has_certified_signature").filter((fact) =>
    parseBooleanFactValue(fact.value)
  );

  const hasCadastralMap = categories.includes("cadastral_map");
  const cadastralMapFresh = hasCadastralMap && documentDates.some((docDate) => docDate >= sixMonthsAgo);

  const hasConstructionDrawings = categories.includes("construction_drawings");
  const hasScaleOneToHundred =
    hasConstructionDrawings &&
    scales.some((scale) => {
      const normalized = scale.replace(/\s+/g, "");
      return normalized === "1:100" || normalized === "100";
    });

  const hasStructuralProofs = categories.includes("structural_proofs");
  const structuralProofsSigned = hasStructuralProofs && signatures.length > 0;

  const hasFireProtectionPlan = categories.includes("fire_protection_plan");
  const fireProtectionPlanSigned = hasFireProtectionPlan && signatures.length > 0;

  const checks: BauVorlVGapCheck[] = [
    {
      requirement: "Cadastral Map present and less than 6 months old",
      status: hasCadastralMap && cadastralMapFresh ? "PASS" : "FAIL",
      details: hasCadastralMap
        ? cadastralMapFresh
          ? "Cadastral Map detected with at least one valid date within the last 6 months."
          : "Cadastral Map detected, but no valid document_date within the last 6 months."
        : "No Cadastral Map found in extracted BauVorlV categories.",
    },
    {
      requirement: "Construction Drawings define explicit 1:100 scale",
      status: hasScaleOneToHundred ? "PASS" : "FAIL",
      details: hasConstructionDrawings
        ? hasScaleOneToHundred
          ? "Construction Drawings include explicit scale_metric 1:100."
          : "Construction Drawings found, but no explicit scale_metric 1:100 detected."
        : "No Construction Drawings found in extracted BauVorlV categories.",
    },
    {
      requirement: "Structural Proofs include certified signature",
      status: structuralProofsSigned ? "PASS" : "FAIL",
      details: hasStructuralProofs
        ? structuralProofsSigned
          ? "Structural Proofs detected with has_certified_signature=true."
          : "Structural Proofs detected, but has_certified_signature=true is missing."
        : "No Structural Proofs found in extracted BauVorlV categories.",
    },
    {
      requirement: "Fire Protection Plan includes certified signature",
      status: fireProtectionPlanSigned ? "PASS" : "FAIL",
      details: hasFireProtectionPlan
        ? fireProtectionPlanSigned
          ? "Fire Protection Plan detected with has_certified_signature=true."
          : "Fire Protection Plan detected, but has_certified_signature=true is missing."
        : "No Fire Protection Plan found in extracted BauVorlV categories.",
    },
  ];

  return {
    overallStatus: checks.every((check) => check.status === "PASS") ? "PASS" : "FAIL",
    checks,
  };
}

// ─── Step 5: Initial Structure Generation ──────────────────────

interface ProjectStructure {
  lph_roadmap: {
    lph: number;
    name: string;
    estimated_start: string | null;
    estimated_end: string | null;
    work_packages: string[];
  }[];
  responsibility_structure: {
    role: string;
    phases: number[];
    responsibilities: string[];
  }[];
  approval_structure: {
    name: string;
    type: string;
    phase: number;
  }[];
  consultant_requirements: {
    discipline: string;
    phase_start: number;
    readiness_criteria: string[];
  }[];
  risk_register: {
    description: string;
    category: string;
    impact: string;
    likelihood: string;
  }[];
  missing_information: string[];
  cost_structure: {
    kostenrahmen: {
      cost_group_code: string;
      description: string;
      estimated_amount: number;
      basis: string;
    }[];
    total_estimated_net: number;
    cost_per_sqm_estimate: number;
    bgf_assumed: number;
  };
  vob_packages: {
    name: string;
    trade: string;
    cost_group_code: string;
    vob_c_reference: string;
    tendering_procedure: string;
    estimated_value: number;
  }[];
  regulatory_submissions: {
    area: string;
    submission_type: string;
    title: string;
    required_by_phase: number;
    authority: string;
  }[];
  hoai_fee_estimate: {
    service_type: string;
    fee_zone: string;
    anrechenbare_kosten: number;
    estimated_total_fee: number;
    phase_fees: { lph: number; percentage: number; fee: number }[];
  };
}

export async function generateProjectStructure(
  documentText: string,
  facts: ExtractedFact[],
  classification: ClassificationResult
): Promise<ProjectStructure> {
  const factsContext = facts
    .filter((f) => f.value)
    .map((f) => `- ${f.field}: ${f.value} (${f.data_state})`)
    .join("\n");

  const text = await aiChat({
    maxTokens: 8192,
    messages: [
      {
        role: "user",
        content: `Generate the initial project operating model.\n\nClassification:\n${JSON.stringify(classification, null, 2)}\n\nExtracted facts:\n${factsContext}\n\nSource material (excerpt):\n${documentText.slice(0, 30000)}`,
      },
    ],
    system: `You are an expert project planner for German HOAI architectural projects with comprehensive knowledge of DIN 276 cost classification, VOB procurement, GAEB data exchange, and German regulatory requirements (Bauordnung, GEG, Brandschutz, SiGeKo).

Generate the initial project operating model. Return ONLY valid JSON. No preamble. No markdown fences.

Schema:
{
  "lph_roadmap": [
    { "lph": 1-9, "name": "string", "estimated_start": "YYYY-MM-DD or null", "estimated_end": "YYYY-MM-DD or null", "work_packages": ["string"] }
  ],
  "responsibility_structure": [
    { "role": "string", "phases": [1-9], "responsibilities": ["string"] }
  ],
  "approval_structure": [
    { "name": "string", "type": "client|internal|technical|material", "phase": 1-9 }
  ],
  "consultant_requirements": [
    { "discipline": "string", "phase_start": 1-9, "readiness_criteria": ["string"] }
  ],
  "risk_register": [
    { "description": "string", "category": "string", "impact": "low|medium|high", "likelihood": "low|medium|high" }
  ],
  "missing_information": ["string"],
  "cost_structure": {
    "kostenrahmen": [
      { "cost_group_code": "DIN 276 code (e.g. 300)", "description": "string", "estimated_amount": number (EUR net), "basis": "string (e.g. '€/m² BGF × area')" }
    ],
    "total_estimated_net": number (EUR),
    "cost_per_sqm_estimate": number (EUR/m² BGF),
    "bgf_assumed": number (m²)
  },
  "vob_packages": [
    {
      "name": "string (e.g. Rohbauarbeiten)",
      "trade": "string (e.g. Beton- und Stahlbetonarbeiten)",
      "cost_group_code": "DIN 276 code",
      "vob_c_reference": "DIN 18xxx reference",
      "tendering_procedure": "oeffentliche_ausschreibung|beschraenkte_ausschreibung|verhandlungsvergabe|direktauftrag",
      "estimated_value": number (EUR net)
    }
  ],
  "regulatory_submissions": [
    {
      "area": "bauordnung|brandschutz|geg_energy|sigeko|denkmalschutz|umweltschutz|schallschutz|barrierefreiheit",
      "submission_type": "string (e.g. bauantrag, brandschutzkonzept)",
      "title": "string",
      "required_by_phase": 1-9,
      "authority": "string"
    }
  ],
  "hoai_fee_estimate": {
    "service_type": "gebaeudeplanung",
    "fee_zone": "I|II|III|IV|V",
    "anrechenbare_kosten": number (EUR — typically KG 300 + KG 400),
    "estimated_total_fee": number (EUR),
    "phase_fees": [
      { "lph": 1-9, "percentage": number, "fee": number (EUR) }
    ]
  }
}

Rules:
- Use realistic German HOAI project timelines. All 9 LPH phases must be included.
- Cost structure MUST follow DIN 276:2018 Kostengruppen at level 1 (100-800). Include at least KG 300, 400, 500, 700.
- Provide realistic €/m² BGF estimates for the project type and German market.
- VOB packages should map to specific DIN 18xxx ATV references (VOB/C).
- Include all mandatory regulatory submissions for the project type (Bauantrag, Brandschutz, GEG, SiGeKo as applicable).
- HOAI fee estimate should use the standard §35 percentages for Gebäudeplanung.
- Anrechenbare Kosten = KG 300 + KG 400 (as per HOAI §33).
- Ensure risks and consultant requirements are comprehensive for the project type.`,
  });

  return parseOrRepairModelJson<ProjectStructure>(
    text,
    "Project structure object with lph_roadmap, cost_structure, vob_packages, regulatory_submissions, hoai_fee_estimate"
  );
}

// ─── Vision extraction for images ──────────────────────────────

export async function extractTextFromImage(
  imageBuffer: Buffer,
  fileName: string
): Promise<string> {
  const ext = fileName.toLowerCase().split(".").pop();
  const mediaType: "image/png" | "image/jpeg" | "image/gif" =
    ext === "png" ? "image/png" : ext === "gif" ? "image/gif" : "image/jpeg";

  return aiVision({
    imageBuffer,
    mediaType,
    prompt:
      "Extract all readable text from this image. If it's a plan or drawing, describe its contents. Return plain text only.",
    maxTokens: 2048,
  });
}

const IMAGE_PROJECT_DETAILS_JSON_SCHEMA = `{
  "projectName": string | null,
  "location": string | null,
  "clientName": string | null,
  "targetCompletionDate": string | null,
  "estimatedTrades": string[]
}`;

export interface ProjectDetailsFromImage {
  projectName: string | null;
  location: string | null;
  clientName: string | null;
  targetCompletionDate: string | null;
  estimatedTrades: string[];
}

/**
 * Use multimodal vision to read a project-related image and return structured project fields
 * for instant project creation. Pass raw base64 from `processImageForVision` in `file-parser`.
 */
export async function extractProjectDetailsFromImage(
  imageBase64: string,
  mimeType: string
): Promise<ProjectDetailsFromImage> {
  if (!isVisionSupportedImageMime(mimeType)) {
    throw new Error(
      `extractProjectDetailsFromImage: unsupported MIME type ${mimeType}. Use image/jpeg, image/png, or image/webp.`
    );
  }

  const mediaType = mimeType.toLowerCase().trim() as VisionImageMediaType;
  const buffer = Buffer.from(imageBase64, "base64");
  const env = getEnv();

  const systemPrompt = `You are a strict OCR and construction-document analyst. You read a single user-supplied image (photograph, scanned document, screenshot, or architectural drawing) and output machine-readable project metadata.

Rules (non-negotiable):
- You MUST base every field only on text or unambiguous visual labels clearly visible in the image. If you are not confident, use JSON null for that field. Do not invent addresses, clients, or dates that are not visible.
- Return ONLY one JSON object. No markdown, no code fences, no explanation, no text before or after the JSON.
- The JSON object MUST have exactly these keys: "projectName", "location", "clientName", "targetCompletionDate", "estimatedTrades".
- Scalar values ("projectName", "location", "clientName", "targetCompletionDate") are either a JSON string or JSON null.
- For architectural floor plans, reflected ceiling plans, or similar: use the sheet title or title block text (e.g. "FLOOR PLAN", "Grundriss") together with any visible project or building name as projectName when present; if only functional program is visible (e.g. office, training rooms), projectName may concisely describe the drawing (e.g. "Office suite floor plan — Training, Conference, Reception") using visible room names only.
- If the image is a screenshot that includes a viewer or browser UI, you may use clearly legible document titles or tab/file names visible in that screenshot as projectName when they identify the project file; otherwise null.
- "estimatedTrades": list distinct planning or construction disciplines suggested by visible spaces or labels (e.g. room types like "Office", "Conference", "Restroom" map to disciplines such as "Interior fit-out", "Sanitary / plumbing", "HVAC" only when those spaces are clearly labeled). Prefer explicit trade or scope text from the sheet when present; otherwise derive at most 5 short discipline labels from labeled rooms. Use [] if nothing can be grounded in visible text.
- "targetCompletionDate" must be null unless a specific calendar date is clearly stated in the image (ISO YYYY-MM-DD when full date is readable).
- If the image contains no usable project or drawing information, return all scalar fields as null and "estimatedTrades": [].`;

  const userPrompt = `Read the image and output only the JSON object matching this shape:
${IMAGE_PROJECT_DETAILS_JSON_SCHEMA}`;

  const rawText = await aiVision({
    imageBuffer: buffer,
    mediaType,
    system: systemPrompt,
    prompt: userPrompt,
    maxTokens: env.AI_MAX_TOKENS_EXTRACT,
  });

  const parsed = await parseOrRepairModelJson<ProjectDetailsFromImage>(
    rawText,
    IMAGE_PROJECT_DETAILS_JSON_SCHEMA
  );

  return {
    projectName: parsed.projectName ?? null,
    location: parsed.location ?? null,
    clientName: parsed.clientName ?? null,
    targetCompletionDate: parsed.targetCompletionDate ?? null,
    estimatedTrades: Array.isArray(parsed.estimatedTrades)
      ? parsed.estimatedTrades.filter((t): t is string => typeof t === "string")
      : [],
  };
}

const PROJECT_FACTS_SCHEMA = z.object({
  project_summary: z.string(),
  project_overview: z.object({
    client_name: z.string().nullable(),
    location: z.string().nullable(),
    commissioned_phases: z.array(z.number().int().min(1).max(9)),
    building_permit_status: z.string().nullable(),
  }),
  current_hoai_phase: z.number().int().min(1).max(9).nullable(),
  standards_mapping: z.array(
    z.object({
      finding: z.string(),
      hoai_service_phase: z.number().int().min(1).max(9).nullable(),
      din276_cost_group: z.string().regex(/^\d{3}$/).nullable(),
      rationale: z.string().nullable(),
      truth_state: z.literal("inferred"),
      source_reference: z.string().min(1),
    })
  ),
  cost_items: z.array(
    z.object({
      description: z.string(),
      din276_code: z.string(),
      quantity: z.number().nullable(),
      amount: z.number().nullable(),
      unit: z.string().nullable(),
      truth_state: z.literal("inferred"),
      source_reference: z.string().min(1),
    })
  ),
  schedule: z.array(
    z.object({
      task: z.string(),
      hoai_phase: z.number().int().min(1).max(9),
      truth_state: z.literal("inferred"),
      source_reference: z.string().min(1),
    })
  ),
  stakeholders: z.array(
    z.object({
      name: z.string(),
      role: z.string(),
      truth_state: z.literal("inferred"),
      source_reference: z.string().min(1),
    })
  ),
  missing_data: z.array(z.string()),
});

const PROJECT_FACTS_TOLERANT_SCHEMA = z.object({
  project_summary: z.string().default(""),
  project_overview: z
    .object({
      client_name: z.string().nullable().default(null),
      location: z.string().nullable().default(null),
      commissioned_phases: z
        .array(z.number().int().min(1).max(9))
        .nullable()
        .transform((value) => value ?? [])
        .default([]),
      building_permit_status: z.string().nullable().default(null),
    })
    .default({
      client_name: null,
      location: null,
      commissioned_phases: [],
      building_permit_status: null,
    }),
  current_hoai_phase: z.number().int().min(1).max(9).nullable().default(null),
  standards_mapping: z
    .array(
      z.object({
        finding: z.string().default(""),
        hoai_service_phase: z.number().int().min(1).max(9).nullable().default(null),
        din276_cost_group: z.string().nullable().default(null),
        rationale: z.string().nullable().default(null),
        truth_state: z.literal("inferred").default("inferred"),
        source_reference: z.string().nullable().default(null),
      })
    )
    .default([]),
  cost_items: z
    .array(
      z.object({
        description: z.string().default(""),
        din276_code: z.string().nullable().default(null),
        quantity: z.number().nullable().default(null),
        amount: z.number().nullable().default(null),
        unit: z.string().nullable().default(null),
        truth_state: z.literal("inferred").default("inferred"),
        source_reference: z.string().nullable().default(null),
      })
    )
    .default([]),
  schedule: z
    .array(
      z.object({
        task: z.string().default(""),
        hoai_phase: z.number().int().min(1).max(9).nullable().default(null),
        truth_state: z.literal("inferred").default("inferred"),
        source_reference: z.string().nullable().default(null),
      })
    )
    .default([]),
  stakeholders: z
    .array(
      z.object({
        name: z.string().nullable().default(null),
        role: z.string().nullable().default(null),
        truth_state: z.literal("inferred").default("inferred"),
        source_reference: z.string().nullable().default(null),
      })
    )
    .default([]),
  missing_data: z.array(z.string()).default([]),
});

export type StructuredProjectFacts = z.infer<typeof PROJECT_FACTS_SCHEMA>;

export interface ProcessFileInput extends FileParseInput {
  project_id: string;
  document_id?: string;
}

export interface ProcessFileOutput {
  text: string;
  structured: StructuredProjectFacts;
  presentation_text: string;
  source_reference: string;
  performance_metrics: {
    extraction_ms: number;
    ai_processing_ms: number;
    total_tokens_used: number;
    ai_calls_count: number;
    model_used: string[];
  };
}

interface GroqUsage {
  total_tokens?: number;
}

interface GroqTextResponse {
  text: string;
  usage?: GroqUsage;
}

function getGroqClient(): OpenAI {
  const env = getEnv();
  // Prefer Groq when configured (faster, cheaper for the V5 pipeline). Fall back to
  // IONOS so deployments without a Groq key can still run extraction. Both expose
  // an OpenAI-compatible API surface, so the rest of the pipeline is unchanged.
  if (env.GROQ_API_KEY) {
    return new OpenAI({ apiKey: env.GROQ_API_KEY, baseURL: env.GROQ_BASE_URL });
  }
  if (env.IONOS_API_KEY) {
    return new OpenAI({ apiKey: env.IONOS_API_KEY, baseURL: env.IONOS_AI_BASE_URL });
  }
  throw new Error("Neither GROQ_API_KEY nor IONOS_API_KEY configured for V5 processing pipeline");
}

function getStructuringModel(): string {
  const env = getEnv();
  // Groq's `llama-3.3-70b-versatile` is the historical default; when running on
  // IONOS we use whatever IONOS_AI_MODEL is configured (defaults to Llama 3.1 8B).
  return env.GROQ_API_KEY ? "llama-3.3-70b-versatile" : env.IONOS_AI_MODEL;
}

function isAudioMime(mimeType: string): boolean {
  return mimeType.toLowerCase().startsWith("audio/");
}

async function groqJsonChat(
  client: OpenAI,
  model: string,
  systemPrompt: string,
  userPrompt: string
): Promise<GroqTextResponse> {
  const response = await client.chat.completions.create({
    model,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    temperature: 0,
    response_format: { type: "json_object" },
  });

  return {
    text: response.choices[0]?.message?.content || "{}",
    usage: response.usage ? { total_tokens: response.usage.total_tokens } : undefined,
  };
}

async function groqTextChat(
  client: OpenAI,
  model: string,
  systemPrompt: string,
  userPrompt: string
): Promise<GroqTextResponse> {
  const response = await client.chat.completions.create({
    model,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    temperature: 0,
  });
  return {
    text: response.choices[0]?.message?.content || "",
    usage: response.usage ? { total_tokens: response.usage.total_tokens } : undefined,
  };
}

async function groqTranscribeAudio(
  client: OpenAI,
  file: FileParseInput
): Promise<GroqTextResponse> {
  const fileBlob = new File([new Uint8Array(file.buffer)], file.file_name, {
    type: file.mime_type,
  });
  const response = await client.audio.transcriptions.create({
    model: "whisper-large-v3",
    file: fileBlob,
    temperature: 0,
  });
  return {
    text: response.text || "",
  };
}

function parseAndValidateStructured(raw: string): StructuredProjectFacts {
  const parsed = parseModelJson<unknown>(raw);
  const tolerant = PROJECT_FACTS_TOLERANT_SCHEMA.parse(parsed);

  const missingData = new Set<string>(tolerant.missing_data);
  const noiseTerms = [
    "high-end materials",
    "premium materials",
    "good quality",
    "miscellaneous",
    "other work",
  ];
  const dedupe = <T>(items: T[], keyFn: (item: T) => string): T[] => {
    const seen = new Set<string>();
    const output: T[] = [];
    for (const item of items) {
      const key = keyFn(item);
      if (!seen.has(key)) {
        seen.add(key);
        output.push(item);
      }
    }
    return output;
  };
  const canonicalizeLabel = (value: string): string =>
    value
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .replace(/\b(llc|ltd|inc|gmbh|company|co)\b/g, "")
      .replace(/\s+/g, " ")
      .trim();
  const isNoisy = (value: string): boolean => {
    const normalized = canonicalizeLabel(value);
    if (!normalized || normalized.length < 3) return true;
    return noiseTerms.some((term) => normalized.includes(canonicalizeLabel(term)));
  };
  const pickBestDin = (codes: string[]): string => {
    const ranked = [...codes].sort();
    return ranked[0] || "300";
  };

  const groupedCostItems = new Map<
    string,
    {
      description: string;
      dinCodes: string[];
      quantity: number | null;
      amount: number | null;
      unit: string | null;
      source_reference: string;
    }
  >();
  for (const item of tolerant.cost_items) {
    const description = item.description.trim();
    const dinCode = (item.din276_code || "").trim();
    const normalizedDesc = canonicalizeLabel(description);
    const validDin = /^\d{3}$/.test(dinCode);
    if (!description || isNoisy(description)) {
      missingData.add("cost_item_unclear_or_noisy");
      continue;
    }
    if (!validDin) {
      missingData.add("cost_item_din276_code");
      continue;
    }

    const existing = groupedCostItems.get(normalizedDesc);
    if (!existing) {
      groupedCostItems.set(normalizedDesc, {
        description,
        dinCodes: [dinCode],
        quantity: item.quantity,
        amount: item.amount,
        unit: item.unit?.trim() || null,
        source_reference: item.source_reference?.trim() || "input_text",
      });
      continue;
    }

    existing.dinCodes.push(dinCode);
    if (item.quantity !== null) {
      existing.quantity = (existing.quantity || 0) + item.quantity;
    }
    if (item.amount !== null) {
      existing.amount = (existing.amount || 0) + item.amount;
    }
    if (!existing.unit && item.unit?.trim()) {
      existing.unit = item.unit.trim();
    }
  }

  const costItems = dedupe(
    Array.from(groupedCostItems.values()).map((item) => ({
      description: item.description,
      din276_code: pickBestDin(item.dinCodes),
      quantity: item.quantity,
      amount: item.amount,
      unit: item.unit,
      truth_state: "inferred" as const,
      source_reference: item.source_reference,
    })),
    (item) =>
      `${item.description.toLowerCase()}|${item.din276_code}|${item.quantity ?? "null"}|${item.amount ?? "null"}|${item.unit ?? "null"}`
  );
  if (costItems.length === 0) {
    missingData.add("cost_items");
  }

  const refinedSchedule = dedupe(
    tolerant.schedule
      .filter((item) => {
        const task = item.task.trim();
        const phaseValue =
          typeof item.hoai_phase === "number" ? item.hoai_phase : null;
        const validPhase =
          phaseValue !== null &&
          Number.isInteger(phaseValue) &&
          phaseValue >= 1 &&
          phaseValue <= 9;
        if (!task || isNoisy(task)) {
          missingData.add("schedule_task");
          return false;
        }
        if (!validPhase) {
          missingData.add("schedule_hoai_phase");
          return false;
        }
        return true;
      })
      .map((item) => ({
        task: item.task.trim(),
        hoai_phase: item.hoai_phase as number,
        truth_state: "inferred" as const,
        source_reference: item.source_reference?.trim() || "input_text",
      })),
    (item) => `${item.task.toLowerCase()}|${item.hoai_phase}`
  );
  if (refinedSchedule.length === 0) missingData.add("schedule");

  const standardsMapping = dedupe(
    tolerant.standards_mapping
      .filter((item) => {
        const finding = item.finding.trim();
        const hasHoaiPhase =
          Number.isInteger(item.hoai_service_phase) &&
          item.hoai_service_phase !== null &&
          item.hoai_service_phase >= 1 &&
          item.hoai_service_phase <= 9;
        const hasDinGroup =
          typeof item.din276_cost_group === "string" &&
          /^\d{3}$/.test(item.din276_cost_group);
        if (!finding) return false;
        if (!hasHoaiPhase && !hasDinGroup) return false;
        return true;
      })
      .map((item) => ({
        finding: item.finding.trim(),
        hoai_service_phase: item.hoai_service_phase,
        din276_cost_group: item.din276_cost_group,
        rationale: item.rationale?.trim() || null,
        truth_state: "inferred" as const,
        source_reference: item.source_reference?.trim() || "input_text",
      })),
    (item) => `${item.finding.toLowerCase()}|${item.hoai_service_phase ?? "null"}|${item.din276_cost_group ?? "null"}`
  );
  if (standardsMapping.length === 0) missingData.add("standards_mapping");

  const stakeholders = tolerant.stakeholders
    .filter((s) => {
      const hasName = typeof s.name === "string" && s.name.trim().length > 0;
      const hasRole = typeof s.role === "string" && s.role.trim().length > 0;
      if (!hasName) missingData.add("stakeholder_name");
      if (!hasRole) missingData.add("stakeholder_role");
      if (hasName && isNoisy((s.name || "").trim())) {
        missingData.add("stakeholder_unclear_or_noisy");
        return false;
      }
      return hasName && hasRole;
    })
    .map((s) => ({
      name: (s.name || "").trim(),
      role: (s.role || "").trim(),
      truth_state: "inferred" as const,
      source_reference: s.source_reference?.trim() || "input_text",
    }));

  const stakeholderMap = new Map<string, { name: string; role: string; source_reference: string }>();
  for (const stakeholder of stakeholders) {
    const key = `${canonicalizeLabel(stakeholder.name)}|${canonicalizeLabel(stakeholder.role)}`;
    if (!stakeholderMap.has(key)) {
      stakeholderMap.set(key, stakeholder);
    }
  }
  const normalizedStakeholders = Array.from(stakeholderMap.values()).map((item) => ({
    ...item,
    truth_state: "inferred" as const,
  }));
  if (normalizedStakeholders.length === 0) missingData.add("stakeholders");

  const projectSummary = tolerant.project_summary.trim();
  if (!projectSummary) {
    missingData.add("project_summary");
  }

  return PROJECT_FACTS_SCHEMA.parse({
    ...tolerant,
    project_summary: projectSummary,
    project_overview: {
      client_name: tolerant.project_overview.client_name?.trim() || null,
      location: tolerant.project_overview.location?.trim() || null,
      commissioned_phases: tolerant.project_overview.commissioned_phases,
      building_permit_status: tolerant.project_overview.building_permit_status?.trim() || null,
    },
    standards_mapping: standardsMapping,
    cost_items: costItems,
    schedule: refinedSchedule,
    stakeholders: normalizedStakeholders,
    missing_data: Array.from(missingData),
  });
}

function buildSourceReference(file: FileParseInput, text: string): string {
  const excerpt = text.slice(0, 400).replace(/\s+/g, " ").trim();
  return `file=${file.file_name}; mime=${file.mime_type}; excerpt=${excerpt}`;
}

function sanitizeForLegalExtraction(text: string): string {
  return text
    .replace(/\u0000/g, " ")
    .replace(/[^\S\r\n]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, 60000);
}

function toTitleCase(input: string): string {
  return input
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function buildPresentationText(structured: StructuredProjectFacts): string {
  const missingInfo = new Set<string>(structured.missing_data);
  const costGroups = new Map<
    string,
    {
      description: string;
      quantity: number | null;
      amount: number | null;
      unit: string | null;
      din276_code: string;
    }
  >();

  const normalizeCostKey = (description: string): string =>
    description
      .toLowerCase()
      .replace(/\b(king|queen|single|double)\b/g, "")
      .replace(/\b(bed|mattress)\b/g, "bed+mattress")
      .replace(/[^a-z0-9\s+]/g, " ")
      .replace(/\s+/g, " ")
      .trim();

  for (const item of structured.cost_items) {
    const key = normalizeCostKey(item.description);
    if (!key || key.length < 3) {
      missingInfo.add("cost item details unclear");
      continue;
    }
    const existing = costGroups.get(key);
    if (!existing) {
      costGroups.set(key, {
        description: toTitleCase(item.description),
        quantity: item.quantity,
        amount: item.amount,
        unit: item.unit,
        din276_code: item.din276_code,
      });
      continue;
    }
    if (item.quantity !== null) existing.quantity = (existing.quantity || 0) + item.quantity;
    if (item.amount !== null) existing.amount = (existing.amount || 0) + item.amount;
    if (!existing.unit && item.unit) existing.unit = item.unit;
    if (existing.din276_code !== item.din276_code) {
      // Keep first valid code deterministically and flag inconsistency.
      missingInfo.add(`inconsistent DIN 276 mapping for ${existing.description}`);
    }
  }

  const stakeholderSet = new Set<string>();
  const stakeholderLines: string[] = [];
  for (const stakeholder of structured.stakeholders) {
    const name = stakeholder.name.trim();
    const role = stakeholder.role.trim();
    if (!name || !role) {
      missingInfo.add("stakeholder identity or role");
      continue;
    }
    const key = `${name.toLowerCase()}|${role.toLowerCase()}`;
    if (stakeholderSet.has(key)) continue;
    stakeholderSet.add(key);
    stakeholderLines.push(`- ${name} (${role})`);
  }

  const scheduleSet = new Set<string>();
  const scheduleLines: string[] = [];
  for (const item of structured.schedule) {
    const task = item.task.trim();
    if (!task || !item.hoai_phase) {
      missingInfo.add("schedule task or phase mapping");
      continue;
    }
    const key = `${task.toLowerCase()}|${item.hoai_phase}`;
    if (scheduleSet.has(key)) continue;
    scheduleSet.add(key);
    scheduleLines.push(`- HOAI Phase ${item.hoai_phase}: ${task}`);
  }

  const dinBuckets: Record<
    "300" | "400" | "600" | "700",
    { label: string; items: string[]; subtotal: number }
  > = {
    "300": { label: "DIN 276 - 300 Building", items: [], subtotal: 0 },
    "400": { label: "DIN 276 - 400 Technical Systems", items: [], subtotal: 0 },
    "600": { label: "DIN 276 - 600 Equipment", items: [], subtotal: 0 },
    "700": { label: "DIN 276 - 700 Fees / Execution", items: [], subtotal: 0 },
  };

  const mapToBucket = (code: string): "300" | "400" | "600" | "700" | null => {
    if (code.startsWith("3")) return "300";
    if (code.startsWith("4")) return "400";
    if (code.startsWith("6")) return "600";
    if (code.startsWith("7")) return "700";
    return null;
  };

  for (const item of costGroups.values()) {
    const amount = item.amount !== null ? Math.round(item.amount).toLocaleString("en-US") : null;
    const quantity = item.quantity !== null ? Math.round(item.quantity * 100) / 100 : null;
    if (!item.description || (amount === null && quantity === null)) {
      missingInfo.add("cost quantity or amount");
      continue;
    }
    const bucketKey = mapToBucket(item.din276_code);
    if (!bucketKey) {
      missingInfo.add(`DIN 276 category unclear for ${item.description}`);
      continue;
    }
    const qtyText = quantity !== null ? `${quantity}${item.unit ? ` ${item.unit}` : ""}` : "n/a";
    const amountText = amount !== null ? `EUR ${amount}` : "n/a";
    dinBuckets[bucketKey].items.push(
      `- ${item.description}: ${qtyText}, ${amountText} (DIN ${item.din276_code})`
    );
    if (item.amount !== null) {
      dinBuckets[bucketKey].subtotal += item.amount;
    }
  }

  const costLines = (Object.keys(dinBuckets) as Array<keyof typeof dinBuckets>)
    .flatMap((key) => {
      const bucket = dinBuckets[key];
      if (bucket.items.length === 0) return [];
      const subtotal = Math.round(bucket.subtotal).toLocaleString("en-US");
      return [bucket.label, ...bucket.items, `- Subtotal: EUR ${subtotal}`, ""];
    })
    .filter((line, idx, arr) => !(line === "" && idx === arr.length - 1));

  const schedulePhases = Array.from(scheduleSet)
    .map((key) => {
      const [, phaseRaw] = key.split("|");
      return Number(phaseRaw);
    })
    .filter((phase) => Number.isInteger(phase))
    .sort((a, b) => a - b);
  const currentPhase = schedulePhases.length > 0 ? schedulePhases[0] : null;
  const nextPhase = currentPhase !== null && currentPhase < 9 ? currentPhase + 1 : null;
  const hoaiInsights: string[] = [];
  if (currentPhase !== null) {
    hoaiInsights.push(`- Current HOAI phase indicator: LPH ${currentPhase}`);
    hoaiInsights.push(
      `- Next recommended step: ${nextPhase !== null ? `prepare LPH ${nextPhase} deliverables` : "focus on closeout and handover controls"}`
    );
  } else {
    missingInfo.add("HOAI phase could not be determined");
  }

  const cleanedMissing = Array.from(missingInfo)
    .map((item) => item.trim())
    .filter((item) => item.length > 0)
    .filter((item, idx, arr) => arr.findIndex((x) => x.toLowerCase() === item.toLowerCase()) === idx)
    .map((item) => `- ${toTitleCase(item)}`);

  const locationLine = structured.project_overview.location?.trim();

  return [
    "Project Overview",
    `- ${structured.project_summary.trim() || "No clear project summary could be extracted."}`,
    ...(locationLine ? [`- Location: ${locationLine}`] : []),
    ...(hoaiInsights.length > 0 ? hoaiInsights : []),
    "",
    "Cost Structure (DIN 276)",
    ...(costLines.length > 0 ? costLines : ["- No validated cost items available."]),
    "",
    "Stakeholders",
    ...(stakeholderLines.length > 0 ? stakeholderLines : ["- No validated stakeholder information available."]),
    "",
    "Schedule (HOAI-based)",
    ...(scheduleLines.length > 0 ? scheduleLines : ["- No validated schedule information available."]),
    "",
    "Risks / Missing Information",
    ...(cleanedMissing.length > 0 ? cleanedMissing : ["- No major missing information identified."]),
  ].join("\n");
}

export async function processFile(input: ProcessFileInput): Promise<ProcessFileOutput> {
  const extractionStarted = Date.now();
  const client = getGroqClient();
  let aiCallsCount = 0;
  let totalTokensUsed = 0;
  const modelsUsed: string[] = [];

  const countCall = (model: string, usage?: GroqUsage) => {
    aiCallsCount += 1;
    if (aiCallsCount > 3) {
      throw new Error("max_calls_per_file exceeded");
    }
    modelsUsed.push(model);
    totalTokensUsed += usage?.total_tokens || 0;
  };

  let text = "";
  if (isAudioMime(input.mime_type)) {
    const transcription = await groqTranscribeAudio(client, input);
    countCall("whisper-large-v3", transcription.usage);
    text = transcription.text.trim();
  } else {
    const parsed = await parseFile(input);
    text = parsed.text.trim();
  }

  if (!text) {
    throw new Error(`No output without source basis for ${input.file_name}`);
  }
  text = sanitizeForLegalExtraction(text);

  const extractionMs = Date.now() - extractionStarted;
  const aiStarted = Date.now();

  const aiInputText = text;

  const structuringSystemPrompt = `You are a construction project structuring engine.

Extract and map all information into structured project facts.

Rules:
* Map cost items to official DIN 276 (3-digit codes), preferring 300, 400, 600, 700 where applicable
* Identify current HOAI Service Phase (LPH 1-9)
* Map timeline/tasks to HOAI phases (1-9)
* Set project_overview.location only when the input clearly states a site, city, address, or region; otherwise null
* Explicitly map findings to HOAI and DIN 276 where evidence exists
* Do NOT hallucinate missing data
* Mark all outputs as inferred
* Preserve traceability to input text

Return ONLY valid JSON matching schema.`;

  const structuringUserPrompt = `Return JSON using this schema:
{
  "project_summary": string,
  "project_overview": {
    "client_name": string | null,
    "location": string | null,
    "commissioned_phases": number[],
    "building_permit_status": string | null
  },
  "current_hoai_phase": number | null,
  "standards_mapping": [
    {
      "finding": string,
      "hoai_service_phase": number | null,
      "din276_cost_group": string | null,
      "rationale": string | null,
      "truth_state": "inferred",
      "source_reference": "short quote from input"
    }
  ],
  "cost_items": [
    {
      "description": string,
      "din276_code": string,
      "quantity": number | null,
      "amount": number | null,
      "unit": string | null,
      "truth_state": "inferred",
      "source_reference": "short quote from input"
    }
  ],
  "schedule": [
    {
      "task": string,
      "hoai_phase": number,
      "truth_state": "inferred",
      "source_reference": "short quote from input"
    }
  ],
  "stakeholders": [
    {
      "name": string,
      "role": string,
      "truth_state": "inferred",
      "source_reference": "short quote from input"
    }
  ],
  "missing_data": [string]
}

Rules:
- Do NOT output empty rows.
- Do NOT repeat generic labels such as "cost item".
- Do NOT hallucinate missing values.
- Use strict official references: HOAI LPH 1-9 and DIN 276 3-digit groups like 300/400/500/700.
- Keep entries legally auditable and deterministic.
- If value cannot be extracted, omit row and add reason in missing_data.

INPUT:
${aiInputText}`;

  const structuringModel = getStructuringModel();
  const structuring = await groqJsonChat(
    client,
    structuringModel,
    structuringSystemPrompt,
    structuringUserPrompt
  );
  countCall(structuringModel, structuring.usage);

  let structured: StructuredProjectFacts;
  try {
    structured = parseAndValidateStructured(structuring.text);
  } catch {
    if (aiCallsCount >= 3) {
      throw new Error("Structured JSON invalid and retry budget exhausted");
    }
    const retry = await groqJsonChat(
      client,
      structuringModel,
      `${structuringSystemPrompt}\n\nReturn ONLY valid JSON. No text.`,
      structuringUserPrompt
    );
    countCall(structuringModel, retry.usage);
    structured = parseAndValidateStructured(retry.text);
  }

  const aiProcessingMs = Date.now() - aiStarted;

  return {
    text: aiInputText,
    structured,
    presentation_text: buildPresentationText(structured),
    source_reference: buildSourceReference(input, text),
    performance_metrics: {
      extraction_ms: extractionMs,
      ai_processing_ms: aiProcessingMs,
      total_tokens_used: totalTokensUsed,
      ai_calls_count: aiCallsCount,
      model_used: modelsUsed,
    },
  };
}

export interface CriterionAttestationInput {
  key: string;
  label: string;
}

export interface CriterionAttestation {
  key: string;
  satisfied: boolean;
  supportingQuote: string;
  reason: string;
}

/**
 * Given the parsed text of an evidence document and a list of unmet gate criteria,
 * ask the active LLM (IONOS / Groq) which criteria the document actually satisfies.
 *
 * Used by the "Add Evidence & Re-verify" flow on a gate: the standard structured-fact
 * extraction does not always populate the exact field name the gate-evaluator looks
 * up (e.g. an architect's permit-letter may not parse as `building_permit_status`).
 * The attestation pass cross-references the document's content with the criterion
 * label directly and lets the gate-evaluator trust the result.
 */
export async function attestCriteriaFromEvidenceText(
  documentText: string,
  criteria: CriterionAttestationInput[]
): Promise<CriterionAttestation[]> {
  if (criteria.length === 0 || !documentText.trim()) return [];

  const client = getGroqClient();
  const model = getStructuringModel();

  const trimmedText = documentText.length > 12000 ? documentText.slice(0, 12000) : documentText;

  const systemPrompt = `You are a strict construction-tender gate auditor.

Given the text of one piece of evidence (a contract, permit letter, drawing list,
specification, brief, etc.) and a numbered list of UNMET gate criteria, your job
is to decide — for each criterion — whether the document's content provides direct,
auditable evidence that the criterion is satisfied.

Rules:
- Only mark satisfied=true when the text contains a clear, direct statement.
- Be conservative. If the text is ambiguous or only weakly related, satisfied=false.
- Always include a short verbatim quote from the input as supportingQuote.
- supportingQuote MUST be a substring of the input text (max 240 characters).
- Return JSON: { "results": [{ "key": string, "satisfied": boolean, "supportingQuote": string, "reason": string }, ...] }
- Include one entry per input criterion, in the same order.`;

  const criteriaList = criteria
    .map((c, i) => `${i + 1}. key="${c.key}" — label: "${c.label}"`)
    .join("\n");

  const userPrompt = `UNMET CRITERIA (decide one by one):
${criteriaList}

EVIDENCE TEXT:
${trimmedText}

Return JSON only.`;

  let raw: string;
  try {
    const response = await groqJsonChat(client, model, systemPrompt, userPrompt);
    raw = response.text;
  } catch {
    return [];
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }

  const results = (parsed as { results?: unknown }).results;
  if (!Array.isArray(results)) return [];

  const out: CriterionAttestation[] = [];
  for (const item of results) {
    if (!item || typeof item !== "object") continue;
    const obj = item as Record<string, unknown>;
    const key = typeof obj.key === "string" ? obj.key : "";
    if (!key || !criteria.some((c) => c.key === key)) continue;
    const satisfied = obj.satisfied === true;
    const supportingQuote =
      typeof obj.supportingQuote === "string" ? obj.supportingQuote.slice(0, 240) : "";
    const reason = typeof obj.reason === "string" ? obj.reason.slice(0, 240) : "";
    out.push({ key, satisfied, supportingQuote, reason });
  }
  return out;
}
