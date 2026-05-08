import { XMLParser } from "fast-xml-parser";
import {
  db,
  leistungsverzeichnisse,
  lvPositionen,
  gaebExchangeLog,
} from "@tenderfish/db";
import { eq } from "drizzle-orm";

// ─── Types ─────────────────────────────────────────────────────

export type GaebDaPhase = "x81" | "x82" | "x83" | "x84" | "x86";

export interface ParsedPosition {
  ordnungszahl: string;
  kurztext: string;
  langtext: string | null;
  menge: number; // stored as integer × 1000 (DB precision)
  einheit: string;
  einheitspreis: number; // cents
  gesamtpreis: number; // cents
  positionType:
    | "normalposition"
    | "alternativposition"
    | "eventuaposition"
    | "bedarfsposition"
    | "grundposition"
    | "wahlposition"
    | "zuschlagsposition"
    | "pauschalposition"
    | "stundenlohnarbeiten";
  titel: string | null;
  titelLevel: number;
}

export interface ParsedTitle {
  rno: string;
  label: string;
  level: number; // depth in the hierarchy (1, 2, 3...)
}

export interface ParsedLot {
  rno: string;
  label: string;
  titles: ParsedTitle[];
}

export interface GaebTree {
  gaebVersion: string; // e.g. "GAEB DA XML 3.2"
  daPhase: GaebDaPhase | null;
  projectName: string | null;
  lots: ParsedLot[];
  positions: ParsedPosition[];
  totalNet: number | null; // cents, when present in the file
  totalGross: number | null;
  warnings: string[];
}

export interface GaebImportResult {
  lvId: string;
  positionsImported: number;
  warnings: string[];
  exchangeLogId: string;
  daPhase: GaebDaPhase;
  totalNet: number;
  totalGross: number;
}

// ─── XML helpers ───────────────────────────────────────────────

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  trimValues: true,
  parseTagValue: false,
});

function asArray<T>(value: T | T[] | null | undefined): T[] {
  if (value === null || value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

function toText(value: unknown): string {
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value).trim();
  }
  if (value && typeof value === "object") {
    const node = value as Record<string, unknown>;
    const directText = node["#text"];
    if (typeof directText === "string") return directText.trim();
    // GAEB long text often has <p>…</p> wrappers
    const para = node["p"];
    if (typeof para === "string") return para.trim();
    if (Array.isArray(para)) {
      return para.map((p) => toText(p)).filter(Boolean).join("\n");
    }
  }
  return "";
}

function pickFirstText(node: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const candidate = node[key];
    const text = toText(candidate);
    if (text) return text;
  }
  return "";
}

/** Parses GAEB price strings like "12,34" or "12.34" → cents (integer). */
function parsePriceToCents(raw: string | null | undefined): number {
  if (!raw) return 0;
  const normalized = raw.replace(/\s/g, "").replace(",", ".");
  const value = Number.parseFloat(normalized);
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 100);
}

/** Parses GAEB quantity strings → integer × 1000 (DB precision). */
function parseQuantityToMinor(raw: string | null | undefined): number {
  if (!raw) return 0;
  const normalized = raw.replace(/\s/g, "").replace(",", ".");
  const value = Number.parseFloat(normalized);
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 1000);
}

function detectDaPhase(root: Record<string, unknown>, fileName: string): GaebDaPhase | null {
  // Prefer XML hint: <Award><AwardInfo><PhaseInfo PhaseType="…"/>
  const awardInfo = (((root["GAEB"] as Record<string, unknown>)?.["Award"] as Record<string, unknown>)?.[
    "AwardInfo"
  ] as Record<string, unknown>) ?? null;
  if (awardInfo) {
    // Phase may be on AwardInfo directly (older files) or inside <PhaseInfo>.
    const direct = pickFirstText(awardInfo, ["@_PhaseType", "PhaseType", "Phase"]);
    let phase = direct;
    if (!phase && awardInfo["PhaseInfo"]) {
      const pi = awardInfo["PhaseInfo"] as Record<string, unknown> | string;
      if (typeof pi === "object") {
        phase = pickFirstText(pi, ["@_PhaseType", "PhaseType", "Phase"]);
      }
    }
    if (phase) {
      const lower = phase.toLowerCase();
      if (lower.includes("81")) return "x81";
      if (lower.includes("82")) return "x82";
      if (lower.includes("83")) return "x83";
      if (lower.includes("84")) return "x84";
      if (lower.includes("86")) return "x86";
    }
  }
  // Fallback: filename extension
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".x81")) return "x81";
  if (lower.endsWith(".x82")) return "x82";
  if (lower.endsWith(".x83")) return "x83";
  if (lower.endsWith(".x84")) return "x84";
  if (lower.endsWith(".x86")) return "x86";
  return null;
}

