// DIN 276 cost-group hierarchy (German construction cost classification).
// Codes follow DIN 276:2018-12. Level 1 = main groups (KG 100..700),
// Level 2 = subgroups (e.g. 310, 330), Level 3 = detail groups (e.g. 331, 332).
//
// This is the canonical source — UI components and the classifier service
// import from here. Do not duplicate inline.

export interface Din276Group {
  code: string; // e.g. "300", "330", "331"
  level: 1 | 2 | 3;
  nameDe: string;
  nameEn: string;
  parent?: string; // parent code (e.g. "330" for "331")
}

export const DIN276_HIERARCHY: Din276Group[] = [
  // ─── Level 1 ───────────────────────────────────────────────
  { code: "100", level: 1, nameDe: "Grundstück", nameEn: "Site" },
  { code: "200", level: 1, nameDe: "Vorbereitende Maßnahmen", nameEn: "Preparation" },
  { code: "300", level: 1, nameDe: "Bauwerk – Baukonstruktionen", nameEn: "Building – Construction" },
  { code: "400", level: 1, nameDe: "Bauwerk – Technische Anlagen", nameEn: "Building – Services" },
  { code: "500", level: 1, nameDe: "Außenanlagen und Freiflächen", nameEn: "External Works" },
  { code: "600", level: 1, nameDe: "Ausstattung und Kunstwerke", nameEn: "Furniture / FFE" },
  { code: "700", level: 1, nameDe: "Baunebenkosten", nameEn: "Ancillary Costs" },

  // ─── Level 2 — KG 100 ──────────────────────────────────────
  { code: "110", level: 2, nameDe: "Grundstückswert", nameEn: "Site Value", parent: "100" },
  { code: "120", level: 2, nameDe: "Grundstücksnebenkosten", nameEn: "Site Ancillary", parent: "100" },
  { code: "130", level: 2, nameDe: "Rechte Dritter", nameEn: "Third-Party Rights", parent: "100" },

  // ─── Level 2 — KG 200 ──────────────────────────────────────
  { code: "210", level: 2, nameDe: "Herrichten", nameEn: "Site Clearance", parent: "200" },
  { code: "220", level: 2, nameDe: "Öffentliche Erschließung", nameEn: "Public Servicing", parent: "200" },
  { code: "230", level: 2, nameDe: "Nichtöffentliche Erschließung", nameEn: "Private Servicing", parent: "200" },
  { code: "240", level: 2, nameDe: "Ausgleichsabgaben", nameEn: "Compensation Fees", parent: "200" },
  { code: "250", level: 2, nameDe: "Übergangsmaßnahmen", nameEn: "Temporary Measures", parent: "200" },

  // ─── Level 2 — KG 300 ──────────────────────────────────────
  { code: "310", level: 2, nameDe: "Baugrube / Erdbau", nameEn: "Excavation / Earthworks", parent: "300" },
  { code: "320", level: 2, nameDe: "Gründung, Unterbau", nameEn: "Foundations", parent: "300" },
  { code: "330", level: 2, nameDe: "Außenwände / Vertikale Baukonstruktionen, außen", nameEn: "External Walls", parent: "300" },
  { code: "340", level: 2, nameDe: "Innenwände / Vertikale Baukonstruktionen, innen", nameEn: "Internal Walls", parent: "300" },
  { code: "350", level: 2, nameDe: "Decken / Horizontale Baukonstruktionen", nameEn: "Floors / Slabs", parent: "300" },
  { code: "360", level: 2, nameDe: "Dächer", nameEn: "Roofs", parent: "300" },
  { code: "370", level: 2, nameDe: "Infrastrukturanlagen", nameEn: "Infrastructure", parent: "300" },
  { code: "380", level: 2, nameDe: "Baukonstruktive Einbauten", nameEn: "Built-in Construction", parent: "300" },
  { code: "390", level: 2, nameDe: "Sonstige Maßnahmen für Baukonstruktionen", nameEn: "Other Construction", parent: "300" },

  // ─── Level 3 — KG 330 (most common in BoQs) ────────────────
  { code: "331", level: 3, nameDe: "Tragende Außenwände", nameEn: "Load-bearing External Walls", parent: "330" },
  { code: "332", level: 3, nameDe: "Nichttragende Außenwände", nameEn: "Non-load-bearing External Walls", parent: "330" },
  { code: "333", level: 3, nameDe: "Außenstützen", nameEn: "External Columns", parent: "330" },
  { code: "334", level: 3, nameDe: "Außentüren und -fenster", nameEn: "External Doors / Windows", parent: "330" },
  { code: "335", level: 3, nameDe: "Außenwandbekleidung außen", nameEn: "External Wall Cladding (outside)", parent: "330" },
  { code: "336", level: 3, nameDe: "Außenwandbekleidung innen", nameEn: "External Wall Lining (inside)", parent: "330" },
  { code: "337", level: 3, nameDe: "Elementierte Außenwände", nameEn: "Curtain Walls", parent: "330" },
  { code: "338", level: 3, nameDe: "Sonnenschutz", nameEn: "Sun Protection", parent: "330" },

  // ─── Level 3 — KG 340 ──────────────────────────────────────
  { code: "341", level: 3, nameDe: "Tragende Innenwände", nameEn: "Load-bearing Internal Walls", parent: "340" },
  { code: "342", level: 3, nameDe: "Nichttragende Innenwände", nameEn: "Partition Walls", parent: "340" },
  { code: "343", level: 3, nameDe: "Innenstützen", nameEn: "Internal Columns", parent: "340" },
  { code: "344", level: 3, nameDe: "Innentüren und -fenster", nameEn: "Internal Doors / Windows", parent: "340" },
  { code: "345", level: 3, nameDe: "Innenwandbekleidung", nameEn: "Internal Wall Lining", parent: "340" },
  { code: "346", level: 3, nameDe: "Elementierte Innenwände", nameEn: "System Walls", parent: "340" },

  // ─── Level 3 — KG 350 ──────────────────────────────────────
  { code: "351", level: 3, nameDe: "Deckenkonstruktionen", nameEn: "Floor Structures", parent: "350" },
  { code: "352", level: 3, nameDe: "Deckenbeläge", nameEn: "Floor Coverings", parent: "350" },
  { code: "353", level: 3, nameDe: "Deckenbekleidungen", nameEn: "Ceilings / Soffits", parent: "350" },

  // ─── Level 3 — KG 360 ──────────────────────────────────────
  { code: "361", level: 3, nameDe: "Dachkonstruktionen", nameEn: "Roof Structures", parent: "360" },
  { code: "362", level: 3, nameDe: "Dachfenster, Dachöffnungen", nameEn: "Roof Lights / Openings", parent: "360" },
  { code: "363", level: 3, nameDe: "Dachbeläge", nameEn: "Roof Coverings", parent: "360" },
  { code: "364", level: 3, nameDe: "Dachbekleidungen", nameEn: "Roof Lining", parent: "360" },

  // ─── Level 2 — KG 400 ──────────────────────────────────────
  { code: "410", level: 2, nameDe: "Abwasser-, Wasser-, Gasanlagen", nameEn: "Plumbing / Gas", parent: "400" },
  { code: "420", level: 2, nameDe: "Wärmeversorgungsanlagen", nameEn: "Heating", parent: "400" },
  { code: "430", level: 2, nameDe: "Raumlufttechnische Anlagen", nameEn: "Ventilation / HVAC", parent: "400" },
  { code: "440", level: 2, nameDe: "Elektrische Anlagen", nameEn: "Electrical", parent: "400" },
  { code: "450", level: 2, nameDe: "Kommunikations-, sicherheits-, informationstechnische Anlagen", nameEn: "Communications / Security", parent: "400" },
  { code: "460", level: 2, nameDe: "Förderanlagen", nameEn: "Conveyors / Elevators", parent: "400" },
  { code: "470", level: 2, nameDe: "Nutzungsspezifische und verfahrenstechnische Anlagen", nameEn: "Process / User-Specific", parent: "400" },
  { code: "480", level: 2, nameDe: "Gebäude- und Anlagenautomation", nameEn: "Building Automation", parent: "400" },
  { code: "490", level: 2, nameDe: "Sonstige Maßnahmen für technische Anlagen", nameEn: "Other Services", parent: "400" },

  // ─── Level 2 — KG 500 ──────────────────────────────────────
  { code: "510", level: 2, nameDe: "Erdbau (Außenanlagen)", nameEn: "External Earthworks", parent: "500" },
  { code: "520", level: 2, nameDe: "Gründung, Unterbau (Außenanlagen)", nameEn: "External Foundations", parent: "500" },
  { code: "530", level: 2, nameDe: "Oberbau, Deckschichten", nameEn: "External Surfaces", parent: "500" },
  { code: "540", level: 2, nameDe: "Baukonstruktionen in Außenanlagen", nameEn: "External Constructions", parent: "500" },
  { code: "550", level: 2, nameDe: "Technische Anlagen in Außenanlagen", nameEn: "External Services", parent: "500" },
  { code: "560", level: 2, nameDe: "Einbauten in Außenanlagen", nameEn: "External Fittings", parent: "500" },
  { code: "570", level: 2, nameDe: "Pflanz- und Saatflächen", nameEn: "Planting / Lawns", parent: "500" },
  { code: "580", level: 2, nameDe: "Wasserflächen", nameEn: "Water Features", parent: "500" },
  { code: "590", level: 2, nameDe: "Sonstige Maßnahmen für Außenanlagen", nameEn: "Other External", parent: "500" },

  // ─── Level 2 — KG 600 ──────────────────────────────────────
  { code: "610", level: 2, nameDe: "Allgemeine Ausstattung", nameEn: "General Equipment", parent: "600" },
  { code: "620", level: 2, nameDe: "Besondere Ausstattung", nameEn: "Special Equipment", parent: "600" },
  { code: "630", level: 2, nameDe: "Informationstechnische Ausstattung", nameEn: "IT Equipment", parent: "600" },
  { code: "640", level: 2, nameDe: "Künstlerische Ausstattung", nameEn: "Artistic Items", parent: "600" },
  { code: "690", level: 2, nameDe: "Sonstige Ausstattung", nameEn: "Other FFE", parent: "600" },

  // ─── Level 2 — KG 700 ──────────────────────────────────────
  { code: "710", level: 2, nameDe: "Bauherrenaufgaben", nameEn: "Client Tasks", parent: "700" },
  { code: "720", level: 2, nameDe: "Vorbereitung der Objektplanung", nameEn: "Pre-Planning", parent: "700" },
  { code: "730", level: 2, nameDe: "Architekten- und Ingenieurleistungen", nameEn: "Architect / Engineer Fees", parent: "700" },
  { code: "740", level: 2, nameDe: "Gutachten und Beratung", nameEn: "Expert Reports / Consulting", parent: "700" },
  { code: "750", level: 2, nameDe: "Künstlerische Leistungen", nameEn: "Artistic Services", parent: "700" },
  { code: "760", level: 2, nameDe: "Finanzierung", nameEn: "Financing", parent: "700" },
  { code: "770", level: 2, nameDe: "Allgemeine Baunebenkosten", nameEn: "General Ancillary Costs", parent: "700" },
  { code: "790", level: 2, nameDe: "Sonstige Baunebenkosten", nameEn: "Other Ancillary", parent: "700" },
];

export const DIN276_LEVEL1: Din276Group[] = DIN276_HIERARCHY.filter((g) => g.level === 1);

const HIERARCHY_INDEX = new Map(DIN276_HIERARCHY.map((g) => [g.code, g]));

export function getDin276Group(code: string): Din276Group | undefined {
  return HIERARCHY_INDEX.get(code);
}

export function isValidDin276Code(code: string): boolean {
  return HIERARCHY_INDEX.has(code);
}

export function getDin276Level1(code: string): string | undefined {
  if (!HIERARCHY_INDEX.has(code)) return undefined;
  return code.charAt(0) + "00";
}

export function formatDin276Label(code: string): string {
  const g = HIERARCHY_INDEX.get(code);
  if (!g) return `KG ${code}`;
  return `KG ${g.code} – ${g.nameDe}`;
}
