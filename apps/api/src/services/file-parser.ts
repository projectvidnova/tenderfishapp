/**
 * File parsing service — converts uploaded files to plain text for AI processing.
 * Each parser extracts text content from its respective file format.
 */

/** Image MIME types accepted by the multimodal vision pipeline (aligned with {@link processImageForVision}). */
export const VISION_SUPPORTED_IMAGE_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export type VisionSupportedImageMimeType = (typeof VISION_SUPPORTED_IMAGE_MIME_TYPES)[number];

interface ParsedDocument {
  fileName: string;
  mimeType: string;
  text: string;
  metadata?: Record<string, string>;
}

export interface FileParseInput {
  buffer: Buffer;
  file_name: string;
  mime_type: string;
}

export interface FileParseOutput {
  text: string;
  metadata: {
    file_type: string;
    file_name: string;
  };
}

/**
 * Parse a file buffer into plain text based on its MIME type.
 */
export async function parseFile(file: FileParseInput): Promise<FileParseOutput>;
export async function parseFile(
  buffer: Buffer,
  fileName: string,
  mimeType: string
): Promise<ParsedDocument>;
export async function parseFile(
  arg1: Buffer | FileParseInput,
  arg2?: string,
  arg3?: string
): Promise<FileParseOutput | ParsedDocument> {
  const input: FileParseInput = Buffer.isBuffer(arg1)
    ? {
        buffer: arg1,
        file_name: arg2 || "unknown",
        mime_type: arg3 || "application/octet-stream",
      }
    : arg1;

  const fileName = input.file_name;
  let mimeType = input.mime_type;
  const buffer = input.buffer;
  const result: ParsedDocument = { fileName, mimeType, text: "" };

  try {
    const normalizedName = fileName.toLowerCase();
    if (
      !mimeType?.trim() ||
      mimeType === "application/octet-stream" ||
      mimeType === "binary/octet-stream"
    ) {
      const guessed = guessMimeFromFileName(fileName);
      if (guessed) mimeType = guessed;
    }
    result.mimeType = mimeType;
    const byMime = normalizeMimeType(mimeType);
    const isIfcModel =
      mimeType === "application/x-step" ||
      mimeType === "application/ifc" ||
      normalizedName.endsWith(".ifc");
    const isGaebXml =
      mimeType === "application/xml" ||
      mimeType === "text/xml" ||
      normalizedName.endsWith(".x81") ||
      normalizedName.endsWith(".x83") ||
      normalizedName.endsWith(".x84") ||
      normalizedName.endsWith(".x86");

    if (isIfcModel) {
      result.text = await parseIfcModel(buffer);
      result.metadata = { requiresBimProcessing: "true" };
    } else if (isGaebXml) {
      result.text = await parseGaebXml(buffer);
    } else if (byMime === "pdf") {
      result.text = await parsePdf(buffer);
    } else if (byMime === "word") {
      result.text = await parseDocx(buffer);
    } else if (byMime === "excel") {
      result.text = await parseXlsx(buffer);
    } else if (mimeType === "message/rfc822" || normalizedName.endsWith(".eml")) {
      result.text = await parseEmail(buffer);
    } else if (mimeType === "application/vnd.ms-outlook" || normalizedName.endsWith(".msg")) {
      result.text = await parseMsg(buffer);
    } else if (mimeType === "text/plain" || mimeType === "text/csv") {
      result.text = buffer.toString("utf-8");
    } else if (isVisionSupportedImageMime(mimeType)) {
      result.text = `[Image: ${fileName}]`;
      result.metadata = { requiresVision: "true", visionMimeType: mimeType.toLowerCase().trim() };
    } else if (mimeType.startsWith("image/")) {
      result.text = `[Image (unsupported for vision pipeline): ${fileName}]`;
    } else {
      result.text = await parseRawText(buffer);
    }
  } catch (error) {
    result.text = `[Failed to parse ${fileName}: ${error instanceof Error ? error.message : "Unknown error"}]`;
  }

  result.text = cleanExtractedText(result.text);

  if (Buffer.isBuffer(arg1)) return result;

  return {
    text: result.text,
    metadata: {
      file_type: mimeType,
      file_name: fileName,
    },
  };
}