function detectGaebVersion(root: Record<string, unknown>): string {
  const gaeb = root["GAEB"] as Record<string, unknown> | undefined;
  if (!gaeb) return "unknown";
  const version = pickFirstText(gaeb, ["@_VersNo", "@_Version", "VersNo", "Version"]);
  return version ? `GAEB DA XML ${version}` : "GAEB DA XML";
}

/** Map GAEB position-type code (1..9) or German label to the DB enum. */
function mapPositionType(raw: string | null | undefined): ParsedPosition["positionType"] {
  if (!raw) return "normalposition";
  const lower = raw.toLowerCase();
  if (lower.includes("altern")) return "alternativposition";
  if (lower.includes("eventu")) return "eventuaposition";
  if (lower.includes("bedarf")) return "bedarfsposition";
  if (lower.includes("grund")) return "grundposition";
  if (lower.includes("wahl")) return "wahlposition";
  if (lower.includes("zuschlag")) return "zuschlagsposition";
  if (lower.includes("pausch")) return "pauschalposition";
  if (lower.includes("stunden")) return "stundenlohnarbeiten";
  return "normalposition";
}

// ─── Tree walker ──────────────────────────────────────────────

interface WalkContext {
  positions: ParsedPosition[];
  warnings: string[];
  titleStack: ParsedTitle[]; // current ancestors
  currentLot: ParsedLot | null;
  lots: ParsedLot[];
}

function walk(node: unknown, ctx: WalkContext): void {
  if (!node || typeof node !== "object") return;
  const current = node as Record<string, unknown>;

  // Lots
  for (const lot of asArray(current["Lot"] ?? current["Los"])) {
    if (!lot || typeof lot !== "object") continue;
    const lotObj = lot as Record<string, unknown>;
    const rno = pickFirstText(lotObj, ["@_RNoPart", "@_RNo", "RNoPart", "RNo", "Nr", "No"]);
    const label = pickFirstText(lotObj, ["Label", "LblBoQ", "ShortText", "LongText", "Description"]);
    const parsedLot: ParsedLot = { rno: rno || "01", label, titles: [] };
    ctx.lots.push(parsedLot);
    ctx.currentLot = parsedLot;
    walk(lotObj, ctx);
    ctx.currentLot = null;
  }

  // Titles / categories
  for (const title of asArray(current["BoQCtgy"] ?? current["Title"] ?? current["Titl"])) {
    if (!title || typeof title !== "object") continue;
    const titleObj = title as Record<string, unknown>;
    const rno = pickFirstText(titleObj, ["@_RNoPart", "@_RNo", "RNoPart", "RNo", "Nr", "No"]);
    const label = pickFirstText(titleObj, ["LblTitle", "Label", "ShortText", "LongText", "Description"]);
    const parsedTitle: ParsedTitle = { rno, label, level: ctx.titleStack.length + 1 };
    if (ctx.currentLot) ctx.currentLot.titles.push(parsedTitle);
    ctx.titleStack.push(parsedTitle);
    walk(titleObj, ctx);
    ctx.titleStack.pop();
  }

  // Positions / items
  for (const pos of asArray(current["Item"] ?? current["Position"] ?? current["Pos"])) {
    if (!pos || typeof pos !== "object") continue;
    const posObj = pos as Record<string, unknown>;
    const ordnungszahl = pickFirstText(posObj, [
      "@_RNoPart",
      "@_RNo",
      "RNoPart",
      "RNo",
      "Nr",
      "No",
      "ItemNo",
    ]);
    if (!ordnungszahl) {
      ctx.warnings.push(`Skipped position with missing ordnungszahl in title "${ctx.titleStack[ctx.titleStack.length - 1]?.label ?? "root"}"`);
      continue;
    }

    const kurztext = pickFirstText(posObj, ["ShortText", "OutlineText", "Description"]);
    const langtextRaw = pickFirstText(posObj, ["LongText", "TextOutlTxt", "Text"]);
    const qtyStr = pickFirstText(posObj, ["Qty", "Quantity"]);
    const unit = pickFirstText(posObj, ["QU", "Unit", "Uom"]) || "psch";
    const unitPriceStr = pickFirstText(posObj, ["UP", "UnitPrice", "UPTaxExcl", "Price"]);
    const totalStr = pickFirstText(posObj, ["ItPrc", "TotalPrice", "Total", "ItemTotal"]);
    const positionTypeRaw = pickFirstText(posObj, ["@_BoQCtgyType", "@_TypeRef", "PositionType", "Type"]);

    const menge = parseQuantityToMinor(qtyStr);
    const einheitspreis = parsePriceToCents(unitPriceStr);
    let gesamtpreis = parsePriceToCents(totalStr);

    // Synthesize total when missing — file may rely on consumer to compute.
    if (!gesamtpreis && menge && einheitspreis) {
      gesamtpreis = Math.round((menge / 1000) * einheitspreis);
    }

    const titel = ctx.titleStack[ctx.titleStack.length - 1] ?? null;

    ctx.positions.push({
      ordnungszahl,
      kurztext: kurztext || "(no description)",
      langtext: langtextRaw || null,
      menge,
      einheit: unit,
      einheitspreis,
      gesamtpreis,
      positionType: mapPositionType(positionTypeRaw),
      titel: titel ? `${titel.rno} ${titel.label}`.trim() : null,
      titelLevel: ctx.titleStack.length,
    });
  }

  // Recurse into other children we haven't already handled.
  for (const [key, child] of Object.entries(current)) {
    if (["Lot", "Los", "BoQCtgy", "Title", "Titl", "Item", "Position", "Pos"].includes(key)) continue;
    if (Array.isArray(child)) {
      for (const nested of child) walk(nested, ctx);
    } else if (child && typeof child === "object") {
      walk(child, ctx);
    }
  }
}

