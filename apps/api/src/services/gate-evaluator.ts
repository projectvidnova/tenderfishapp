import { db, gates, hoaiFeeCalculations, phases, projectFacts, tenderReleases } from "@tenderfish/db";
import { eq, asc, desc, and, ne } from "drizzle-orm";
import { verifyProjectLvMath } from "./gaeb-math-verifier";

interface FactEntry {
  value: string | null;
  dataState: string;
}

interface ExtraSignals {
  gaebMathClean: boolean;
  /** True if at least one HOAI fee calculation row exists for the project. */
  hoaiFeeZoneSet: boolean;
  /** Set of criterion keys directly attested by uploaded evidence (Add Evidence & Re-verify). */
  attestedCriterionKeys: Set<string>;
}

export interface GateCriterionStatus {
  key: string;
  label: string;
  met: boolean;
  autoCheck: boolean;
}

export interface GateReadiness {
  gate: string;
  pass: boolean;
  criteria: GateCriterionStatus[];
}

function hasFactValue(factIndex: Map<string, FactEntry[]>, fieldNames: string[]): boolean {
  for (const fieldName of fieldNames) {
    const entries = factIndex.get(fieldName) || [];
    if (entries.some((entry) => entry.dataState !== "MISSING" && !!entry.value && entry.value.trim().length > 0)) {
      return true;
    }
  }
  return false;
}

function isBuildingPermitConfirmed(factIndex: Map<string, FactEntry[]>): boolean {
  const entries = [
    ...(factIndex.get("overview_building_permit_status") || []),
    ...(factIndex.get("building_permit_status") || []),
  ];
  return entries.some((entry) => entry.dataState === "CONFIRMED");
}

function evaluateCriterion(criterionKey: string, factIndex: Map<string, FactEntry[]>, extra: ExtraSignals): boolean {
  // Direct evidence attestation wins over field-name mapping. When a user uploads
  // evidence via "Add Evidence & Re-verify" and the AI confirms it satisfies this
  // criterion, mark it met regardless of which structured fields were extracted.
  if (extra.attestedCriterionKeys.has(criterionKey)) {
    return true;
  }

  const map: Record<string, string[]> = {
    project_name: ["project_summary"],
    location: ["location"],
    client: ["overview_client_name", "client_name"],
    time_anchor: ["target_completion", "known_deadlines", "schedule"],
    scope_description: ["project_summary", "scope_description"],
    project_objective: ["project_summary", "scope_description"],
    constraints_identified: ["known_constraints"],
    risk_scan: ["mentioned_risks"],
    lph_roadmap: ["current_hoai_phase", "overview_commissioned_phases", "schedule"],
    responsibility_draft: ["stakeholder", "known_consultants"],
    kostenrahmen: ["estimated_construction_cost", "cost_item"],
    hoai_fee_zone: ["hoai_fee_zone", "standards_mapping"],
    scope_per_discipline: ["hoai_service_scope", "standards_mapping"],
    project_state_visible: ["current_hoai_phase", "project_summary"],
    outputs_defined: ["known_trade_packages", "standards_mapping"],
    input_docs_available: ["project_summary"],
    interfaces_identified: ["known_consultants", "standards_mapping"],
    internal_approval_to_invite: ["mentioned_approvals"],
    kostenschaetzung: ["cost_per_sqm_estimate", "cost_item"],
    hoai_scope_defined: ["hoai_service_scope", "standards_mapping"],
    tender_docs_approved: ["known_trade_packages", "standards_mapping"],
    consultant_inputs_complete: ["known_consultants", "stakeholder"],
    open_decisions_resolved: ["decision_authority", "mentioned_approvals"],
    pricing_model_ready: ["estimated_construction_cost", "cost_item"],
    procurement_model_confirmed: ["procurement_model", "procurement_model_vob"],
    kostenberechnung: ["cost_item", "estimated_construction_cost"],
    vob_procedure_determined: ["tendering_procedure_type", "standards_mapping"],
    trade_packages_defined: ["known_trade_packages", "standards_mapping"],
    contracts_awarded: ["contract_type_preference", "standards_mapping"],
    execution_drawings_approved: ["mentioned_approvals"],
    review_workflow_configured: ["mentioned_approvals", "project_summary"],
    site_team_onboarded: ["stakeholder", "known_consultants"],
    quality_plan_ready: ["mentioned_approvals", "project_summary"],
    kostenanschlag: ["cost_item"],
    sigeko_plan: ["sigeko_required", "standards_mapping"],
    baugenehmigung: ["building_permit_status", "overview_building_permit_status"],
    punch_list_closed: ["mentioned_approvals"],
    final_docs_submitted: ["mentioned_approvals"],
    all_reviews_closed: ["mentioned_approvals"],
    client_acceptance: ["decision_authority"],
    invoicing_complete: ["estimated_construction_cost", "cost_item"],
    kostenfeststellung: ["cost_item"],
    abnahmen_complete: ["mentioned_approvals"],
    warranty_tracking: ["mentioned_approvals"],
  };

  if (criterionKey === "bauantrag_submitted" || criterionKey === "baugenehmigung") {
    return isBuildingPermitConfirmed(factIndex);
  }

  if (criterionKey === "gaeb_math_clean") {
    return extra.gaebMathClean;
  }

  if (criterionKey === "hoai_fee_zone") {
    // Met if a HOAI fee calculation row exists for this project, OR if the AI
    // extracted a `hoai_fee_zone` / `standards_mapping` fact (back-compat).
    if (extra.hoaiFeeZoneSet) return true;
  }

  const fields = map[criterionKey];
  if (!fields) return false;
  return hasFactValue(factIndex, fields);
}

