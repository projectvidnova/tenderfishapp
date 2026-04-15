/**
 * AI Pipeline service — fact extraction, classification, and structure generation
 * using the Anthropic Claude API.
 */

import Anthropic from "@anthropic-ai/sdk";

const getClient = () => {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not configured");
  return new Anthropic({ apiKey });
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

  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 4096,
    messages: [
      {
        role: "user",
        content: `Analyse the following project material and extract structured facts.${contextSection}\n\n--- PROJECT MATERIAL ---\n${documentText.slice(0, 100000)}`,
      },
    ],
    system: `You are an expert AI project analyst for German architectural projects under HOAI (Honorarordnung für Architekten und Ingenieure).

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

Required fields to extract: project_name, project_type, location, client_name, client_representative, decision_authority, scope_description, procurement_model, target_completion, known_deadlines, known_consultants, known_constraints, mentioned_risks, mentioned_approvals, lph_start_estimate`,
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

  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 2048,
    messages: [
      {
        role: "user",
        content: `Classify this architectural project based on the following material and extracted facts.\n\nExtracted facts:\n${factsContext}\n\nSource material (excerpt):\n${documentText.slice(0, 50000)}`,
      },
    ],
    system: `You are an expert classifier for German HOAI architectural projects.

Classify the project and return ONLY valid JSON. No preamble. No markdown fences.

Schema:
{
  "type": "new_build|refurbishment|conversion|interior_fit_out|mixed_use",
  "delivery_model": "general_contractor|single_trades|unclear",
  "planning_state": "pre_planning|early_planning|mid_planning|late_planning|execution|post_completion",
  "complexity_level": "simple|moderate|complex|very_complex",
  "lph_current": 1-9,
  "lph_implied_start": 1-9,
  "special_flags": ["string array of notable characteristics"]
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
    ],
  };
  gateB.pass = gateB.criteria.every((c) => c.met);

  const gateC: GateCheck = {
    gate: "C",
    pass: false,
    criteria: [
      { key: "approvals_listed", label: "Authority documents listed", met: factNotMissing("mentioned_approvals") },
      { key: "client_brief", label: "Client brief confirmed", met: factNotMissing("decision_authority") },
    ],
  };
  gateC.pass = gateC.criteria.every((c) => c.met);

  const gateD: GateCheck = {
    gate: "D",
    pass: false,
    criteria: [
      { key: "procurement_model", label: "Procurement model defined", met: factNotMissing("procurement_model") },
      { key: "consultants", label: "Consultant disciplines identified", met: factNotMissing("known_consultants") },
    ],
  };
  gateD.pass = gateD.criteria.every((c) => c.met);

  // Gates E and F require execution-stage data — typically not passable at intake
  const gateE: GateCheck = {
    gate: "E",
    pass: false,
    criteria: [
      { key: "contracts_awarded", label: "All contracts awarded", met: false },
      { key: "site_logistics", label: "Site logistics plan approved", met: false },
    ],
  };

  const gateF: GateCheck = {
    gate: "F",
    pass: false,
    criteria: [
      { key: "defects_resolved", label: "Defects resolved", met: false },
      { key: "final_account", label: "Final account signed", met: false },
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
    system: `You are an expert project planner for German HOAI architectural projects.

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
  "missing_information": ["string"]
}

Use realistic German HOAI project timelines. All 9 LPH phases must be included. Ensure risks and consultant requirements are comprehensive for the project type.`,
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
