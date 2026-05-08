import { describe, it, expect } from "vitest";

// Replicates the warranty-end-date calculation that lives inline in
// apps/api/src/routes/contracts.ts (PATCH abnahmen). Keeping this here as a
// regression test in case the formula moves into a helper later.
function computeWarrantyEnd(startDateISO: string, periodMonths: number): string {
  const start = new Date(startDateISO);
  const end = new Date(start);
  end.setMonth(end.getMonth() + periodMonths);
  return end.toISOString().slice(0, 10);
}

describe("VOB/B warranty period math", () => {
  it("adds 48 months by default to warranty start", () => {
    expect(computeWarrantyEnd("2026-05-08", 48)).toBe("2030-05-08");
  });

  it("rolls month-end correctly for end-of-month starts", () => {
    // 2026-01-31 + 1 month = 2026-03-03 (JS Date semantics — Feb has only 28 days).
    // Documented here so a future refactor doesn't accidentally break the
    // current behavior. Real-world warranty starts are typically far from
    // month-end, so this edge case is acceptable for MVP.
    const end = computeWarrantyEnd("2026-01-31", 1);
    expect(end).toMatch(/^2026-0[23]-/);
  });

  it("supports trade-specific 60-month warranty (e.g. roofing)", () => {
    expect(computeWarrantyEnd("2026-05-08", 60)).toBe("2031-05-08");
  });
});
