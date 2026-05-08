import { db, lvPositionen, costLineItems } from "@tenderfish/db";
import { and, eq, isNull, or } from "drizzle-orm";
import { aiChat } from "../lib/ai-client";
import { isValidDin276Code, getDin276Group } from "@tenderfish/shared";

// ─── Types ─────────────────────────────────────────────────────

export type ClassifySource = "ai" | "manual" | "rule";

export interface ClassifyResult {
  code: string; // e.g. "330", "331"
  level: 1 | 2 | 3;
  confidence: number; // 0..100
  source: ClassifySource;
  rationale: string;
}

export interface BatchSummary {
  updated: number;
  ruleHits: number;
  aiHits: number;
  skipped: number;
}

interface PositionInput {
  id: string;
  text: string; // combined kurztext + langtext for classification
  unit: string;
}

// ─── Rule-based fast path ─────────────────────────────────────
// Cheap, deterministic. Catches the most repetitive cases so we
// don't burn AI tokens on obvious classifications.

interface Rule {
  test: (text: string, unit: string) => boolean;
  code: string;
  rationale: string;
}

const RULES: Rule[] = [
  // KG 700 — fees / soft costs
  {
    test: (t) => /\b(honorar|architektenleistung|ingenieurleistung|planungsleistung|gutachter|bauleitung|nebenkosten|baunebenkosten)\b/i.test(t),
    code: "730",
    rationale: "Architect/engineer fees signal — KG 730",
  },
  {
    test: (t) => /\b(genehmigung|baugenehmigung|prüfgebühr|gebühr|abgabe)\b/i.test(t),
    code: "770",
    rationale: "Permit/fee signal — KG 770",
  },

  // KG 200 — site preparation
  {
    test: (t) => /\b(abbruch|rückbau|entsorgung|baustelleneinrichtung|baustellenräumung)\b/i.test(t),
    code: "210",
    rationale: "Site clearance / demolition — KG 210",
  },
  {
    test: (t) => /\b(erschließung|hausanschluss|kanalanschluss|wasseranschluss|stromanschluss)\b/i.test(t),
    code: "220",
    rationale: "Public servicing connection — KG 220",
  },

  // KG 300 — construction
  {
    test: (t) => /\b(erdbau|aushub|baugrube|bodenaushub)\b/i.test(t),
    code: "310",
    rationale: "Excavation / earthworks — KG 310",
  },
  {
    test: (t) => /\b(fundament|bodenplatte|gründung|sauberkeitsschicht)\b/i.test(t),
    code: "320",
    rationale: "Foundations — KG 320",
  },
  {
    test: (t) => /\b(außenwand|aussenwand|fassade)\b/i.test(t) && /\b(tragend|stahlbeton|mauerwerk)\b/i.test(t),
    code: "331",
    rationale: "Load-bearing external wall — KG 331",
  },
  {
    test: (t) => /\b(fenster|außentür|aussentür)\b/i.test(t),
    code: "334",
    rationale: "External windows/doors — KG 334",
  },
  {
    test: (t) => /\b(innenwand)\b/i.test(t) && /\b(tragend)\b/i.test(t),
    code: "341",
    rationale: "Load-bearing internal wall — KG 341",
  },
  {
    test: (t) => /\b(trockenbau|leichtbau|trennwand)\b/i.test(t) || /\b(innenwand)\b/i.test(t),
    code: "342",
    rationale: "Partition wall — KG 342",
  },
  {
    test: (t) => /\b(innentür)\b/i.test(t),
    code: "344",
    rationale: "Internal doors — KG 344",
  },
  {
    test: (t) => /\b(decke|geschossdecke|stahlbetondecke)\b/i.test(t),
    code: "351",
    rationale: "Floor / slab structure — KG 351",
  },
  {
    test: (t) => /\b(estrich|bodenbelag|parkett|fliese|teppich)\b/i.test(t),
    code: "352",
    rationale: "Floor covering — KG 352",
  },
  {
    test: (t) => /\b(dach|dachstuhl|dachhaut|dachpfanne|dachziegel|abdichtung)\b/i.test(t),
    code: "363",
    rationale: "Roof covering — KG 363",
  },

  // KG 400 — services
  {
    test: (t) => /\b(sanitär|trinkwasser|abwasser|abfluss|wc|waschbecken|dusche)\b/i.test(t),
    code: "410",
    rationale: "Plumbing — KG 410",
  },
  {
    test: (t) => /\b(heizung|wärmepumpe|fußbodenheizung|heizkörper|brenner|kessel)\b/i.test(t),
    code: "420",
    rationale: "Heating — KG 420",
  },
  {
    test: (t) => /\b(lüftung|klima|rlt|raumlufttechnik|hvac|lüftungsanlage)\b/i.test(t),
    code: "430",
    rationale: "Ventilation/HVAC — KG 430",
  },
  {
    test: (t) => /\b(elektro|stromkabel|verteiler|leuchte|steckdose|beleuchtung)\b/i.test(t),
    code: "440",
    rationale: "Electrical — KG 440",
  },
  {
    test: (t) => /\b(aufzug|fahrstuhl|rolltreppe|hebebühne)\b/i.test(t),
    code: "460",
    rationale: "Elevator/conveyor — KG 460",
  },

  // KG 500 — external works
  {
    test: (t) => /\b(pflaster|asphalt|außenanlage|aussenanlage|gehweg|hofbelag)\b/i.test(t),
    code: "530",
    rationale: "External surface — KG 530",
  },
  {
    test: (t) => /\b(bepflanzung|rasen|baum|hecke|gartengestaltung)\b/i.test(t),
    code: "570",
    rationale: "Planting / lawn — KG 570",
  },
];