export function isVisionSupportedImageMime(mimeType: string): mimeType is VisionSupportedImageMimeType {
  const lower = mimeType.toLowerCase().trim();
  return (VISION_SUPPORTED_IMAGE_MIME_TYPES as readonly string[]).includes(lower);
}

/**
 * Encode image bytes as raw base64 for multimodal APIs.
 * Pass the same {@link mimeType} alongside this string: Anthropic uses raw base64 + `media_type`;
 * OpenAI-compatible clients typically use `data:<mimeType>;base64,<this string>`.
 */
export function processImageForVision(buffer: Buffer, mimeType: string): string {
  if (!isVisionSupportedImageMime(mimeType)) {
    throw new Error(
      `Unsupported image MIME type for vision: ${mimeType}. Use image/jpeg, image/png, or image/webp.`
    );
  }
  return buffer.toString("base64");
}

/**
 * Resolve MIME for uploads when the client sends octet-stream or omits type (multipart).
 */
export function resolveDeclaredMimeType(fileName: string, mimeType: string): string {
  let m = (mimeType || "").trim();
  if (!m || m === "application/octet-stream" || m === "binary/octet-stream") {
    const g = guessMimeFromFileName(fileName);
    if (g) return g;
  }
  return m || "application/octet-stream";
}

function guessMimeFromFileName(fileName: string): string | null {
  const lower = fileName.toLowerCase().trim();
  if (lower.endsWith(".pdf")) return "application/pdf";
  if (lower.endsWith(".docx")) {
    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  }
  if (lower.endsWith(".doc")) return "application/msword";
  if (lower.endsWith(".xlsx")) {
    return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  }
  if (lower.endsWith(".xls")) return "application/vnd.ms-excel";
  if (lower.endsWith(".msg")) return "application/vnd.ms-outlook";
  if (lower.endsWith(".eml")) return "message/rfc822";
  if (lower.endsWith(".txt") || lower.endsWith(".csv")) return "text/plain";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  return null;
}

function normalizeMimeType(mimeType: string): "pdf" | "word" | "excel" | "other" {
  const lower = mimeType.toLowerCase();
  if (lower === "application/pdf") return "pdf";
  if (
    lower === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    lower === "application/msword"
  ) {
    return "word";
  }
  if (
    lower === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
    lower === "application/vnd.ms-excel"
  ) {
    return "excel";
  }
  return "other";
}

function cleanExtractedText(text: string): string {
  return text
    .replace(/\u0000/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function parsePdf(buffer: Buffer): Promise<string> {
  try {
    const pdfParse = (await import("pdf-parse")).default;
    const data = await pdfParse(buffer);
    return data.text;
  } catch {
    return "[PDF parsing failed — library not available]";
  }
}

async function parseDocx(buffer: Buffer): Promise<string> {
  try {
    const mammoth = await import("mammoth");
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  } catch {
    return "[DOCX parsing failed — library not available]";
  }
}

async function parseEmail(buffer: Buffer): Promise<string> {
  try {
    const { simpleParser } = await import("mailparser");
    const parsed = await simpleParser(buffer);
    const subject = parsed.subject?.trim() || "";
    const body = stripEmailNoise(parsed.text || "");
    const parts = [`Subject: ${subject}`, "", body].filter(Boolean);
    return parts.join("\n");
  } catch {
    return "[Email parsing failed — library not available]";
  }
}

function bufferToArrayBuffer(buf: Buffer): ArrayBuffer {
  const out = new ArrayBuffer(buf.length);
  new Uint8Array(out).set(buf);
  return out;
}

async function parseMsg(buffer: Buffer): Promise<string> {
  try {
    const MsgReader = (await import("@kenjiuno/msgreader")).default;
    const reader = new MsgReader(bufferToArrayBuffer(buffer));
    const data = reader.getFileData();
    const subject = data.subject?.trim() || "";
    const from = [data.senderName, data.senderEmail].filter(Boolean).join(" / ");
    const recipients = Array.isArray(data.recipients)
      ? data.recipients
          .map((r) => {
            const row = r as { name?: string; email?: string };
            return [row.name, row.email].filter(Boolean).join(" ").trim();
          })
          .filter(Boolean)
          .join("; ")
      : "";
    const body = stripEmailNoise((data.body || "").trim());
    const headerLines = [
      subject && `Subject: ${subject}`,
      from && `From: ${from}`,
      recipients && `To: ${recipients}`,
    ].filter(Boolean);
    const header = headerLines.join("\n");
    const pieces = [header, body].filter((p) => typeof p === "string" && p.length > 0);
    const text = pieces.join("\n\n").trim();
    return text.length > 0 ? text : "[MSG: no extractable text]";
  } catch (error) {
    return `[MSG parsing failed — ${error instanceof Error ? error.message : "unknown error"}]`;
  }
}

async function parseXlsx(buffer: Buffer): Promise<string> {
  try {
    const XLSX = await import("xlsx");
    const workbook = XLSX.read(buffer, { type: "buffer" });
    const sheets: string[] = [];

    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
        defval: null,
        raw: false,
      });
      const formattedRows =
        rows.length > 0
          ? rows.map((row) => `Row: ${JSON.stringify(row)}`).join("\n")
          : "Row: {}";
      sheets.push(`Sheet: ${sheetName}\n${formattedRows}`);
    }

    return sheets.join("\n\n");
  } catch {
    return "[XLSX parsing failed — library not available]";
  }
}