export async function refreshGateCriteriaFromFacts(projectId: string): Promise<GateReadiness[]> {
  const [facts, gateRows, latestRelease, hoaiRows] = await Promise.all([
    db.query.projectFacts.findMany({
      where: eq(projectFacts.projectId, projectId),
    }),
    db.query.gates.findMany({
      where: eq(gates.projectId, projectId),
      orderBy: asc(gates.gate),
    }),
    db.query.tenderReleases.findFirst({
      where: eq(tenderReleases.projectId, projectId),
      orderBy: desc(tenderReleases.createdAt),
    }),
    db
      .select({ id: hoaiFeeCalculations.id })
      .from(hoaiFeeCalculations)
      .where(eq(hoaiFeeCalculations.projectId, projectId))
      .limit(1),
  ]);

  const hoaiFeeZoneSet = hoaiRows.length > 0;

  // Compute math gate live (cheap when LVs are small). If a release row already
  // has a verified result, prefer that (avoids redundant compute).
  let gaebMathClean = false;
  if (latestRelease?.gaebMathVerified) {
    gaebMathClean = true;
  } else {
    try {
      const report = await verifyProjectLvMath(projectId);
      gaebMathClean = report.passed && report.positionCount > 0;
    } catch {
      gaebMathClean = false;
    }
  }
  const attestedCriterionKeys = new Set<string>();
  const factIndex = new Map<string, FactEntry[]>();
  for (const fact of facts) {
    const existing = factIndex.get(fact.fieldName) || [];
    existing.push({ value: fact.value, dataState: fact.dataState });
    factIndex.set(fact.fieldName, existing);

    if (fact.fieldName === "gate_evidence_attestation" && typeof fact.value === "string") {
      try {
        const parsed = JSON.parse(fact.value) as { criterion_key?: unknown };
        if (typeof parsed.criterion_key === "string" && parsed.criterion_key.length > 0) {
          attestedCriterionKeys.add(parsed.criterion_key);
        }
      } catch {
        // Skip malformed attestation facts.
      }
    }
  }

  const extra: ExtraSignals = { gaebMathClean, hoaiFeeZoneSet, attestedCriterionKeys };

  const gateOrder = ["A", "B", "C", "D", "E", "F"];
  let previousGatePassed = true;
  const readiness: GateReadiness[] = [];

  for (const gateLetter of gateOrder) {
    const gateRow = gateRows.find((item) => item.gate === gateLetter);
    if (!gateRow) continue;

    const currentCriteria = gateRow.criteria as GateCriterionStatus[];
    const mergedCriteria: GateCriterionStatus[] = currentCriteria.map((existing) => ({
      ...existing,
      met: evaluateCriterion(existing.key, factIndex, extra),
      autoCheck: true,
    }));

    const gatePassed = mergedCriteria.every((criterion) => criterion.met);

    await db
      .update(gates)
      .set({
        criteria: mergedCriteria,
        status:
          gateRow.status === "complete" || gateRow.status === "overridden"
            ? gateRow.status
            : previousGatePassed
            ? "in_progress"
            : "locked",
      })
      .where(eq(gates.id, gateRow.id));

    readiness.push({
      gate: gateLetter,
      pass: gatePassed,
      criteria: mergedCriteria,
    });

    previousGatePassed = previousGatePassed && gatePassed;
  }

  return readiness;
}

export async function autoCompleteEligibleGates(projectId: string): Promise<void> {
  const gateRows = await db.query.gates.findMany({
    where: eq(gates.projectId, projectId),
    orderBy: asc(gates.gate),
  });

  const gateOrder = ["A", "B", "C", "D", "E", "F"];
  let chainOpen = true;

  for (const gateLetter of gateOrder) {
    const gateRow = gateRows.find((item) => item.gate === gateLetter);
    if (!gateRow) continue;

    if (gateRow.status === "overridden") {
      chainOpen = true;
      continue;
    }

    if (gateRow.status === "complete") {
      chainOpen = true;
      continue;
    }

    const criteria = gateRow.criteria as GateCriterionStatus[];
    const gatePassed = criteria.every((criterion) => criterion.met);

    if (chainOpen && gatePassed) {
      await db.update(gates).set({ status: "complete" }).where(eq(gates.id, gateRow.id));
      chainOpen = true;
      continue;
    }

    if (chainOpen) {
      await db.update(gates).set({ status: "in_progress" }).where(eq(gates.id, gateRow.id));
      chainOpen = false;
      continue;
    }

    await db.update(gates).set({ status: "locked" }).where(eq(gates.id, gateRow.id));
  }
}