function applyRules(text: string, unit: string): ClassifyResult | null {
  for (const rule of RULES) {
    if (rule.test(text, unit)) {
      const group = getDin276Group(rule.code);
      if (!group) continue;
      return {
        code: rule.code,
        level: group.level,
        confidence: 80, // rules are conservative; AI re-rank can override later
        source: "rule",
        rationale: rule.rationale,
      };
    }
  }
  // KG 700 catch-all: einheit "psch" + soft-cost-ish description
  if (unit.toLowerCase() === "psch" && /\b(beratung|leistung|honorar)\b/i.test(text)) {
    return {
      code: "730",
      level: 2,
      confidence: 70,
      source: "rule",
      rationale: "Lumpsum service signal — KG 730",
    };
  }
  return null;
}

// ─── AI batch classification ──────────────────────────────────

interface AiResult {
  id: string;
  code: string;
  level: 1 | 2 | 3;
  confidence: number;
  rationale: string;
}

async function classifyBatchWithAi(items: PositionInput[]): Promise<AiResult[]> {
  if (items.length === 0) return [];

  const prompt = items
    .map((it) => `id="${it.id}" unit="${it.unit}" text=${JSON.stringify(it.text.slice(0, 300))}`)
    .join("\n");

  const text = await aiChat({
    maxTokens: 4096,
    messages: [{ role: "user", content: `Classify each line to its DIN 276 cost group.\n\n${prompt}` }],
    system: `You are a DIN 276:2018 classifier for German construction BoQ positions.
For each input line, output the most appropriate DIN 276 cost group code at the deepest level you are confident about (level 1 = "300", level 2 = "330", level 3 = "331").

Anchors:
- 100 site, 200 site prep, 300 building construction, 400 building services (MEP), 500 external works, 600 FFE, 700 ancillary/fees.
- Common KG-330 children: 331 load-bearing external walls, 332 non-load-bearing external walls, 334 external windows/doors.
- Common KG-340 children: 341 load-bearing internal walls, 342 partition walls, 344 internal doors.
- Honorare/Planungsleistungen → 730. Permits/fees → 770. Architectural/engineering services NEVER 300/400/500.

Return ONLY valid JSON, no markdown:
{
  "results": [
    { "id": "string (echo input id)", "code": "string (3 digits)", "level": 1|2|3, "confidence": 0..100, "rationale": "string (max 100 chars)" }
  ]
}

If you are uncertain at level 3, return level 2. If uncertain at level 2, return level 1. confidence reflects how sure you are at the level you returned. Be deterministic.`,
  });

  let parsed: { results: AiResult[] };
  try {
    const trimmed = text.trim().replace(/^```json\s*/i, "").replace(/```\s*$/, "");
    parsed = JSON.parse(trimmed) as { results: AiResult[] };
  } catch {
    return [];
  }
  if (!parsed?.results || !Array.isArray(parsed.results)) return [];

  return parsed.results
    .filter((r) => r && typeof r.id === "string" && isValidDin276Code(r.code))
    .map((r) => ({
      id: r.id,
      code: r.code,
      level: (r.level === 1 || r.level === 2 || r.level === 3 ? r.level : (getDin276Group(r.code)?.level ?? 1)) as 1 | 2 | 3,
      confidence: Math.max(0, Math.min(100, Math.round(r.confidence ?? 50))),
      rationale: (r.rationale ?? "").slice(0, 200),
    }));
}