async function parseRawText(buffer: Buffer): Promise<string> {
  return buffer.toString("utf-8").replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, " ");
}

export async function parseIfcModel(buffer: Buffer): Promise<string> {
  const utf8Preview = buffer.toString("utf-8", 0, Math.min(buffer.length, 4000));
  const spatialEntityHints = [
    "IFCSITE",
    "IFCBUILDING",
    "IFCBUILDINGSTOREY",
    "IFCSPACE",
    "IFCWALL",
    "IFCSLAB",
  ];

  const detectedEntities = spatialEntityHints.filter((entity) => utf8Preview.includes(entity));

  return [
    "[IFC model processed]",
    `Detected spatial entity markers: ${detectedEntities.length > 0 ? detectedEntities.join(", ") : "none"}`,
    "BIM extraction placeholder active: geometric boundaries and spatial topology parsing will be implemented in a later compliance module.",
  ].join("\n");
}

export async function parseGaebXml(buffer: Buffer): Promise<string> {
  try {
    const { XMLParser } = await import("fast-xml-parser");
    const xmlText = buffer.toString("utf-8");
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: "@_",
      trimValues: true,
      parseTagValue: false,
    });
    const parsed = parser.parse(xmlText) as Record<string, unknown>;

    const lines: string[] = [];

    const asArray = <T>(value: T | T[] | null | undefined): T[] => {
      if (value === null || value === undefined) return [];
      return Array.isArray(value) ? value : [value];
    };

    const toText = (value: unknown): string => {
      if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
        return String(value).trim();
      }
      if (value && typeof value === "object") {
        const node = value as Record<string, unknown>;
        const directText = node["#text"];
        if (typeof directText === "string") return directText.trim();
      }
      return "";
    };

    const pickFirstTextByKeys = (node: Record<string, unknown>, keys: string[]): string => {
      for (const key of keys) {
        const candidate = node[key];
        const text = toText(candidate);
        if (text) return text;
      }
      return "";
    };

    const walk = (node: unknown): void => {
      if (!node || typeof node !== "object") return;
      const current = node as Record<string, unknown>;

      const lotNodes = asArray(current["Lot"] ?? current["Los"]);
      for (const lot of lotNodes) {
        if (!lot || typeof lot !== "object") continue;
        const lotObj = lot as Record<string, unknown>;
        const lotNumber = pickFirstTextByKeys(lotObj, ["@_RNoPart", "@_RNo", "RNoPart", "RNo", "Nr", "No"]);
        const lotTitle = pickFirstTextByKeys(lotObj, ["Label", "ShortText", "LongText", "Description", "TextOutlTxt"]);
        lines.push(`Lot: ${lotNumber || "unknown"}${lotTitle ? ` | ${lotTitle}` : ""}`);
      }

      const titleNodes = asArray(current["BoQCtgy"] ?? current["Title"] ?? current["Titl"]);
      for (const title of titleNodes) {
        if (!title || typeof title !== "object") continue;
        const titleObj = title as Record<string, unknown>;
        const titleNumber = pickFirstTextByKeys(titleObj, ["@_RNoPart", "@_RNo", "RNoPart", "RNo", "Nr", "No"]);
        const titleLabel = pickFirstTextByKeys(titleObj, ["Label", "ShortText", "LongText", "Description", "TextOutlTxt"]);
        lines.push(`Title: ${titleNumber || "unknown"}${titleLabel ? ` | ${titleLabel}` : ""}`);
      }

      const positionNodes = asArray(current["Item"] ?? current["BoQBody"] ?? current["Position"] ?? current["Pos"]);
      for (const position of positionNodes) {
        if (!position || typeof position !== "object") continue;
        const posObj = position as Record<string, unknown>;
        const posNumber = pickFirstTextByKeys(posObj, ["@_RNoPart", "@_RNo", "RNoPart", "RNo", "Nr", "No", "ItemNo"]);
        const shortText = pickFirstTextByKeys(posObj, ["ShortText", "OutlineText", "Description"]);
        const longText = pickFirstTextByKeys(posObj, ["LongText", "TextOutlTxt", "Text"]);
        const quantity = pickFirstTextByKeys(posObj, ["Qty", "Quantity"]);
        const unit = pickFirstTextByKeys(posObj, ["QU", "Unit", "Uom"]);
        const unitPrice = pickFirstTextByKeys(posObj, ["UP", "UnitPrice", "UPTaxExcl", "Price"]);

        lines.push(
          `Position: ${posNumber || "unknown"} | short_text=${shortText || "n/a"} | long_text=${longText || "n/a"} | quantity=${quantity || "n/a"} | unit=${unit || "n/a"} | unit_price=${unitPrice || "n/a"}`
        );
      }

      for (const child of Object.values(current)) {
        if (Array.isArray(child)) {
          for (const nested of child) walk(nested);
        } else if (child && typeof child === "object") {
          walk(child);
        }
      }
    };

    walk(parsed);

    if (lines.length === 0) {
      return "[GAEB XML parsed, but no Lot/Title/Position hierarchy could be extracted]";
    }

    return lines.join("\n");
  } catch {
    return "[GAEB XML parsing failed — fast-xml-parser not available or XML is invalid]";
  }
}

