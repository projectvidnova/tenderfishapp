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

/**
 * Parse a file buffer into plain text based on its MIME type.
 */
export async function parseFile(
  buffer: Buffer,
  fileName: string,
  mimeType: string
): Promise<ParsedDocument> {
  const result: ParsedDocument = { fileName, mimeType, text: "" };

  try {
    if (mimeType === "application/pdf") {
      result.text = await parsePdf(buffer);
    } else if (
      mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
      mimeType === "application/msword"
    ) {
      result.text = await parseDocx(buffer);
    } else if (mimeType === "message/rfc822" || fileName.endsWith(".eml")) {
      result.text = await parseEmail(buffer);
    } else if (mimeType === "application/vnd.ms-outlook" || fileName.endsWith(".msg")) {
      // MSG files are treated as raw text extraction attempt
      result.text = await parseRawText(buffer);
    } else if (
      mimeType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
      mimeType === "application/vnd.ms-excel"
    ) {
      result.text = await parseXlsx(buffer);
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

  return result;
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
    const parts = [];
    if (parsed.subject) parts.push(`Subject: ${parsed.subject}`);
    if (parsed.from?.text) parts.push(`From: ${parsed.from.text}`);
    if (parsed.to) {
      const toText = Array.isArray(parsed.to)
        ? parsed.to.map((t) => t.text).join(", ")
        : parsed.to.text;
      parts.push(`To: ${toText}`);
    }
    if (parsed.date) parts.push(`Date: ${parsed.date.toISOString()}`);
    parts.push("");
    if (parsed.text) parts.push(parsed.text);
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
      const csv = XLSX.utils.sheet_to_csv(sheet);
      sheets.push(`--- Sheet: ${sheetName} ---\n${csv}`);
    }

    return sheets.join("\n\n");
  } catch {
    return "[XLSX parsing failed — library not available]";
  }
}

async function parseRawText(buffer: Buffer): Promise<string> {
  return buffer.toString("utf-8").replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, " ");
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