// ─── Public API ───────────────────────────────────────────────

const AI_BATCH_SIZE = 25;

/**
 * Classify all unclassified positions of an LV.
 * - Skips rows where din276Source === "manual" (locked).
 * - Skips rows that already have a confidence ≥ 80.
 */
export async function classifyLvPositions(lvId: string): Promise<BatchSummary> {
  const rows = await db
    .select({
      id: lvPositionen.id,
      kurztext: lvPositionen.kurztext,
      langtext: lvPositionen.langtext,
      einheit: lvPositionen.einheit,
      din276Source: lvPositionen.din276Source,
      din276Confidence: lvPositionen.din276Confidence,
    })
    .from(lvPositionen)
    .where(eq(lvPositionen.lvId, lvId));

  return classifyAndPersist(
    rows
      .filter((r) => r.din276Source !== "manual")
      .filter((r) => (r.din276Confidence ?? 0) < 80)
      .map((r) => ({
        id: r.id,
        text: [r.kurztext, r.langtext].filter(Boolean).join(" "),
        unit: r.einheit,
      })),
    async (id, result) => {
      await db
        .update(lvPositionen)
        .set({
          costGroupCode: result.code,
          din276Confidence: result.confidence,
          din276Source: result.source,
          din276Rationale: result.rationale,
        })
        .where(eq(lvPositionen.id, id));
    }
  );
}

/**
 * Classify all cost line items of a snapshot.
 * Same rules: skip manual; skip already-confident rows.
 */
export async function classifyCostLineItems(snapshotId: string): Promise<BatchSummary> {
  const rows = await db
    .select({
      id: costLineItems.id,
      description: costLineItems.description,
      unit: costLineItems.unit,
      din276Source: costLineItems.din276Source,
      din276Confidence: costLineItems.din276Confidence,
    })
    .from(costLineItems)
    .where(
      and(
        eq(costLineItems.snapshotId, snapshotId),
        or(isNull(costLineItems.din276Source), eq(costLineItems.din276Source, "ai"), eq(costLineItems.din276Source, "rule"))
      )
    );

  return classifyAndPersist(
    rows
      .filter((r) => (r.din276Confidence ?? 0) < 80)
      .map((r) => ({
        id: r.id,
        text: r.description ?? "",
        unit: r.unit ?? "",
      })),
    async (id, result) => {
      const group = getDin276Group(result.code);
      await db
        .update(costLineItems)
        .set({
          costGroupCode: result.code,
          costGroupLevel: group?.level ?? result.level,
          din276Confidence: result.confidence,
          din276Source: result.source,
          din276Rationale: result.rationale,
        })
        .where(eq(costLineItems.id, id));
    }
  );
}

async function classifyAndPersist(
  inputs: PositionInput[],
  persist: (id: string, result: ClassifyResult) => Promise<void>
): Promise<BatchSummary> {
  let ruleHits = 0;
  let aiHits = 0;
  let updated = 0;
  let skipped = 0;

  const aiQueue: PositionInput[] = [];

  // Pass 1: rules
  for (const input of inputs) {
    if (!input.text.trim()) {
      skipped += 1;
      continue;
    }
    const ruleResult = applyRules(input.text, input.unit);
    if (ruleResult) {
      await persist(input.id, ruleResult);
      ruleHits += 1;
      updated += 1;
    } else {
      aiQueue.push(input);
    }
  }

  // Pass 2: AI batches
  for (let i = 0; i < aiQueue.length; i += AI_BATCH_SIZE) {
    const batch = aiQueue.slice(i, i + AI_BATCH_SIZE);
    const results = await classifyBatchWithAi(batch);
    const byId = new Map(results.map((r) => [r.id, r]));

    for (const input of batch) {
      const ai = byId.get(input.id);
      if (!ai) {
        skipped += 1;
        continue;
      }
      await persist(input.id, {
        code: ai.code,
        level: ai.level,
        confidence: ai.confidence,
        source: "ai",
        rationale: ai.rationale,
      });
      aiHits += 1;
      updated += 1;
    }
  }

  return { updated, ruleHits, aiHits, skipped };
}
