import { XMLBuilder } from "fast-xml-parser";
import {
  db,
  leistungsverzeichnisse,
  lvPositionen,
  bidders,
  projects,
  gaebExchangeLog,
} from "@tenderfish/db";
import { asc, eq } from "drizzle-orm";
import { verifyLvMath, type GaebMathReport } from "./gaeb-math-verifier";

// ─── Public errors ─────────────────────────────────────────────

export class GaebMathBlockError extends Error {
  public readonly report: GaebMathReport;
  constructor(report: GaebMathReport) {
    super("Cannot export GAEB file: arithmetic verification failed");
    this.name = "GaebMathBlockError";
    this.report = report;
  }
}

export class GaebNotFoundError extends Error {
  constructor(lvId: string) {
    super(`Leistungsverzeichnis ${lvId} not found`);
    this.name = "GaebNotFoundError";
  }
}

// ─── Output ────────────────────────────────────────────────────

export interface GaebExportResult {
  xml: string;
  fileName: string;
  exchangeLogId: string;
}

// ─── Builder helpers ───────────────────────────────────────────

const xmlBuilder = new XMLBuilder({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  format: true,
  indentBy: "  ",
  suppressEmptyNode: false,
  processEntities: true,
});

function centsToString(cents: number): string {
  return (cents / 100).toFixed(2);
}

function quantityToString(menge: number): string {
  // menge is stored × 1000
  return (menge / 1000).toFixed(3);
}

function buildItemXml(p: {
  ordnungszahl: string;
  kurztext: string;
  langtext: string | null;
  menge: number;
  einheit: string;
  einheitspreis: number;
  gesamtpreis: number;
  positionType: string;
}, includePrices: boolean) {
  const item: Record<string, unknown> = {
    "@_RNoPart": p.ordnungszahl,
    ShortText: p.kurztext,
    Qty: quantityToString(p.menge),
    QU: p.einheit,
  };
  if (p.langtext) {
    item.Description = { CompleteText: { TextOutlTxt: { p: p.langtext } } };
  }
  if (includePrices) {
    item.UP = centsToString(p.einheitspreis);
    item.ItPrc = centsToString(p.gesamtpreis);
  }
  return item;
}

interface BuildArgs {
  lv: typeof leistungsverzeichnisse.$inferSelect;
  project: { name: string };
  positions: Array<typeof lvPositionen.$inferSelect>;
  awardedBidder?: typeof bidders.$inferSelect;
  phase: "x81" | "x86";
}

function buildGaebXml({ lv, project, positions, awardedBidder, phase }: BuildArgs): string {
  const includePrices = phase === "x86";

  // Group positions by titel preserving import order. Positions with no
  // titel land in a synthetic "Hauptgruppe" so the XML is structurally valid.
  const groups = new Map<string, typeof positions>();
  for (const p of positions) {
    const key = p.titel ?? "Hauptgruppe";
    const list = groups.get(key) ?? [];
    list.push(p);
    groups.set(key, list);
  }

  const boqCtgyNodes = Array.from(groups.entries()).map(([titleLabel, items], idx) => ({
    "@_RNoPart": String(idx + 1).padStart(2, "0"),
    LblTitle: titleLabel,
    Itemlist: {
      Item: items.map((p) => buildItemXml(p, includePrices)),
    },
  }));

  const totalNet = positions.reduce((s, p) => s + p.gesamtpreis, 0);
  const totalGross = Math.round(totalNet * 1.19);

  const phaseAttr = phase === "x86" ? "Awarded" : "BoQRequest";

  const tree: Record<string, unknown> = {
    "?xml": { "@_version": "1.0", "@_encoding": "UTF-8" },
    GAEB: {
      "@_xmlns": "http://www.gaeb.de/GAEB_DA_XML/200407",
      "@_VersNo": "3.2",
      GAEBInfo: {
        VersNo: "3.2",
        Date: new Date().toISOString().slice(0, 10),
        ProgSystem: "Tenderfish",
      },
      PrjInfo: {
        NamePrj: project.name,
        LblPrj: lv.title,
      },
      Award: {
        AwardInfo: {
          PhaseInfo: { "@_PhaseType": phaseAttr },
          Cur: "EUR",
          OZSystem: { OZMaskComplete: "0123456789012" },
        },
        BoQ: {
          BoQInfo: {
            Name: lv.title,
            LblBoQ: lv.lvNumber ?? lv.title,
          },
          BoQBody: {
            BoQCtgy: boqCtgyNodes,
          },
          Total: {
            NetTotal: centsToString(totalNet),
            GrossTotal: centsToString(totalGross),
          },
        },
      },
    },
  };

  if (phase === "x86" && awardedBidder) {
    (tree.GAEB as Record<string, unknown>).Award = {
      ...(tree.GAEB as Record<string, unknown>).Award as Record<string, unknown>,
      Awarded: {
        Bidder: {
          Company: awardedBidder.company,
          Contact: awardedBidder.contactName ?? "",
          Email: awardedBidder.email ?? "",
        },
        AwardedDate: new Date().toISOString().slice(0, 10),
        AwardedAmount: centsToString(awardedBidder.offerAmount ?? totalNet),
      },
    };
  }

  return xmlBuilder.build(tree);
}

