"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import AppShell from "@/components/layout/AppShell";
import { Modal } from "@/components/ui/Modal";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

const CAUSE_CATEGORIES = [
  { value: "client_delay", label: "Client Delay" },
  { value: "missing_approval", label: "Missing Approval" },
  { value: "design_change", label: "Design Change" },
  { value: "missing_information", label: "Missing Information" },
  { value: "consultant_delay", label: "Consultant Delay" },
  { value: "contractor_delay", label: "Contractor Delay" },
  { value: "site_condition", label: "Site Condition" },
  { value: "authority_issue", label: "Authority Issue" },
  { value: "logistics_issue", label: "Logistics Issue" },
  { value: "unknown", label: "Unknown" },
];

const STATUS_LABELS: Record<string, { label: string; cls: string }> = {
  open: { label: "Open", cls: "bg-status-danger-bg text-status-reject border-status-danger-border" },
  under_review: { label: "Under Review", cls: "bg-status-warning-bg text-status-warning-fg border-status-warning-border" },
  resolved: { label: "Resolved", cls: "bg-status-success-bg text-status-approve border-status-success-border" },
  escalated: { label: "Escalated", cls: "bg-status-purple-bg text-status-purple-fg border-status-purple-border" },
};

type DelayEvent = {
  id: string;
  eventDate: string;
  reportedBy: string;
  description: string;
  causeCategory: string;
  affectedTasks: string[];
  scheduleImpactDays: number;
  initialResponsibility: string | null;
  status: string;
  createdAt: string;
};

type Summary = {
  totalEvents: number;
  totalImpactDays: number;
  byCause: Record<string, number>;
  byStatus: Record<string, number>;
};

