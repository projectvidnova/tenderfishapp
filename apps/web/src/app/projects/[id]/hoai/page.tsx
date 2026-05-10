"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import AppShell from "@/components/layout/AppShell";
import { ProjectTopBar } from "@/components/project/ProjectTopBar";
import { formatEur } from "@/lib/formatters";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

type ServiceType =
  | "gebaeudeplanung"
  | "freianlagenplanung"
  | "tragwerksplanung"
  | "technische_ausruestung";

type FeeZone = "I" | "II" | "III" | "IV" | "V";

type Modifier = { key: string; label: string; factor: number };

type PhaseFee = { lph: number; percentage: number; fee: number };

type Calculation = {
  id: string;
  serviceType: ServiceType;
  feeZone: FeeZone;
  anrechenbareKosten: number; // cents
  feePositionInZone: number; // 0-100
  baseFee: number; // cents
  totalFee: number; // cents
  commissionedPhases: number[];
  phaseFees: PhaseFee[];
  modifiers: Modifier[] | null;
  notes: string | null;
  calculatedAt: string;
  extrapolated?: boolean;
};

const SERVICE_TYPE_LABEL: Record<ServiceType, string> = {
  gebaeudeplanung: "Gebäudeplanung (Building design)",
  freianlagenplanung: "Freianlagenplanung (Outdoor facilities)",
  tragwerksplanung: "Tragwerksplanung (Structural)",
  technische_ausruestung: "Technische Ausrüstung (MEP)",
};

const FEE_ZONE_LABEL: Record<FeeZone, string> = {
  I: "Honorarzone I — very low complexity",
  II: "Honorarzone II — low complexity",
  III: "Honorarzone III — average complexity",
  IV: "Honorarzone IV — above-average complexity",
  V: "Honorarzone V — very high complexity",
};

const LPH_NAME: Record<number, string> = {
  1: "LPH 1 · Grundlagenermittlung",
  2: "LPH 2 · Vorplanung",
  3: "LPH 3 · Entwurfsplanung",
  4: "LPH 4 · Genehmigungsplanung",
  5: "LPH 5 · Ausführungsplanung",
  6: "LPH 6 · Vorbereitung der Vergabe",
  7: "LPH 7 · Mitwirkung bei der Vergabe",
  8: "LPH 8 · Objektüberwachung",
  9: "LPH 9 · Objektbetreuung",
};

const ALL_LPHS = [1, 2, 3, 4, 5, 6, 7, 8, 9];

const DEFAULT_FORM = {
  serviceType: "gebaeudeplanung" as ServiceType,
  feeZone: "III" as FeeZone,
  anrechenbareKostenEur: "1000000",
  feePositionInZone: 50,
  commissionedPhases: ALL_LPHS as number[],
  modifiers: [] as Modifier[],
  notes: "",
};