// ─── Public API ───────────────────────────────────────────────

async function loadLvWithPositions(lvId: string) {
  const [lv] = await db
    .select()
    .from(leistungsverzeichnisse)
    .where(eq(leistungsverzeichnisse.id, lvId))
    .limit(1);
  if (!lv) throw new GaebNotFoundError(lvId);

  const positions = await db
    .select()
    .from(lvPositionen)
    .where(eq(lvPositionen.lvId, lvId))
    .orderBy(asc(lvPositionen.ordnungszahl));

  const [project] = await db
    .select({ id: projects.id, name: projects.name })
    .from(projects)
    .where(eq(projects.id, lv.projectId))
    .limit(1);

  return { lv, positions, project: project ?? { id: lv.projectId, name: lv.title } };
}

async function logExport(args: {
  lv: typeof leistungsverzeichnisse.$inferSelect;
  fileName: string;
  fileSize: number;
  phase: "x81" | "x86";
}): Promise<string> {
  const phaseEnum = args.phase === "x81" ? "gaeb_81" : "gaeb_86";
  const [row] = await db
    .insert(gaebExchangeLog)
    .values({
      projectId: args.lv.projectId,
      lvId: args.lv.id,
      direction: "export",
      exchangePhase: phaseEnum,
      fileName: args.fileName,
      fileRef: `(in-memory) ${args.fileName}`,
      fileSize: args.fileSize,
      gaebVersion: "GAEB DA XML 3.2",
      positionsImported: null,
    })
    .returning();
  return row.id;
}

export async function exportGaebX81(lvId: string): Promise<GaebExportResult> {
  const { lv, positions, project } = await loadLvWithPositions(lvId);

  const report = await verifyLvMath(lvId);
  if (!report.passed) throw new GaebMathBlockError(report);

  const xml = buildGaebXml({ lv, project: { name: project.name }, positions, phase: "x81" });
  const fileName = `${slug(project.name)}_${slug(lv.lvNumber ?? lv.title)}_X81.xml`;
  const exchangeLogId = await logExport({ lv, fileName, fileSize: xml.length, phase: "x81" });

  return { xml, fileName, exchangeLogId };
}

export async function exportGaebX86(args: {
  lvId: string;
  awardedBidderId: string;
}): Promise<GaebExportResult> {
  const { lv, positions, project } = await loadLvWithPositions(args.lvId);

  const report = await verifyLvMath(args.lvId);
  if (!report.passed) throw new GaebMathBlockError(report);

  const [bidder] = await db
    .select()
    .from(bidders)
    .where(eq(bidders.id, args.awardedBidderId))
    .limit(1);
  if (!bidder) throw new Error(`Bidder ${args.awardedBidderId} not found`);

  const xml = buildGaebXml({
    lv,
    project: { name: project.name },
    positions,
    awardedBidder: bidder,
    phase: "x86",
  });
  const fileName = `${slug(project.name)}_${slug(lv.lvNumber ?? lv.title)}_X86.xml`;
  const exchangeLogId = await logExport({ lv, fileName, fileSize: xml.length, phase: "x86" });

  return { xml, fileName, exchangeLogId };
}

function slug(s: string): string {
  return s
    .toLowerCase()
    .replace(/[äöüß]/g, (c) => ({ "ä": "ae", "ö": "oe", "ü": "ue", "ß": "ss" }[c] ?? c))
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 60) || "lv";
}