// ─── Public API ───────────────────────────────────────────────

export function parseGaebTree(buffer: Buffer, fileName: string): GaebTree {
  const xmlText = buffer.toString("utf-8");
  const root = xmlParser.parse(xmlText) as Record<string, unknown>;

  const warnings: string[] = [];

  // Pragmatic structural validation (no XSD bundling).
  if (!root["GAEB"] && !root["@_GAEB"]) {
    warnings.push("Root <GAEB> element not found; file may not be valid GAEB DA XML");
  }

  const gaebVersion = detectGaebVersion(root);
  const daPhase = detectDaPhase(root, fileName);
  if (!daPhase) {
    warnings.push("Could not determine DA phase (X81/X83/X84/X86) from file");
  }

  const ctx: WalkContext = {
    positions: [],
    warnings,
    titleStack: [],
    currentLot: null,
    lots: [],
  };
  walk(root, ctx);

  // Project metadata. PrjInfo may sit either under <Award> (newer files) or
  // directly under <GAEB> (some toolchains).
  const gaebRoot = (root["GAEB"] as Record<string, unknown>) ?? {};
  const award = (gaebRoot["Award"] as Record<string, unknown>) ?? null;
  const prjInfo =
    (gaebRoot["PrjInfo"] as Record<string, unknown>) ??
    (award?.["PrjInfo"] as Record<string, unknown>) ??
    null;
  const projectName = prjInfo ? pickFirstText(prjInfo, ["NamePrj", "LblPrj", "ShortText", "Name"]) : null;

  // Header totals (often absent in X81; common in X83/X84/X86 inside <Total> or <BoQTotal>)
  const totalsNode = (award?.["BoQ"] as Record<string, unknown>)?.["Total"] as Record<string, unknown> | undefined;
  const totalNet = totalsNode
    ? parsePriceToCents(pickFirstText(totalsNode, ["NetTotal", "@_Net", "Net"]))
    : null;
  const totalGross = totalsNode
    ? parsePriceToCents(pickFirstText(totalsNode, ["GrossTotal", "@_Gross", "Gross"]))
    : null;

  return {
    gaebVersion,
    daPhase,
    projectName: projectName || null,
    lots: ctx.lots,
    positions: ctx.positions,
    totalNet: totalNet || null,
    totalGross: totalGross || null,
    warnings,
  };
}

