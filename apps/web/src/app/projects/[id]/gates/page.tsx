"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import AppShell from "@/components/layout/AppShell";
import { Modal } from "@/components/ui/Modal";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

const GATE_META: Record<string, { name: string; purpose: string; unlocks: string[] }> = {
  A: { name: "Project Intake Complete", purpose: "Confirms that sufficient baseline information exists to begin structured planning.", unlocks: ["Project dashboard", "Phase planning", "Risk register", "Document management"] },
  B: { name: "Planning Ready", purpose: "Confirms the project objective is clear and a first risk scan has been performed.", unlocks: ["Schedule generation", "Responsibility matrix", "Approval workflows"] },
  C: { name: "Consultant Invitation Ready", purpose: "Confirms that sufficient project documentation exists to invite external consultants.", unlocks: ["Consultant invitations", "Discipline-specific scope sharing"] },
  D: { name: "Tender Ready", purpose: "Confirms that procurement packages are complete and ready for market issue.", unlocks: ["Bidder invitations", "Tender issue", "Bid return tracking"] },
  E: { name: "Execution Ready", purpose: "Confirms that contracts are in place and the project is ready for site execution.", unlocks: ["Execution evidence tracking", "Shop drawing reviews", "Site submissions"] },
  F: { name: "Closeout Ready", purpose: "Confirms that all execution is complete and the project is ready for handover.", unlocks: ["Project closeout", "Final documentation", "Defect liability management"] },
};

type Gate = {
  id: string;
  gate: string;
  status: string;
  criteria: { key: string; label: string; met: boolean; autoCheck: boolean }[];
  readinessPercent: number;
  criteriaCount: number;
  criteriaMet: number;
  overrideActive: boolean;
  overrideReason: string | null;
  overrideBy: string | null;
  overrideAt: string | null;
};

const STATUS_STYLES: Record<string, { label: string; cls: string }> = {
  complete: { label: "Complete", cls: "bg-status-success-bg text-status-success-fg border-status-success-border" },
  in_progress: { label: "In Progress", cls: "bg-status-warning-bg text-brand-orange border-status-warning-border" },
  locked: { label: "Locked", cls: "bg-bg-inset text-text-tertiary border-border" },
  overridden: { label: "Overridden", cls: "bg-orange-100 text-orange-700 border-orange-300" },
};

