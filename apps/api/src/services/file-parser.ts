/**
 * File parsing service — converts uploaded files to plain text for AI processing.
 * Each parser extracts text content from its respective file format.
 */

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
  const mimeType = input.mime_type;
  const buffer = input.buffer;
  const result: ParsedDocument = { fileName, mimeType, text: "" };

  try {
    const normalizedName = fileName.toLowerCase();
    const byMime = normalizeMimeType(mimeType);
    if (byMime === "pdf") {
      result.text = await parsePdf(buffer);
    } else if (byMime === "word") {
      result.text = await parseDocx(buffer);
    } else if (byMime === "excel") {
      result.text = await parseXlsx(buffer);
    } else if (mimeType === "message/rfc822" || normalizedName.endsWith(".eml")) {
      result.text = await parseEmail(buffer);
    } else if (mimeType === "application/vnd.ms-outlook" || normalizedName.endsWith(".msg")) {
      result.text = await parseRawText(buffer);
    } else if (mimeType === "text/plain" || mimeType === "text/csv") {
      result.text = buffer.toString("utf-8");
    } else if (mimeType.startsWith("image/")) {
      // Images will be handled separately via Claude Vision
      result.text = `[Image: ${fileName}]`;
      result.metadata = { requiresVision: "true" };
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
