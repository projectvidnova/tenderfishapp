// Shared validation helpers (no external dependencies)

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function isValidSlug(slug: string): boolean {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug);
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[äÄ]/g, "ae")
    .replace(/[öÖ]/g, "oe")
    .replace(/[üÜ]/g, "ue")
    .replace(/[ß]/g, "ss")
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function isValidPasswordStrength(password: string): "weak" | "fair" | "strong" {
  if (password.length < 8) return "weak";
  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSpecial = /[^A-Za-z0-9]/.test(password);
  const score = [hasUpper, hasLower, hasNumber, hasSpecial].filter(Boolean).length;
  if (score >= 3 && password.length >= 12) return "strong";
  if (score >= 2 && password.length >= 8) return "fair";
  return "weak";
}

export function clampPage(page: number, total: number, pageSize: number): number {
  const maxPage = Math.max(1, Math.ceil(total / pageSize));
  return Math.max(1, Math.min(page, maxPage));
}

// ─── DIN 276 Validators ──────────────────────────────────────

/**
 * Validates a DIN 276 cost group code (e.g. "300", "330", "331").
 * Must be 3 digits, first digit 1-8.
 */
export function isValidDIN276Code(code: string): boolean {
  return /^[1-8]\d{2}$/.test(code);
}

/**
 * Determines the DIN 276 level from a cost group code.
 * Level 1: X00 (e.g. 300), Level 2: XX0 (e.g. 330), Level 3: XXX (e.g. 331)
 */
export function getDIN276Level(code: string): 1 | 2 | 3 | null {
  if (!isValidDIN276Code(code)) return null;
  if (code.endsWith("00")) return 1;
  if (code.endsWith("0")) return 2;
  return 3;
}

/**
 * Gets the parent code for a DIN 276 cost group.
 * e.g. "331" → "330", "330" → "300", "300" → null
 */
export function getDIN276ParentCode(code: string): string | null {
  if (!isValidDIN276Code(code)) return null;
  const level = getDIN276Level(code);
  if (level === 1) return null;
  if (level === 2) return code[0] + "00";
  if (level === 3) return code.slice(0, 2) + "0";
  return null;
}

// ─── VOB Validators ──────────────────────────────────────────

/**
 * Validates a VOB Nachtrag number format (e.g. "NT-001", "NT-042").
 */
export function isValidNachtragNumber(num: string): boolean {
  return /^NT-\d{3,}$/.test(num);
}

/**
 * Calculates VOB/B Gewährleistung (warranty) end date.
 * Default: 4 years from Abnahme date for VOB/B, 5 years for BGB.
 */
export function calculateWarrantyEndDate(
  abnahmeDate: Date,
  contractType: "vob_b" | "bgb_werkvertrag"
): Date {
  const years = contractType === "vob_b" ? 4 : 5;
  const endDate = new Date(abnahmeDate);
  endDate.setFullYear(endDate.getFullYear() + years);
  return endDate;
}

/**
 * Validates a GAEB file extension.
 */
export function isValidGaebFileExtension(fileName: string): boolean {
  const ext = fileName.toLowerCase().split(".").pop();
  return [
    "x81", "x82", "x83", "x84", "x85", "x86", "x87", "x89", "x90", "x11",
    "d81", "d82", "d83", "d84", "d86", "p83", "p84",
  ].includes(ext || "");
}

// ─── Cost Validators ─────────────────────────────────────────

/**
 * Validates that a cost amount is non-negative (in cents).
 */
export function isValidCostAmount(amountCents: number): boolean {
  return Number.isInteger(amountCents) && amountCents >= 0;
}

/**
 * Calculates gross from net using a VAT rate in basis points (e.g. 1900 = 19%).
 */
export function netToGross(netCents: number, vatBasisPoints: number): number {
  return Math.round(netCents * (1 + vatBasisPoints / 10000));
}

/**
 * Calculates net from gross using a VAT rate in basis points.
 */
export function grossToNet(grossCents: number, vatBasisPoints: number): number {
  return Math.round(grossCents / (1 + vatBasisPoints / 10000));
}