export default function GatesPage() {
  const { id } = useParams() as { id: string };
  const [gates, setGates] = useState<Gate[]>([]);
  const [expanded, setExpanded] = useState<string | null>("A");
  const [loading, setLoading] = useState(true);
  const [overrideGate, setOverrideGate] = useState<string | null>(null);
  const [overrideReason, setOverrideReason] = useState("");
  const [overrideAck, setOverrideAck] = useState(false);

  const fetchGates = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/projects/${id}/gates/detail`);
      if (res.ok) setGates((await res.json()).data);
    } catch { /* ignore */ }
    setLoading(false);
  }, [id]);

  useEffect(() => { fetchGates(); }, [fetchGates]);

  async function toggleCriterion(gate: string, key: string, met: boolean) {
    await fetch(`${API}/api/projects/${id}/gates/${gate}/criteria/${key}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ met }),
    });
    fetchGates();
  }

  async function completeGate(gate: string) {
    const res = await fetch(`${API}/api/projects/${id}/gates/${gate}/complete`, { method: "POST" });
    if (!res.ok) {
      const err = await res.json();
      alert(err.message || err.error);
      return;
    }
    fetchGates();
  }

  async function submitOverride() {
    if (!overrideGate || overrideReason.trim().length < 50 || !overrideAck) return;
    const res = await fetch(`${API}/api/projects/${id}/gates/${overrideGate}/override`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: overrideReason.trim() }),
    });
    if (!res.ok) {
      const err = await res.json();
      alert(err.message || err.error);
      return;
    }
    setOverrideGate(null);
    setOverrideReason("");
    setOverrideAck(false);
    fetchGates();
  }

  if (loading) {
    return (
      <AppShell>
        <div className="flex items-center justify-center h-64 text-text-quaternary text-sm">Loading gates…</div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold text-text-primary">Gate Control</h1>

        <div className="space-y-3">
          {gates.map((g) => {
            const meta = GATE_META[g.gate];
            const style = STATUS_STYLES[g.status] || STATUS_STYLES.locked;
            const isExpanded = expanded === g.gate;
            const allMet = g.criteriaMet === g.criteriaCount && g.criteriaCount > 0;
            const canComplete = g.status === "in_progress" && allMet;

            return (
              <div key={g.gate} className="card overflow-hidden">
                {/* Header */}
                <button
                  onClick={() => setExpanded(isExpanded ? null : g.gate)}
                  className="w-full px-5 py-4 flex items-center justify-between hover:bg-bg-inset/30 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 ${
                      g.status === "complete" ? "border-green-500 bg-status-success-light" :
                      g.status === "in_progress" ? "border-brand-orange bg-status-warning-light" :
                      g.status === "overridden" ? "border-orange-500 bg-orange-50" :
                      "border-border bg-bg-bg-page"
                    }`}>
                      <span className="font-mono text-sm font-semibold text-text-primary">{g.gate}</span>
                    </div>
                    <div className="text-left">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-text-primary">Gate {g.gate}: {meta?.name}</span>
                        <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-sm border ${style.cls}`}>
                          {style.label}{g.status === "overridden" && " *"}
                        </span>
                      </div>
                      <p className="text-xs text-text-tertiary mt-0.5">{meta?.purpose}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-sm text-text-tertiary">{g.readinessPercent}%</span>
                    <svg className={`w-4 h-4 text-text-quaternary transition-transform ${isExpanded ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </button>

                {/* Expanded body */}
                {isExpanded && (
                  <div className="px-5 pb-5 space-y-4 border-t border-border">
                    {/* Override banner */}
                    {g.overrideActive && (
                      <div className="mt-4 bg-orange-50 border border-orange-200 rounded-xl px-4 py-3 text-sm text-orange-700">
                        Overridden on {g.overrideAt ? new Date(g.overrideAt).toLocaleDateString() : "—"} — {g.overrideReason || "No reason provided"}. All downstream consequences are in effect.
                      </div>
                    )}

                    {/* Readiness bar */}
                    <div className="mt-4">
                      <div className="flex items-center justify-between text-xs text-text-tertiary mb-1">
                        <span>Readiness</span>
                        <span className="font-mono">{g.criteriaMet}/{g.criteriaCount} criteria met</span>
                      </div>
                      <div className="h-2 bg-bg-inset rounded-full overflow-hidden">
                        <div
                          className="h-full bg-brand-orange rounded-full transition-all"
                          style={{ width: `${g.readinessPercent}%` }}
                        />
                      </div>
                    </div>

                    {/* Criteria checklist */}
                    <div className="space-y-2">
                      <h3 className="text-xs font-medium text-text-tertiary uppercase tracking-wide">Criteria</h3>
                      {g.criteria.map((c) => (
                        <label
                          key={c.key}
                          className={`flex items-center gap-3 p-2.5 rounded-xl border cursor-pointer transition-colors ${
                            c.met ? "border-green-200 bg-status-success-light/50" : "border-border hover:bg-bg-inset/30"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={c.met}
                            onChange={(e) => toggleCriterion(g.gate, c.key, e.target.checked)}
                            disabled={g.status === "locked" || g.status === "complete"}
                            className="accent-bronze w-4 h-4"
                          />
                          <span className={`text-sm ${c.met ? "text-status-success-fg" : "text-text-primary"}`}>{c.label}</span>
                          {c.autoCheck && (
                            <span className="text-[10px] text-text-quaternary ml-auto">auto</span>
                          )}
                        </label>
                      ))}
                    </div>

                    {/* Unlocks section */}
                    {meta?.unlocks && meta.unlocks.length > 0 && (
                      <div>
                        <h3 className="text-xs font-medium text-text-tertiary uppercase tracking-wide mb-2">Unlocks when complete</h3>
                        <div className="flex flex-wrap gap-2">
                          {meta.unlocks.map((u) => (
                            <span key={u} className="text-xs bg-bg-inset text-text-secondary px-2 py-1 rounded-sm">{u}</span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex items-center gap-3 pt-2">
                      {canComplete && (
                        <button
                          onClick={() => completeGate(g.gate)}
                          className="btn-primary text-sm"
                        >
                          Mark Gate {g.gate} as Complete
                        </button>
                      )}
                      {g.status !== "complete" && g.status !== "locked" && (
                        <button
                          onClick={() => setOverrideGate(g.gate)}
                          className="btn-secondary text-sm text-orange-600 border-orange-300 hover:bg-orange-50"
                        >
                          Override Gate
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Override Modal */}
        <Modal
          open={!!overrideGate}
          onClose={() => { setOverrideGate(null); setOverrideReason(""); setOverrideAck(false); }}
          title={`Override Gate ${overrideGate}`}
        >
          <div className="space-y-4">
            <div className="bg-orange-50 border border-orange-200 rounded-xl px-4 py-3 text-sm text-orange-700">
              You are overriding Gate {overrideGate}. This action is permanent and logged.
            </div>
            <div>
              <label className="label">Reason (min 50 characters)</label>
              <textarea
                className="input"
                rows={4}
                value={overrideReason}
                onChange={(e) => setOverrideReason(e.target.value)}
                placeholder="Explain why this gate is being overridden…"
              />
              <span className="text-xs text-text-quaternary mt-1 block">{overrideReason.length}/50 characters</span>
            </div>
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={overrideAck}
                onChange={(e) => setOverrideAck(e.target.checked)}
                className="accent-bronze mt-0.5"
              />
              <span className="text-sm text-text-secondary">I confirm this override and accept responsibility for all downstream consequences.</span>
            </label>
            <div className="flex justify-end gap-3 pt-2">
              <button className="btn-secondary" onClick={() => { setOverrideGate(null); setOverrideReason(""); setOverrideAck(false); }}>Cancel</button>
              <button
                className="bg-orange-600 text-white px-4 py-2 text-sm font-medium rounded-button hover:bg-orange-700 transition-colors"
                onClick={submitOverride}
                disabled={overrideReason.trim().length < 50 || !overrideAck}
              >
                Confirm override
              </button>
            </div>
          </div>
        </Modal>
      </div>
    </AppShell>
  );
}
