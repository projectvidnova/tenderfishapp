import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseGaebTree } from "../../src/services/gaeb-importer";

const FIXTURES = join(__dirname, "..", "fixtures", "gaeb");

function readFixture(name: string): Buffer {
  return readFileSync(join(FIXTURES, name));
}

describe("parseGaebTree", () => {
  it("parses a small X83 fixture into structured positions with correct totals", () => {
    const buffer = readFixture("x83-rohbau-small.xml");
    const tree = parseGaebTree(buffer, "x83-rohbau-small.xml");

    expect(tree.gaebVersion).toContain("3.2");
    expect(tree.daPhase).toBe("x83");
    expect(tree.projectName).toBe("Test Bauvorhaben");
    expect(tree.warnings).toHaveLength(0);

    expect(tree.positions).toHaveLength(4);

    const first = tree.positions[0];
    expect(first.ordnungszahl).toBe("01.001");
    expect(first.kurztext).toBe("Aushub Baugrube");
    expect(first.menge).toBe(120500); // 120.500 × 1000
    expect(first.einheit).toBe("m3");
    expect(first.einheitspreis).toBe(1550); // 15.50 € → 1550 cents
    expect(first.gesamtpreis).toBe(186775); // 1867.75 € → 186775 cents
    expect(first.titelLevel).toBeGreaterThan(0);
    expect(first.titel).toContain("Erdarbeiten");

    // Header totals are present in this fixture
    expect(tree.totalNet).toBe(2590525); // 25905.25 € net
    expect(tree.totalGross).toBe(3082725);
  });

  it("preserves ordnungszahl ordering across multiple titles", () => {
    const tree = parseGaebTree(readFixture("x83-rohbau-small.xml"), "x83-rohbau-small.xml");
    const ozs = tree.positions.map((p) => p.ordnungszahl);
    expect(ozs).toEqual(["01.001", "01.002", "02.001", "02.002"]);
  });

  it("flags broken X83 files but does not throw", () => {
    const tree = parseGaebTree(readFixture("x83-broken-totals.xml"), "x83-broken-totals.xml");
    expect(tree.positions).toHaveLength(2);

    // Item 01.001 has Qty=10, UP=50 → expected total 500.00 € (50000 cents),
    // but the file says 999.99 € (99999 cents). The parser preserves both.
    const first = tree.positions[0];
    expect(first.einheitspreis).toBe(5000);
    expect(first.gesamtpreis).toBe(99999);
  });

  it("falls back to filename when DA phase attribute is absent", () => {
    const minimalXml = `<?xml version="1.0" encoding="UTF-8"?>
<GAEB VersNo="3.2"><Award><BoQ><BoQBody></BoQBody></BoQ></Award></GAEB>`;
    const tree = parseGaebTree(Buffer.from(minimalXml), "anything.x86");
    expect(tree.daPhase).toBe("x86");
  });

  it("warns when root element is not GAEB", () => {
    const badXml = `<?xml version="1.0" encoding="UTF-8"?><NotGAEB/>`;
    const tree = parseGaebTree(Buffer.from(badXml), "weird.xml");
    expect(tree.warnings.length).toBeGreaterThan(0);
  });
});
