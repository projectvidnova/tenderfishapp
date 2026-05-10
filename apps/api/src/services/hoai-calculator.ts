/**
 * HOAI 2021 fee calculator (Gebäudeplanung §35 + Fachplanung).
 *
 * Pure functions only — no DB. Callers persist the result via the
 * `hoaiFeeCalculations` table.
 *
 * All monetary values in this module are CENTS (integer). The constant table
 * `HOAI_FEE_TABLE_GEBAEUDE` stores EUR floats; we convert at the boundary.
 */

import {
  HOAI_FEE_TABLE_GEBAEUDE,
  HOAI_PHASE_PERCENTAGES,
  HOAI_SPECIALIST_PHASE_PERCENTAGES,
} from "@tenderfish/shared";
import type { HoaiFeeZone, HoaiServiceType, LphNumber } from "@tenderfish/shared";

export interface PhaseFee {
  lph: number;
  percentage: number; // 0-100, post-normalization
  fee: number; // cents
}

export interface FeeModifier {
  key: string;
  label: string;
  factor: number; // e.g. 0.2 for +20% Umbauzuschlag, -0.1 for -10%
}

const EUR_TO_CENTS = 100;

/**
 * Linear-interpolate the base fee (cents) for `anrechenbareKosten` (cents) at the
 * given fee zone and a position-in-zone (0-100, 50 = midpoint min/max).
 *
 * Steps:
 *  1. Find the two adjacent rows in HOAI_FEE_TABLE_GEBAEUDE bracketing the cost.
 *  2. For each row, compute `min + (max - min) * positionInZone/100` for the chosen zone.
 *  3. Linearly interpolate between the two row results by the cost ratio.
 *
 * Edge cases:
 *  - Cost <= floor (25 000 €) → use the floor row directly (no extrapolation down).
 *  - Cost >= ceiling (25 000 000 €) → linear extrapolation off the top two rows
 *    (HOAI 2021 leaves above-table fees to free agreement; this gives a stable
 *    starting point and is flagged via `extrapolated: true`).
 */
export function interpolateBaseFee(
  anrechenbareKostenCents: number,
  feeZone: HoaiFeeZone,
  feePositionInZone: number
): { feeCents: number; extrapolated: boolean } {
  const pos = Math.max(0, Math.min(100, feePositionInZone)) / 100;
  const costEur = anrechenbareKostenCents / EUR_TO_CENTS;
  const rows = HOAI_FEE_TABLE_GEBAEUDE;

  const valueAtRow = (rowIndex: number): number => {
    const row = rows[rowIndex].fees[feeZone];
    return row.min + (row.max - row.min) * pos;
  };

  if (costEur <= rows[0].anrechenbareKosten) {
    return { feeCents: Math.round(valueAtRow(0) * EUR_TO_CENTS), extrapolated: false };
  }

  if (costEur >= rows[rows.length - 1].anrechenbareKosten) {
    // Linear extrapolation from the last two rows.
    const lo = rows.length - 2;
    const hi = rows.length - 1;
    const loCost = rows[lo].anrechenbareKosten;
    const hiCost = rows[hi].anrechenbareKosten;
    const loFee = valueAtRow(lo);
    const hiFee = valueAtRow(hi);
    const slopePerEur = (hiFee - loFee) / (hiCost - loCost);
    const fee = hiFee + slopePerEur * (costEur - hiCost);
    return { feeCents: Math.round(fee * EUR_TO_CENTS), extrapolated: true };
  }

  for (let i = 0; i < rows.length - 1; i++) {
    const a = rows[i];
    const b = rows[i + 1];
    if (costEur >= a.anrechenbareKosten && costEur <= b.anrechenbareKosten) {
      const t = (costEur - a.anrechenbareKosten) / (b.anrechenbareKosten - a.anrechenbareKosten);
      const fee = valueAtRow(i) + t * (valueAtRow(i + 1) - valueAtRow(i));
      return { feeCents: Math.round(fee * EUR_TO_CENTS), extrapolated: false };
    }
  }

  // Unreachable given the above branches, but keeps TS happy.
  return { feeCents: 0, extrapolated: true };
}

/**
 * Split a base fee (cents) across the commissioned LPH phases using the active
 * service type's percentage table. Phases not in `commissioned` are dropped and
 * the remaining percentages are renormalized so the rows sum to 100.
 *
 * Rounding: each phase fee is rounded individually; any cent residual from
 * rounding is absorbed into the largest-share phase so `Σ phaseFees = baseFee`.
 */
export function splitByPhases(
  baseFeeCents: number,
  serviceType: HoaiServiceType,
  commissionedPhases: number[]
): PhaseFee[] {
  const sourcePercentages =
    serviceType === "gebaeudeplanung"
      ? HOAI_PHASE_PERCENTAGES
      : HOAI_SPECIALIST_PHASE_PERCENTAGES[serviceType] ?? [];

  const commissionedSet = new Set(commissionedPhases);
  const filtered = sourcePercentages.filter((p) => commissionedSet.has(p.lph));
  const sum = filtered.reduce((acc, p) => acc + p.percentage, 0);
  if (sum === 0) return [];

  const fees: PhaseFee[] = filtered.map((p) => {
    const normalized = (p.percentage / sum) * 100;
    return {
      lph: p.lph,
      percentage: Math.round(normalized * 10) / 10, // one decimal
      fee: Math.round((normalized / 100) * baseFeeCents),
    };
  });

  // Reconcile residual cents into the largest-share phase.
  const totalAssigned = fees.reduce((a, p) => a + p.fee, 0);
  const residual = baseFeeCents - totalAssigned;
  if (residual !== 0 && fees.length > 0) {
    const target = fees.reduce((max, p) => (p.fee > max.fee ? p : max), fees[0]);
    target.fee += residual;
  }

  return fees;
}

/**
 * Apply multiplicative modifiers (e.g. Umbauzuschlag +20%, Wiederholung -10%).
 * Final fee = baseFee × (1 + Σ factor). Negative totals are clamped at zero.
 */
export function applyModifiers(baseFeeCents: number, modifiers: FeeModifier[]): number {
  const sum = modifiers.reduce((a, m) => a + (Number.isFinite(m.factor) ? m.factor : 0), 0);
  const total = Math.round(baseFeeCents * (1 + sum));
  return total < 0 ? 0 : total;
}

export interface HoaiCalculationResult {
  baseFee: number; // cents — pre-modifier
  totalFee: number; // cents — post-modifier
  phaseFees: PhaseFee[];
  extrapolated: boolean;
}

export function calculateHoai(input: {
  anrechenbareKostenCents: number;
  feeZone: HoaiFeeZone;
  feePositionInZone: number;
  serviceType: HoaiServiceType;
  commissionedPhases: number[];
  modifiers: FeeModifier[];
}): HoaiCalculationResult {
  if (input.serviceType === "freianlagenplanung") {
    throw new Error(
      "Freianlagenplanung-Honorartabelle (§40) ist noch nicht hinterlegt — bitte Gebäudeplanung verwenden oder das Honorar manuell als Modifier einfügen."
    );
  }

  const { feeCents, extrapolated } = interpolateBaseFee(
    input.anrechenbareKostenCents,
    input.feeZone,
    input.feePositionInZone
  );

  const totalFee = applyModifiers(feeCents, input.modifiers);
  const phaseFees = splitByPhases(totalFee, input.serviceType, input.commissionedPhases);

  return {
    baseFee: feeCents,
    totalFee,
    phaseFees,
    extrapolated,
  };
}

export const VALID_LPHS: LphNumber[] = [1, 2, 3, 4, 5, 6, 7, 8, 9];
