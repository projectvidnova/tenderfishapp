// Centralized de-DE formatters. Use these everywhere instead of bare
// `.toLocaleDateString()` / `.toLocaleString()` so output stays consistent
// for German users (dd.mm.yyyy dates, comma decimal, € prefix).

const DE = "de-DE" as const;

export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return "";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(DE);
}

export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return "";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString(DE);
}

/** Formats month label, e.g. "Jan", "Feb" — used by schedule timeline. */
export function formatMonthShort(value: string | Date): string {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString(DE, { month: "short" });
}

export function formatNumber(n: number, opts?: Intl.NumberFormatOptions): string {
  return n.toLocaleString(DE, opts);
}

/** Formats integer cents as a localized EUR string, e.g. 25905 → "259,05 €". */
export function formatEur(cents: number, opts?: Intl.NumberFormatOptions): string {
  return new Intl.NumberFormat(DE, {
    style: "currency",
    currency: "EUR",
    ...opts,
  }).format(cents / 100);
}