export default function HoaiPage() {
  const { id: projectId } = useParams() as { id: string };
  const [calculations, setCalculations] = useState<Calculation[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(DEFAULT_FORM);
  const [savedNotice, setSavedNotice] = useState<string>("");
  const [errorMsg, setErrorMsg] = useState<string>("");

  const fetchCalcs = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`${API}/api/projects/${projectId}/hoai`, { credentials: "include" });
    if (res.ok) {
      const json = await res.json();
      setCalculations(json.data ?? []);
    }
    setLoading(false);
  }, [projectId]);

  useEffect(() => {
    fetchCalcs();
  }, [fetchCalcs]);

  // Load the calc for the active service type into the form when the user picks
  // a service type that already has a saved calculation.
  useEffect(() => {
    const existing = calculations.find((c) => c.serviceType === form.serviceType);
    if (!existing) return;
    setForm((prev) => ({
      ...prev,
      feeZone: existing.feeZone,
      anrechenbareKostenEur: (existing.anrechenbareKosten / 100).toString(),
      feePositionInZone: existing.feePositionInZone,
      commissionedPhases: existing.commissionedPhases,
      modifiers: existing.modifiers ?? [],
      notes: existing.notes ?? "",
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.serviceType, calculations.length]);

  const activeCalc = useMemo(
    () => calculations.find((c) => c.serviceType === form.serviceType),
    [calculations, form.serviceType]
  );

  async function save() {
    setSaving(true);
    setErrorMsg("");
    setSavedNotice("");
    const cents = Math.round(parseFloat(form.anrechenbareKostenEur || "0") * 100);
    const res = await fetch(`${API}/api/projects/${projectId}/hoai`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        serviceType: form.serviceType,
        feeZone: form.feeZone,
        anrechenbareKosten: cents,
        feePositionInZone: form.feePositionInZone,
        commissionedPhases: form.commissionedPhases,
        modifiers: form.modifiers,
        notes: form.notes || undefined,
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      setErrorMsg(err?.message || err?.error || "Save failed");
    } else {
      setSavedNotice("Saved.");
      await fetchCalcs();
    }
    setSaving(false);
  }

  function togglePhase(lph: number) {
    setForm((prev) => {
      const next = prev.commissionedPhases.includes(lph)
        ? prev.commissionedPhases.filter((l) => l !== lph)
        : [...prev.commissionedPhases, lph].sort((a, b) => a - b);
      return { ...prev, commissionedPhases: next };
    });
  }

  function addModifier() {
    setForm((prev) => ({
      ...prev,
      modifiers: [...prev.modifiers, { key: `mod_${prev.modifiers.length + 1}`, label: "", factor: 0 }],
    }));
  }

  function updateModifier(idx: number, field: "label" | "factor", value: string) {
    setForm((prev) => {
      const next = [...prev.modifiers];
      if (field === "factor") {
        const num = parseFloat(value || "0") / 100; // UI is in %, store as factor
        next[idx] = { ...next[idx], factor: Number.isFinite(num) ? num : 0 };
      } else {
        next[idx] = { ...next[idx], label: value };
      }
      return { ...prev, modifiers: next };
    });
  }

  function removeModifier(idx: number) {
    setForm((prev) => ({ ...prev, modifiers: prev.modifiers.filter((_, i) => i !== idx) }));
  }

  return (
    <AppShell>
      <ProjectTopBar projectId={projectId} />

      <div className="w-full space-y-6 mt-6">
        <div>
          <h1 className="text-xl font-semibold">HOAI Honorar</h1>
          <p className="text-sm text-text-tertiary mt-0.5">
            Architect-fee calculation per HOAI 2021 (Honorarordnung für Architekten und Ingenieure).
            Orientation values per §35 (Gebäudeplanung) and §§51, 55 (Fachplanung).
          </p>
        </div>

        {loading ? (
          <div className="card p-8 text-center text-text-tertiary">Loading…</div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left — Form */}
            <div className="card p-5 space-y-4">
              <h2 className="text-sm font-semibold text-text-primary uppercase tracking-wide">
                Inputs
              </h2>

              <div>
                <label className="label">Service type (Leistungsbild)</label>
                <select
                  className="input"
                  value={form.serviceType}
                  onChange={(e) =>
                    setForm({ ...form, serviceType: e.target.value as ServiceType })
                  }
                >
                  {(Object.keys(SERVICE_TYPE_LABEL) as ServiceType[]).map((t) => (
                    <option key={t} value={t}>
                      {SERVICE_TYPE_LABEL[t]}
                    </option>
                  ))}
                </select>
                {form.serviceType === "freianlagenplanung" && (
                  <p className="text-xs text-status-warning-fg mt-1">
                    Freianlagenplanung-Honorartabelle (§40) is not yet built in. Use the modifiers
                    on a Gebäudeplanung calculation, or save will return an error.
                  </p>
                )}
              </div>

              <div>
                <label className="label">Fee zone (Honorarzone)</label>
                <select
                  className="input"
                  value={form.feeZone}
                  onChange={(e) => setForm({ ...form, feeZone: e.target.value as FeeZone })}
                >
                  {(Object.keys(FEE_ZONE_LABEL) as FeeZone[]).map((z) => (
                    <option key={z} value={z}>
                      {FEE_ZONE_LABEL[z]}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="label">Anrechenbare Kosten (€, net)</label>
                <input
                  type="number"
                  step="1000"
                  min="0"
                  className="input"
                  value={form.anrechenbareKostenEur}
                  onChange={(e) => setForm({ ...form, anrechenbareKostenEur: e.target.value })}
                />
                <p className="text-xs text-text-tertiary mt-1">
                  Typically the sum of cost groups DIN 276 KG 300 + 400 (and KG 200/500/600/700 where contractually agreed).
                </p>
              </div>

              <div>
                <label className="label">
                  Fee position within zone: <span className="font-mono">{form.feePositionInZone}%</span>
                  <span className="text-text-tertiary font-normal"> (0 = Mindestsatz, 100 = Höchstsatz)</span>
                </label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="5"
                  value={form.feePositionInZone}
                  onChange={(e) =>
                    setForm({ ...form, feePositionInZone: parseInt(e.target.value, 10) })
                  }
                  className="w-full"
                />
              </div>

              <div>
                <label className="label">Commissioned phases (LPH)</label>
                <div className="grid grid-cols-3 gap-2">
                  {ALL_LPHS.map((lph) => (
                    <label
                      key={lph}
                      className={`flex items-center gap-2 px-2 py-1.5 rounded-sm border text-xs cursor-pointer ${
                        form.commissionedPhases.includes(lph)
                          ? "border-brand-orange bg-brand-orange/10 text-brand-orange"
                          : "border-border bg-white text-text-secondary"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={form.commissionedPhases.includes(lph)}
                        onChange={() => togglePhase(lph)}
                        className="hidden"
                      />
                      LPH {lph}
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <label className="label">Modifiers (Zu-/Abschläge)</label>
                  <button
                    type="button"
                    onClick={addModifier}
                    className="text-xs text-brand-orange hover:text-brand-orange-dark font-medium"
                  >
                    + Add modifier
                  </button>
                </div>
                {form.modifiers.length === 0 ? (
                  <p className="text-xs text-text-tertiary">
                    e.g. Umbauzuschlag +20%, Wiederholung -10%. Apply multiplicatively.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {form.modifiers.map((m, idx) => (
                      <div key={idx} className="flex gap-2 items-center">
                        <input
                          className="input flex-1 text-xs"
                          placeholder="Label (e.g. Umbauzuschlag)"
                          value={m.label}
                          onChange={(e) => updateModifier(idx, "label", e.target.value)}
                        />
                        <input
                          type="number"
                          step="1"
                          className="input w-24 text-xs font-mono"
                          placeholder="%"
                          value={Math.round(m.factor * 100).toString()}
                          onChange={(e) => updateModifier(idx, "factor", e.target.value)}
                        />
                        <span className="text-xs text-text-tertiary">%</span>
                        <button
                          type="button"
                          onClick={() => removeModifier(idx)}
                          className="text-text-quaternary hover:text-status-danger text-xs"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className="label">Notes</label>
                <textarea
                  className="input"
                  rows={2}
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  placeholder="Optional — assumptions, contract reference, etc."
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                {savedNotice && (
                  <span className="text-xs text-status-success-fg">{savedNotice}</span>
                )}
                {errorMsg && <span className="text-xs text-status-danger">{errorMsg}</span>}
                <button className="btn-primary text-sm" onClick={save} disabled={saving}>
                  {saving ? "Saving…" : activeCalc ? "Update calculation" : "Calculate & save"}
                </button>
              </div>
            </div>

            {/* Right — Breakdown */}
            <div className="card p-5 space-y-4">
              <h2 className="text-sm font-semibold text-text-primary uppercase tracking-wide">
                Breakdown
              </h2>

              {!activeCalc ? (
                <div className="text-sm text-text-tertiary">
                  No saved calculation for this service type yet. Fill the form on the left and
                  click <span className="font-medium">Calculate &amp; save</span>.
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <div className="text-xs uppercase text-text-tertiary">Base fee</div>
                      <div className="mt-0.5 font-mono">{formatEur(activeCalc.baseFee)}</div>
                    </div>
                    <div>
                      <div className="text-xs uppercase text-text-tertiary">Total fee (net)</div>
                      <div className="mt-0.5 font-mono text-brand-orange font-semibold">
                        {formatEur(activeCalc.totalFee)}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs uppercase text-text-tertiary">Anrechenbare Kosten</div>
                      <div className="mt-0.5 font-mono">{formatEur(activeCalc.anrechenbareKosten)}</div>
                    </div>
                    <div>
                      <div className="text-xs uppercase text-text-tertiary">Honorarzone · Position</div>
                      <div className="mt-0.5">
                        {activeCalc.feeZone} · {activeCalc.feePositionInZone}%
                      </div>
                    </div>
                  </div>

                  {activeCalc.extrapolated && (
                    <div className="text-xs text-status-warning-fg bg-status-warning-bg border border-status-warning-border rounded-sm p-2">
                      Anrechenbare Kosten exceed the HOAI table ceiling (25 M €). Fee was
                      linearly extrapolated — confirm against a freely-agreed contract clause.
                    </div>
                  )}

                  <div>
                    <h3 className="text-xs font-medium text-text-tertiary uppercase tracking-wide mb-2">
                      Per phase (LPH)
                    </h3>
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border bg-bg-inset/30">
                          <th className="text-left px-3 py-1.5 text-xs font-medium text-text-tertiary uppercase">Phase</th>
                          <th className="text-right px-3 py-1.5 text-xs font-medium text-text-tertiary uppercase">%</th>
                          <th className="text-right px-3 py-1.5 text-xs font-medium text-text-tertiary uppercase">Fee (net)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {activeCalc.phaseFees.map((p) => (
                          <tr key={p.lph} className="border-b border-border last:border-0">
                            <td className="px-3 py-2 text-text-primary">{LPH_NAME[p.lph] ?? `LPH ${p.lph}`}</td>
                            <td className="px-3 py-2 text-right font-mono text-xs">
                              {p.percentage.toFixed(1)}%
                            </td>
                            <td className="px-3 py-2 text-right font-mono">{formatEur(p.fee)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {activeCalc.modifiers && activeCalc.modifiers.length > 0 && (
                    <div>
                      <h3 className="text-xs font-medium text-text-tertiary uppercase tracking-wide mb-2">
                        Applied modifiers
                      </h3>
                      <ul className="text-xs text-text-secondary space-y-0.5">
                        {activeCalc.modifiers.map((m, i) => (
                          <li key={i}>
                            {m.label || m.key}:{" "}
                            <span className="font-mono">
                              {m.factor >= 0 ? "+" : ""}
                              {Math.round(m.factor * 100)}%
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {activeCalc.notes && (
                    <div className="text-xs text-text-secondary border-t border-border pt-3">
                      {activeCalc.notes}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {calculations.length > 1 && (
          <div className="card p-5">
            <h2 className="text-sm font-semibold text-text-primary uppercase tracking-wide mb-3">
              All saved calculations
            </h2>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-bg-inset/30">
                  <th className="text-left px-3 py-1.5 text-xs font-medium text-text-tertiary uppercase">Service type</th>
                  <th className="text-left px-3 py-1.5 text-xs font-medium text-text-tertiary uppercase">Zone</th>
                  <th className="text-right px-3 py-1.5 text-xs font-medium text-text-tertiary uppercase">Anrechenbar</th>
                  <th className="text-right px-3 py-1.5 text-xs font-medium text-text-tertiary uppercase">Total fee</th>
                </tr>
              </thead>
              <tbody>
                {calculations.map((c) => (
                  <tr key={c.id} className="border-b border-border last:border-0">
                    <td className="px-3 py-2">{SERVICE_TYPE_LABEL[c.serviceType] ?? c.serviceType}</td>
                    <td className="px-3 py-2">{c.feeZone}</td>
                    <td className="px-3 py-2 text-right font-mono">{formatEur(c.anrechenbareKosten)}</td>
                    <td className="px-3 py-2 text-right font-mono">{formatEur(c.totalFee)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AppShell>
  );
}