/**
 * Mapping: which HOAI phases are "complete" once a gate is complete, and which
 * phase becomes "active" while still in progress on that gate.
 *
 * Aligns with V5 spec / standard HOAI phase boundaries:
 *  Gate A (Project Intake)             — start of LPH 1   → LPH 1 active
 *  Gate B (Planning Ready)             — done with LPH 1+2 → LPH 1-2 complete, LPH 3 active
 *  Gate C (Consultant Invitation)      — done with LPH 3   → LPH 1-3 complete, LPH 4 active
 *  Gate D (Tender Ready)               — done with LPH 4-6 → LPH 1-6 complete, LPH 7 active
 *  Gate E (Execution Ready)            — done with LPH 7   → LPH 1-7 complete, LPH 8 active
 *  Gate F (Closeout Ready)             — done with LPH 8   → LPH 1-8 complete, LPH 9 active
 */
const GATE_PHASE_MAP: Record<string, { complete: number[]; active: number | null }> = {
  A: { complete: [], active: 1 },
  B: { complete: [1, 2], active: 3 },
  C: { complete: [1, 2, 3], active: 4 },
  D: { complete: [1, 2, 3, 4, 5, 6], active: 7 },
  E: { complete: [1, 2, 3, 4, 5, 6, 7], active: 8 },
  F: { complete: [1, 2, 3, 4, 5, 6, 7, 8], active: 9 },
};

/**
 * Update each project's phases table to reflect the highest gate completed.
 * - Phases listed in `complete` for the highest completed gate become `complete`.
 * - The next phase becomes `active`.
 * - Phases that were manually marked complete are preserved (we never roll back).
 */
export async function syncPhasesFromGateCompletions(projectId: string): Promise<void> {
  const [allGates, allPhases] = await Promise.all([
    db.query.gates.findMany({
      where: eq(gates.projectId, projectId),
      orderBy: asc(gates.gate),
    }),
    db.query.phases.findMany({
      where: eq(phases.projectId, projectId),
      orderBy: asc(phases.lph),
    }),
  ]);

  // Highest gate that's complete (or human-overridden) — same effect for journey purposes.
  const gateOrder = ["A", "B", "C", "D", "E", "F"];
  let highestCompletedIdx = -1;
  for (let i = 0; i < gateOrder.length; i++) {
    const g = allGates.find((row) => row.gate === gateOrder[i]);
    if (g && (g.status === "complete" || g.status === "overridden")) {
      highestCompletedIdx = i;
    }
  }

  // Build the target set of complete phases and the active phase from the mapping.
  const targetComplete = new Set<number>();
  let targetActive: number | null = null;

  if (highestCompletedIdx === -1) {
    // No gates complete yet: LPH 1 is active by default if it isn't already past.
    targetActive = 1;
  } else {
    const map = GATE_PHASE_MAP[gateOrder[highestCompletedIdx]];
    for (const lph of map.complete) targetComplete.add(lph);
    targetActive = map.active;
  }

  for (const ph of allPhases) {
    let nextStatus: "not_started" | "active" | "complete" = ph.status;

    // Never roll back a manually-set complete (preserve user intent).
    if (ph.status === "complete") continue;

    if (targetComplete.has(ph.lph)) {
      nextStatus = "complete";
    } else if (targetActive !== null && ph.lph === targetActive) {
      nextStatus = "active";
    } else if (targetActive !== null && ph.lph < targetActive && !targetComplete.has(ph.lph)) {
      // Phases earlier than the active phase but not yet in the complete set — leave as-is.
      // (E.g. LPH 4 between Gate C complete and Gate D not yet — schema map below sets D.complete = 1-6.)
      continue;
    } else if (targetActive !== null && ph.lph > targetActive) {
      nextStatus = "not_started";
    }

    if (nextStatus !== ph.status) {
      await db.update(phases).set({ status: nextStatus }).where(eq(phases.id, ph.id));
    }
  }
}

export async function refreshAndAutoCompleteGates(projectId: string): Promise<GateReadiness[]> {
  const readiness = await refreshGateCriteriaFromFacts(projectId);
  await autoCompleteEligibleGates(projectId);
  await syncPhasesFromGateCompletions(projectId);
  return readiness;
}
