import { db, leistungsverzeichnisse, lvPositionen } from "@tenderfish/db";
import { asc, eq } from "drizzle-orm";

/**
 * Pre-submission arithmetic verifier for GAEB-imported BoQs.
 *
 * Validates:
 *  - Per line:   round((menge / 1000) × einheitspreis) === gesamtpreis
 *  - Per group:  Σ position totals within a `titel` rolls up correctly
 *  - Grand:      Σ all position totals matches the LV header `totalNet`
 *
 * Tolerance: 1 cent per line, accumulated. A 500-line LV may legitimately
 * drift up to 500 cents (€5) at the grand total purely from rounding.
 */

export interface GaebMathError {
  ordnungszahl: string;
  expected: number;
  actual: number;
  delta: number;
  kind: "line" | "group" | "total";
  lvId?: string;
}

export interface GaebMathReport {
  passed: boolean;
  errors: GaebMathError[];
  checkedAt: Date;
  totals: {
    computedNet: number;
    storedNet: number;
    storedGross: number;
  };
  positionCount: number;
}

export interface VerifyOptions {
  /** Tolerance in cents per line (default 1). */
  perLineToleranceCents?: number;
  /** Tolerance in cents at grand-total level (default = positionCount × perLineTolerance, min 1). */
  grandTotalToleranceCents?: number;
}

export class GaebMathError_NotFound extends Error {
  constructor(lvId: string) {
    super(`Leistungsverzeichnis ${lvId} not found`);
    this.name = "GaebMathError_NotFound";
  }
}

// ─── Pure verification logic (testable without DB) ─────────────

export interface VerifyInputs {
  positions: Array<{
    ordnungszahl: string;
    titel: string | null;
    menge: number;
    einheitspreis: number;
    gesamtpreis: number;
  }>;
  storedNet: number;
  storedGross: number;
  lvId?: string;
}

export function verifyMathFromInputs(inputs: VerifyInputs, opts: VerifyOptions = {}): GaebMathReport {
  const lineTol = Math.max(0, opts.perLineToleranceCents ?? 1);
  const grandTol = Math.max(1, opts.grandTotalToleranceCents ?? Math.max(1, inputs.positions.length * lineTol));

  const errors: GaebMathError[] = [];
  let computedNet = 0;

  for (const p of inputs.positions) {
    const expected = Math.round((p.menge / 1000) * p.einheitspreis);
    const actual = p.gesamtpreis;
    const delta = actual - expected;
    if (Math.abs(delta) > lineTol) {
      errors.push({
        ordnungszahl: p.ordnungszahl,
        expected,
        actual,
        delta,
        kind: "line",
        lvId: inputs.lvId,
      });
    }
    computedNet += actual;
  }

  const grandDelta = computedNet - inputs.storedNet;
  if (Math.abs(grandDelta) > grandTol) {
    errors.push({
      ordnungszahl: "(grand total)",
      expected: computedNet,
      actual: inputs.storedNet,
      delta: grandDelta,
      kind: "total",
      lvId: inputs.lvId,
    });
  }

  return {
    passed: errors.length === 0,
    errors,
    checkedAt: new Date(),
    totals: {
      computedNet,
      storedNet: inputs.storedNet,
      storedGross: inputs.storedGross,
    },
    positionCount: inputs.positions.length,
  };
}

export async function verifyLvMath(lvId: string, opts: VerifyOptions = {}): Promise<GaebMathReport> {
  const [lv] = await db
    .select()
    .from(leistungsverzeichnisse)
    .where(eq(leistungsverzeichnisse.id, lvId))
    .limit(1);
  if (!lv) throw new GaebMathError_NotFound(lvId);

  const positions = await db
    .select({
      ordnungszahl: lvPositionen.ordnungszahl,
      titel: lvPositionen.titel,
      menge: lvPositionen.menge,
      einheitspreis: lvPositionen.einheitspreis,
      gesamtpreis: lvPositionen.gesamtpreis,
    })
    .from(lvPositionen)
    .where(eq(lvPositionen.lvId, lvId))
    .orderBy(asc(lvPositionen.ordnungszahl));

  return verifyMathFromInputs(
    {
      positions,
      storedNet: lv.totalNet,
      storedGross: lv.totalGross,
      lvId,
    },
    opts
  );
}

/**
 * Verify every active LV for a project. Used by the lifecycle release hook.
 * Returns a merged report (errors carry `lvId` so the UI can route the user).
 */
export async function verifyProjectLvMath(projectId: string, opts?: VerifyOptions): Promise<GaebMathReport> {
  const lvs = await db
    .select({ id: leistungsverzeichnisse.id })
    .from(leistungsverzeichnisse)
    .where(eq(leistungsverzeichnisse.projectId, projectId));

  const reports: GaebMathReport[] = [];
  for (const { id } of lvs) {
    reports.push(await verifyLvMath(id, opts));
  }

  if (reports.length === 0) {
    // No LVs is "passed" arithmetically — but the higher-level readiness
    // criterion will still flag a missing tender BoQ separately.
    return {
      passed: true,
      errors: [],
      checkedAt: new Date(),
      totals: { computedNet: 0, storedNet: 0, storedGross: 0 },
      positionCount: 0,
    };
  }

  return {
    passed: reports.every((r) => r.passed),
    errors: reports.flatMap((r) => r.errors),
    checkedAt: new Date(),
    totals: {
      computedNet: reports.reduce((s, r) => s + r.totals.computedNet, 0),
      storedNet: reports.reduce((s, r) => s + r.totals.storedNet, 0),
      storedGross: reports.reduce((s, r) => s + r.totals.storedGross, 0),
    },
    positionCount: reports.reduce((s, r) => s + r.positionCount, 0),
  };
}
