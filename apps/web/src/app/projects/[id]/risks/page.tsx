"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import AppShell from "@/components/layout/AppShell";
import { Modal } from "@/components/ui/Modal";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

const CATEGORIES = [
  { value: "missing_information", label: "Missing Information" },
  { value: "deadline_risk", label: "Deadline Risk" },
  { value: "coordination_risk", label: "Coordination Risk" },
  { value: "approval_risk", label: "Approval Risk" },
  { value: "execution_risk", label: "Execution Risk" },
  { value: "communication_risk", label: "Communication Risk" },
  { value: "contract_interface_risk", label: "Contract Interface Risk" },
  { value: "external_authority", label: "External/Authority" },
];

const LEVELS = ["low", "medium", "high"] as const;

const RISK_STATUS_LABELS: Record<string, { label: string; cls: string }> = {
  open: { label: "Open", cls: "bg-status-danger-bg text-status-reject border-status-danger-border" },
  mitigated: { label: "Mitigated", cls: "bg-status-info-bg text-status-info-fg border-status-info-border" },
  closed: { label: "Closed", cls: "bg-bg-inset text-text-tertiary border-border" },
  accepted: { label: "Accepted", cls: "bg-status-warning-bg text-status-warning-fg border-status-warning-border" },
};

const SCORE_COLOR: Record<number, string> = {
  1: "bg-status-success-bg", 2: "bg-status-success-bg", 3: "bg-status-warning-bg",
  4: "bg-status-warning-bg", 6: "bg-status-danger-bg", 9: "bg-status-danger text-white",
};

type Risk = {
  id: string;
  name: string;
  category: string;
  description: string | null;
  probability: string;
  impact: string;
  ownerUserId: string | null;
  ownerName: string | null;
  status: string;
  mitigationAction: string | null;
  riskScore: number;
};