export default function DelaysPage() {
  const { id } = useParams() as { id: string };
  const [delays, setDelays] = useState<DelayEvent[]>([]);
  const [summary, setSummary] = useState<Summary>({ totalEvents: 0, totalImpactDays: 0, byCause: {}, byStatus: {} });
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [showDetail, setShowDetail] = useState<DelayEvent | null>(null);
  const [form, setForm] = useState({
    eventDate: "", reportedBy: "", description: "", causeCategory: "unknown",
    scheduleImpactDays: 0, initialResponsibility: "",
  });

  const fetchDelays = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/projects/${id}/delays`);
      if (res.ok) {
        const json = await res.json();
        setDelays(json.data);
        setSummary(json.summary);
      }
    } catch { /* ignore */ }
    setLoading(false);
  }, [id]);

  useEffect(() => { fetchDelays(); }, [fetchDelays]);

  async function createDelay() {
    if (!form.eventDate || !form.reportedBy || !form.description) return;
    await fetch(`${API}/api/projects/${id}/delays`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setForm({ eventDate: "", reportedBy: "", description: "", causeCategory: "unknown", scheduleImpactDays: 0, initialResponsibility: "" });
    setShowAdd(false);
    fetchDelays();
  }

  async function updateDelay(delayId: string, updates: Record<string, unknown>) {
    await fetch(`${API}/api/projects/${id}/delays/${delayId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });
    setShowDetail(null);
    fetchDelays();
  }

  if (loading) {
    return (
      <AppShell>
        <div className="flex items-center justify-center h-64 text-text-quaternary text-sm">Loading delays…</div>
      </AppShell>
    );
  }

  const maxCause = Math.max(...Object.values(summary.byCause), 1);

  return (
    <AppShell>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-text-primary">Delay Log</h1>
          <button className="btn-primary text-sm" onClick={() => setShowAdd(true)}>+ Log delay event</button>
        </div>

        {/* Warning banner */}
        <div className="bg-status-warning-light border border-status-warning-border rounded-xl px-4 py-3 text-sm text-status-warning-fg">
          This module is a structured evidence and consequence tracker. It does not determine or record legal liability.
        </div>

        {/* Summary panel */}
        {summary.totalEvents > 0 && (
          <div className="grid grid-cols-4 gap-3">
            <div className="card px-4 py-3">
              <p className="text-xs text-text-tertiary">Total Events</p>
              <p className="text-2xl font-bold font-mono text-text-primary">{summary.totalEvents}</p>
            </div>
            <div className="card px-4 py-3">
              <p className="text-xs text-text-tertiary">Total Impact</p>
              <p className="text-2xl font-bold font-mono text-text-primary">{summary.totalImpactDays} <span className="text-sm font-normal">days</span></p>
            </div>
            <div className="card px-4 py-3 col-span-2">
              <p className="text-xs text-text-tertiary mb-2">By Cause</p>
              <div className="space-y-1">
                {Object.entries(summary.byCause).map(([cause, count]) => (
                  <div key={cause} className="flex items-center gap-2">
                    <span className="text-xs text-text-tertiary w-24 truncate">{CAUSE_CATEGORIES.find((c) => c.value === cause)?.label || cause}</span>
                    <div className="flex-1 h-3 bg-bg-inset rounded-sm overflow-hidden">
                      <div className="h-full bg-brand-orange/60 rounded-sm" style={{ width: `${(count / maxCause) * 100}%` }} />
                    </div>
                    <span className="text-xs font-mono w-5 text-right">{count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Delay table */}
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-bg-inset/30">
                <th className="text-left px-4 py-2 text-xs font-medium text-text-tertiary uppercase tracking-wide w-24">Date</th>
                <th className="text-left px-4 py-2 text-xs font-medium text-text-tertiary uppercase tracking-wide">Description</th>
                <th className="text-left px-4 py-2 text-xs font-medium text-text-tertiary uppercase tracking-wide w-28">Cause</th>
                <th className="text-center px-4 py-2 text-xs font-medium text-text-tertiary uppercase tracking-wide w-16">Impact</th>
                <th className="text-left px-4 py-2 text-xs font-medium text-text-tertiary uppercase tracking-wide w-24">Owner</th>
                <th className="text-left px-4 py-2 text-xs font-medium text-text-tertiary uppercase tracking-wide w-24">Status</th>
                <th className="text-left px-4 py-2 text-xs font-medium text-text-tertiary uppercase tracking-wide w-16">Action</th>
              </tr>
            </thead>
            <tbody>
              {delays.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-text-quaternary">No delay events logged.</td></tr>
              ) : delays.map((d) => {
                const st = STATUS_LABELS[d.status] || STATUS_LABELS.open;
                const causeLabel = CAUSE_CATEGORIES.find((c) => c.value === d.causeCategory)?.label || d.causeCategory;
                return (
                  <tr key={d.id} className="border-b border-border last:border-0 hover:bg-bg-inset/20">
                    <td className="px-4 py-3 text-xs font-mono text-text-tertiary">{d.eventDate}</td>
                    <td className="px-4 py-3 text-text-primary">{d.description}</td>
                    <td className="px-4 py-3 text-xs text-text-tertiary">{causeLabel}</td>
                    <td className="px-4 py-3 text-center text-xs font-mono font-medium">{d.scheduleImpactDays}d</td>
                    <td className="px-4 py-3 text-xs text-text-tertiary">{d.initialResponsibility || "—"}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-sm border ${st.cls}`}>
                        {st.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button className="text-xs text-brand-orange hover:text-brand-orange-dark font-medium" onClick={() => setShowDetail(d)}>
                        View
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Add Delay Modal */}
        <Modal open={showAdd} onClose={() => setShowAdd(false)} title="Log Delay Event">
          <div className="space-y-4">
            <div>
              <label className="label">Event Date *</label>
              <input type="date" className="input" value={form.eventDate} onChange={(e) => setForm({ ...form, eventDate: e.target.value })} />
            </div>
            <div>
              <label className="label">Reported By *</label>
              <input className="input" value={form.reportedBy} onChange={(e) => setForm({ ...form, reportedBy: e.target.value })} />
            </div>
            <div>
              <label className="label">Description *</label>
              <textarea className="input" rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <div>
              <label className="label">Cause Category</label>
              <select className="input" value={form.causeCategory} onChange={(e) => setForm({ ...form, causeCategory: e.target.value })}>
                {CAUSE_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Schedule Impact (days)</label>
                <input type="number" className="input" value={form.scheduleImpactDays} onChange={(e) => setForm({ ...form, scheduleImpactDays: parseInt(e.target.value) || 0 })} />
              </div>
              <div>
                <label className="label">Initial Responsibility</label>
                <input className="input" value={form.initialResponsibility} onChange={(e) => setForm({ ...form, initialResponsibility: e.target.value })} />
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button className="btn-secondary" onClick={() => setShowAdd(false)}>Cancel</button>
              <button className="btn-primary" onClick={createDelay} disabled={!form.eventDate || !form.reportedBy || !form.description}>Log Event</button>
            </div>
          </div>
        </Modal>

        {/* Detail Modal */}
        <Modal open={!!showDetail} onClose={() => setShowDetail(null)} title="Delay Event" width="max-w-xl">
          {showDetail && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-text-tertiary text-xs">Event Date</span>
                  <p className="font-mono">{showDetail.eventDate}</p>
                </div>
                <div>
                  <span className="text-text-tertiary text-xs">Reported By</span>
                  <p>{showDetail.reportedBy}</p>
                </div>
                <div>
                  <span className="text-text-tertiary text-xs">Cause</span>
                  <p>{CAUSE_CATEGORIES.find((c) => c.value === showDetail.causeCategory)?.label || showDetail.causeCategory}</p>
                </div>
                <div>
                  <span className="text-text-tertiary text-xs">Schedule Impact</span>
                  <p className="font-mono">{showDetail.scheduleImpactDays} working days</p>
                </div>
              </div>
              <div className="text-sm">
                <span className="text-text-tertiary text-xs">Description</span>
                <p>{showDetail.description}</p>
              </div>
              {showDetail.initialResponsibility && (
                <div className="text-sm">
                  <span className="text-text-tertiary text-xs">Initial Responsibility</span>
                  <p>{showDetail.initialResponsibility}</p>
                </div>
              )}
              <div>
                <h3 className="text-xs font-medium text-text-tertiary uppercase tracking-wide mb-2">Change Status</h3>
                <div className="flex flex-wrap gap-2">
                  {(["open", "under_review", "resolved", "escalated"] as const).filter((s) => s !== showDetail.status).map((s) => (
                    <button key={s} onClick={() => updateDelay(showDetail.id, { status: s })}
                      className={`text-xs px-2 py-1 border rounded-sm transition-colors ${STATUS_LABELS[s].cls}`}>
                      {STATUS_LABELS[s].label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </Modal>
      </div>
    </AppShell>
  );
}
