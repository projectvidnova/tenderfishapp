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

import Anthropic from "@anthropic-ai/sdk";
import { getEnv } from "../lib/env";

const getClient = () => {
  const env = getEnv();
  if (!env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY not configured");
  return new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
};

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
  const client = getClient();

  const contextSection = formContext
    ? `\n\nUser-provided context:\n${Object.entries(formContext)
        .filter(([, v]) => v)
        .map(([k, v]) => `- ${k}: ${v}`)
        .join("\n")}`
    : "";

  const env = getEnv();

  const response = await client.messages.create({
    model: env.AI_MODEL,
    max_tokens: env.AI_MAX_TOKENS_EXTRACT,
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
— Regulatory: building_permit_status, fire_protection_class, energy_standard, heritage_protection, environmental_requirements, accessibility_requirements, sigeko_required`,
  });

  const text = response.content[0].type === "text" ? response.content[0].text : "";
  return JSON.parse(text) as FactExtractionResult;
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
  const client = getClient();

  const factsContext = facts
    .filter((f) => f.value && f.data_state !== "MISSING")
    .map((f) => `- ${f.field}: ${f.value} (${f.data_state})`)
    .join("\n");

  const env = getEnv();

  const response = await client.messages.create({
    model: env.AI_MODEL,
    max_tokens: env.AI_MAX_TOKENS_CLASSIFY,
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

  const text = response.content[0].type === "text" ? response.content[0].text : "";
  return JSON.parse(text) as ClassificationResult;
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
  const client = getClient();

  const factsContext = facts
    .filter((f) => f.value)
    .map((f) => `- ${f.field}: ${f.value} (${f.data_state})`)
    .join("\n");

  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 8192,
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

  const text = response.content[0].type === "text" ? response.content[0].text : "";
  return JSON.parse(text) as ProjectStructure;
}

// ─── Vision extraction for images ──────────────────────────────

export async function extractTextFromImage(
  imageBuffer: Buffer,
  fileName: string
): Promise<string> {
  const client = getClient();

  const base64 = imageBuffer.toString("base64");
  const ext = fileName.toLowerCase().split(".").pop();
  const mediaType =
    ext === "png" ? "image/png" : ext === "gif" ? "image/gif" : "image/jpeg";

  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 2048,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: { type: "base64", media_type: mediaType, data: base64 },
          },
          {
            type: "text",
            text: "Extract all readable text from this image. If it's a plan or drawing, describe its contents. Return plain text only.",
          },
        ],
      },
    ],
  });

  return response.content[0].type === "text" ? response.content[0].text : "";
}
