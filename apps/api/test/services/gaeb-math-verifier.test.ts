import { describe, it, expect } from "vitest";
import { verifyMathFromInputs } from "../../src/services/gaeb-math-verifier";

const goodLine = (oz: string, mengeMinor: number, upCents: number) => ({
  ordnungszahl: oz,
  titel: "Test",
  menge: mengeMinor,
  einheitspreis: upCents,
  gesamtpreis: Math.round((mengeMinor / 1000) * upCents),
});

describe("verifyMathFromInputs", () => {
  it("passes a clean LV", () => {
    const lines = [
      goodLine("01.001", 120500, 1550),
      goodLine("01.002", 85000, 2200),
      goodLine("02.001", 45250, 32000),
      goodLine("02.002", 18750, 41000),
    ];
    const storedNet = lines.reduce((s, l) => s + l.gesamtpreis, 0);
    const report = verifyMathFromInputs({ positions: lines, storedNet, storedGross: 0 });
    expect(report.passed).toBe(true);
    expect(report.errors).toHaveLength(0);
    expect(report.totals.computedNet).toBe(storedNet);
  });

  it("flags a line whose gesamtpreis disagrees with menge × UP", () => {
    const positions = [
      // qty 10.000, UP 50.00 → expected 500.00, but reported 999.99
      { ordnungszahl: "01.001", titel: null, menge: 10000, einheitspreis: 5000, gesamtpreis: 99999 },
      goodLine("01.002", 20000, 3000),
    ];
    const storedNet = positions.reduce((s, p) => s + p.gesamtpreis, 0);
    const report = verifyMathFromInputs({ positions, storedNet, storedGross: 0 });
    expect(report.passed).toBe(false);
    expect(report.errors.some((e) => e.kind === "line" && e.ordnungszahl === "01.001")).toBe(true);

    const lineErr = report.errors.find((e) => e.kind === "line" && e.ordnungszahl === "01.001")!;
    expect(lineErr.expected).toBe(50000);
    expect(lineErr.actual).toBe(99999);
    expect(lineErr.delta).toBe(49999);
  });

  it("flags a grand-total mismatch", () => {
    const positions = [goodLine("01.001", 10000, 5000), goodLine("01.002", 20000, 3000)];
    const truthful = positions.reduce((s, p) => s + p.gesamtpreis, 0); // 110000
    const lyingTotal = truthful + 50000; // 50.00 € fudge
    const report = verifyMathFromInputs({
      positions,
      storedNet: lyingTotal,
      storedGross: 0,
    });
    expect(report.passed).toBe(false);
    const totalErr = report.errors.find((e) => e.kind === "total");
    expect(totalErr).toBeDefined();
    expect(totalErr!.delta).toBe(-50000);
  });

  it("tolerates accumulated 1-cent rounding", () => {
    // 100 lines each off by exactly 1 cent. Default grand-total tolerance
    // is `Math.max(1, lineCount * perLineTolerance)` = 100 cents → just passes.
    const positions = Array.from({ length: 100 }, (_, i) => {
      const line = goodLine(`01.${String(i + 1).padStart(3, "0")}`, 1000, 100);
      // bump gesamtpreis by exactly 1 cent — within per-line tolerance, but
      // accumulates 100 cents at the grand total.
      return { ...line, gesamtpreis: line.gesamtpreis + 1 };
    });
    const storedNet = positions.reduce((s, p) => s + p.gesamtpreis, 0) - 100;
    const report = verifyMathFromInputs({ positions, storedNet, storedGross: 0 });
    expect(report.errors.filter((e) => e.kind === "line")).toHaveLength(0);
    // grand-total tolerance = 100 lines × 1 cent = 100, drift exactly 100 → passes.
    expect(report.passed).toBe(true);
  });

  it("rejects accumulated rounding beyond the grand-total tolerance", () => {
    const positions = Array.from({ length: 10 }, (_, i) =>
      goodLine(`01.${String(i + 1).padStart(3, "0")}`, 1000, 100)
    );
    const truthful = positions.reduce((s, p) => s + p.gesamtpreis, 0);
    // grand-total tolerance with 10 lines is 10 cents — set storedNet 50 cents off.
    const report = verifyMathFromInputs({
      positions,
      storedNet: truthful + 50,
      storedGross: 0,
    });
    expect(report.passed).toBe(false);
    expect(report.errors.find((e) => e.kind === "total")).toBeDefined();
  });

  it("handles an empty LV by reporting passed=true with positionCount 0", () => {
    const report = verifyMathFromInputs({ positions: [], storedNet: 0, storedGross: 0 });
    expect(report.passed).toBe(true);
    expect(report.positionCount).toBe(0);
  });
});