interface ImportArgs {
  projectId: string;
  packageId?: string | null;
  userId: string;
  fileName: string;
  fileBuffer: Buffer;
  fileRef: string;
  fileSize: number;
}

export async function importGaebX83(args: ImportArgs): Promise<GaebImportResult> {
  const tree = parseGaebTree(args.fileBuffer, args.fileName);
  if (tree.daPhase && tree.daPhase !== "x83") {
    tree.warnings.push(`File self-identifies as ${tree.daPhase} but was uploaded as X83 import`);
  }
  return persistImport(args, tree, "x83", null);
}

export async function importGaebX84(
  args: ImportArgs & { parentLvId: string }
): Promise<GaebImportResult> {
  const tree = parseGaebTree(args.fileBuffer, args.fileName);
  if (tree.daPhase && tree.daPhase !== "x84") {
    tree.warnings.push(`File self-identifies as ${tree.daPhase} but was uploaded as X84 correction`);
  }
  // Look up parent for version increment.
  const [parent] = await db
    .select()
    .from(leistungsverzeichnisse)
    .where(eq(leistungsverzeichnisse.id, args.parentLvId))
    .limit(1);
  if (!parent) {
    throw new Error(`Parent LV ${args.parentLvId} not found`);
  }
  return persistImport(args, tree, "x84", parent);
}

const phaseEnumMap: Record<GaebDaPhase, "gaeb_81" | "gaeb_82" | "gaeb_83" | "gaeb_84" | "gaeb_86"> = {
  x81: "gaeb_81",
  x82: "gaeb_82",
  x83: "gaeb_83",
  x84: "gaeb_84",
  x86: "gaeb_86",
};

async function persistImport(
  args: ImportArgs,
  tree: GaebTree,
  phase: GaebDaPhase,
  parent: { id: string; version: number; lvNumber: string | null; title: string } | null
): Promise<GaebImportResult> {
  // Compute totals from positions when header lacks them.
  const computedNet = tree.positions.reduce((sum, p) => sum + p.gesamtpreis, 0);
  const totalNet = tree.totalNet ?? computedNet;
  // GAEB net+VAT (default 19%) when gross is missing.
  const totalGross = tree.totalGross ?? Math.round(totalNet * 1.19);

  const [lv] = await db
    .insert(leistungsverzeichnisse)
    .values({
      projectId: args.projectId,
      packageId: args.packageId ?? null,
      title: tree.projectName ?? parent?.title ?? args.fileName.replace(/\.x\d+$/i, ""),
      lvNumber: parent?.lvNumber ?? null,
      exchangePhase: phaseEnumMap[phase],
      totalNet,
      totalGross,
      positionCount: tree.positions.length,
      gaebFileRef: args.fileRef,
      gaebVersion: tree.gaebVersion,
      parentLvId: parent?.id ?? null,
      version: parent ? parent.version + 1 : 1,
      createdBy: args.userId,
      notes: tree.warnings.length > 0 ? tree.warnings.slice(0, 5).join(" · ") : null,
    })
    .returning();

  if (tree.positions.length > 0) {
    await db.insert(lvPositionen).values(
      tree.positions.map((p) => ({
        lvId: lv.id,
        ordnungszahl: p.ordnungszahl,
        titel: p.titel,
        titelLevel: p.titelLevel,
        positionType: p.positionType,
        kurztext: p.kurztext.slice(0, 500),
        langtext: p.langtext,
        menge: p.menge,
        einheit: p.einheit.slice(0, 50),
        einheitspreis: p.einheitspreis,
        gesamtpreis: p.gesamtpreis,
      }))
    );
  }

  const errorLogJson = tree.warnings.length > 0 ? JSON.stringify(tree.warnings) : null;

  const [logRow] = await db
    .insert(gaebExchangeLog)
    .values({
      projectId: args.projectId,
      lvId: lv.id,
      direction: "import",
      exchangePhase: phaseEnumMap[phase],
      fileName: args.fileName,
      fileRef: args.fileRef,
      fileSize: args.fileSize,
      gaebVersion: tree.gaebVersion,
      positionsImported: tree.positions.length,
      errorLog: errorLogJson,
      importedBy: args.userId,
    })
    .returning();

  return {
    lvId: lv.id,
    positionsImported: tree.positions.length,
    warnings: tree.warnings,
    exchangeLogId: logRow.id,
    daPhase: phase,
    totalNet,
    totalGross,
  };
}