export default function RisksPage() {
  const { id } = useParams() as { id: string };
  const [riskList, setRiskList] = useState<Risk[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [showDetail, setShowDetail] = useState<Risk | null>(null);
  const [form, setForm] = useState({
    name: "", category: "missing_information", description: "",
    probability: "medium", impact: "medium", mitigationAction: "",
  });

  const fetchRisks = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/projects/${id}/risks`);
      if (res.ok) setRiskList((await res.json()).data);
    } catch { /* ignore */ }
    setLoading(false);
  }, [id]);

  useEffect(() => { fetchRisks(); }, [fetchRisks]);

  async function createRisk() {
    if (!form.name.trim()) return;
    await fetch(`${API}/api/projects/${id}/risks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setForm({ name: "", category: "missing_information", description: "", probability: "medium", impact: "medium", mitigationAction: "" });
    setShowAdd(false);
    fetchRisks();
  }

  async function updateRisk(riskId: string, updates: Partial<Risk>) {
    await fetch(`${API}/api/projects/${id}/risks/${riskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });
    setShowDetail(null);
    fetchRisks();
  }

  async function deleteRisk(riskId: string) {
    await fetch(`${API}/api/projects/${id}/risks/${riskId}`, { method: "DELETE" });
    setShowDetail(null);
    fetchRisks();
  }

  function scoreColor(score: number): string {
    return SCORE_COLOR[score] || "bg-bg-inset";
  }

  if (loading) {
    return (
      <AppShell>
        <div className="flex items-center justify-center h-64 text-text-quaternary text-sm">Loading risks…</div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-text-primary">Risk Register</h1>
          <button className="btn-primary text-sm" onClick={() => setShowAdd(true)}>+ Add risk</button>
        </div>

        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-bg-inset/30">
                <th className="text-left px-4 py-2 text-xs font-medium text-text-tertiary uppercase tracking-wide">Risk</th>
                <th className="text-left px-4 py-2 text-xs font-medium text-text-tertiary uppercase tracking-wide w-32">Category</th>
                <th className="text-center px-4 py-2 text-xs font-medium text-text-tertiary uppercase tracking-wide w-8">P</th>
                <th className="text-center px-4 py-2 text-xs font-medium text-text-tertiary uppercase tracking-wide w-8">I</th>
                <th className="text-center px-4 py-2 text-xs font-medium text-text-tertiary uppercase tracking-wide w-12">Score</th>
                <th className="text-left px-4 py-2 text-xs font-medium text-text-tertiary uppercase tracking-wide w-24">Owner</th>
                <th className="text-left px-4 py-2 text-xs font-medium text-text-tertiary uppercase tracking-wide w-24">Status</th>
                <th className="text-left px-4 py-2 text-xs font-medium text-text-tertiary uppercase tracking-wide w-16">Action</th>
              </tr>
            </thead>
            <tbody>
              {riskList.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-text-quaternary">No risks logged yet.</td></tr>
              ) : riskList.map((r) => {
                const st = RISK_STATUS_LABELS[r.status] || RISK_STATUS_LABELS.open;
                const catLabel = CATEGORIES.find((c) => c.value === r.category)?.label || r.category;
                return (
                  <tr key={r.id} className="border-b border-border last:border-0 hover:bg-bg-inset/20">
                    <td className="px-4 py-3 font-medium text-text-primary">{r.name}</td>
                    <td className="px-4 py-3 text-xs text-text-tertiary">{catLabel}</td>
                    <td className="px-4 py-3 text-center text-xs uppercase font-medium">{r.probability[0]}</td>
                    <td className="px-4 py-3 text-center text-xs uppercase font-medium">{r.impact[0]}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex items-center justify-center w-7 h-7 rounded-sm text-xs font-bold ${scoreColor(r.riskScore)}`}>
                        {r.riskScore}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-text-tertiary">{r.ownerName || "—"}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-sm border ${st.cls}`}>
                        {st.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button className="text-xs text-brand-orange hover:text-brand-orange-dark font-medium" onClick={() => setShowDetail(r)}>
                        Edit
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Add Risk Modal */}
        <Modal open={showAdd} onClose={() => setShowAdd(false)} title="Add Risk">
          <div className="space-y-4">
            <div>
              <label className="label">Risk Name *</label>
              <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <label className="label">Category *</label>
              <select className="input" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Description</label>
              <textarea className="input" rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Probability</label>
                <select className="input" value={form.probability} onChange={(e) => setForm({ ...form, probability: e.target.value })}>
                  {LEVELS.map((l) => <option key={l} value={l} className="capitalize">{l.charAt(0).toUpperCase() + l.slice(1)}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Impact</label>
                <select className="input" value={form.impact} onChange={(e) => setForm({ ...form, impact: e.target.value })}>
                  {LEVELS.map((l) => <option key={l} value={l}>{l.charAt(0).toUpperCase() + l.slice(1)}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="label">Mitigation Action</label>
              <textarea className="input" rows={2} value={form.mitigationAction} onChange={(e) => setForm({ ...form, mitigationAction: e.target.value })} />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button className="btn-secondary" onClick={() => setShowAdd(false)}>Cancel</button>
              <button className="btn-primary" onClick={createRisk} disabled={!form.name.trim()}>Add Risk</button>
            </div>
          </div>
        </Modal>

        {/* Detail / Edit Modal */}
        <Modal open={!!showDetail} onClose={() => setShowDetail(null)} title={showDetail?.name || ""} width="max-w-xl">
          {showDetail && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-text-tertiary text-xs">Category</span>
                  <p>{CATEGORIES.find((c) => c.value === showDetail.category)?.label || showDetail.category}</p>
                </div>
                <div>
                  <span className="text-text-tertiary text-xs">Owner</span>
                  <p>{showDetail.ownerName || "Unassigned"}</p>
                </div>
                <div>
                  <span className="text-text-tertiary text-xs">Probability</span>
                  <p className="capitalize">{showDetail.probability}</p>
                </div>
                <div>
                  <span className="text-text-tertiary text-xs">Impact</span>
                  <p className="capitalize">{showDetail.impact}</p>
                </div>
              </div>
              {showDetail.description && (
                <div className="text-sm">
                  <span className="text-text-tertiary text-xs">Description</span>
                  <p>{showDetail.description}</p>
                </div>
              )}
              {showDetail.mitigationAction && (
                <div className="text-sm">
                  <span className="text-text-tertiary text-xs">Mitigation Action</span>
                  <p>{showDetail.mitigationAction}</p>
                </div>
              )}
              <div>
                <h3 className="text-xs font-medium text-text-tertiary uppercase tracking-wide mb-2">Change Status</h3>
                <div className="flex flex-wrap gap-2">
                  {(["open", "mitigated", "closed", "accepted"] as const).filter((s) => s !== showDetail.status).map((s) => (
                    <button key={s} onClick={() => updateRisk(showDetail.id, { status: s })}
                      className={`text-xs px-2 py-1 border rounded-sm transition-colors ${RISK_STATUS_LABELS[s].cls}`}>
                      {RISK_STATUS_LABELS[s].label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex justify-end pt-2">
                <button className="text-xs text-status-danger hover:text-status-danger-fg" onClick={() => deleteRisk(showDetail.id)}>Delete risk</button>
              </div>
            </div>
          )}
        </Modal>
      </div>
    </AppShell>
  );
}
