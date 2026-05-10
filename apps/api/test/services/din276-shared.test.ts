import { describe, it, expect } from "vitest";
import {
  DIN276_HIERARCHY,
  DIN276_LEVEL1,
  getDin276Group,
  isValidDin276Code,
  getDin276Level1,
  formatDin276Label,
} from "@tenderfish/shared";

describe("DIN 276 hierarchy", () => {
  it("contains all 7 level-1 main groups (KG 100..700)", () => {
    expect(DIN276_LEVEL1.map((g) => g.code).sort()).toEqual([
      "100",
      "200",
      "300",
      "400",
      "500",
      "600",
      "700",
    ]);
  });

  it("indexes common level-2 and level-3 codes", () => {
    expect(getDin276Group("330")?.level).toBe(2);
    expect(getDin276Group("331")?.level).toBe(3);
    expect(getDin276Group("420")?.nameEn).toContain("Heating");
    expect(getDin276Group("730")?.nameEn).toContain("Architect");
  });

  it("rejects codes that aren't in the hierarchy", () => {
    expect(isValidDin276Code("999")).toBe(false);
    expect(isValidDin276Code("000")).toBe(false);
    expect(isValidDin276Code("330")).toBe(true);
  });

  it("returns the level-1 root for any valid code", () => {
    expect(getDin276Level1("331")).toBe("300");
    expect(getDin276Level1("420")).toBe("400");
    expect(getDin276Level1("730")).toBe("700");
    expect(getDin276Level1("999")).toBeUndefined();
  });

  it("formats labels with KG prefix", () => {
    expect(formatDin276Label("331")).toContain("Tragende Außenwände");
    expect(formatDin276Label("999")).toBe("KG 999");
  });

  it("has a parent reference for every level-2/3 entry", () => {
    for (const g of DIN276_HIERARCHY) {
      if (g.level === 1) {
        expect(g.parent).toBeUndefined();
      } else {
        expect(g.parent).toBeDefined();
        expect(getDin276Group(g.parent!)).toBeDefined();
      }
    }
  });
});