function stripEmailNoise(text: string): string {
  const normalized = text
    .replace(/\r\n/g, "\n")
    .split("\n")
    .filter((line) => !/^(from|to|cc|bcc|sent|subject):/i.test(line.trim()))
    .join("\n");

  const signatureMarkers = [
    "\n-- \n",
    "\nRegards,",
    "\nBest regards,",
    "\nKind regards,",
    "\nMit freundlichen",
    "\nSent from my",
  ];

  let cleaned = normalized;
  for (const marker of signatureMarkers) {
    const markerIndex = cleaned.indexOf(marker);
    if (markerIndex !== -1) {
      cleaned = cleaned.slice(0, markerIndex);
      break;
    }
  }

  return cleaned.trim();
}

/**
 * Parse multiple files and combine into a single document string.
 */
export async function parseAllFiles(
  files: { buffer: Buffer; fileName: string; mimeType: string }[]
): Promise<{ combinedText: string; documents: ParsedDocument[]; imageBuffers: { buffer: Buffer; fileName: string }[] }> {
  const documents: ParsedDocument[] = [];
  const imageBuffers: { buffer: Buffer; fileName: string }[] = [];
  const textParts: string[] = [];

  for (const file of files) {
    const doc = await parseFile(file.buffer, file.fileName, file.mimeType);
    documents.push(doc);

    if (doc.metadata?.requiresVision === "true") {
      imageBuffers.push({ buffer: file.buffer, fileName: file.fileName });
    } else {
      textParts.push(`=== ${file.fileName} ===\n${doc.text}`);
    }
  }

  return {
    combinedText: textParts.join("\n\n"),
    documents,
    imageBuffers,
  };
}
