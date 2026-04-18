"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useParams } from "next/navigation";
import AppShell from "@/components/layout/AppShell";
import { DataStateChip } from "@/components/ui/DataStateChip";
import { Modal } from "@/components/ui/Modal";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

type Phase = {
  id: string;
  lph: number;
  status: string;
  startDate: string | null;
  endDate: string | null;
  dateDataState: string;
  objective: string;
};

type Milestone = {
  id: string;
  name: string;
  date: string;
  type: string;
  status: string;
  dataState: string;
  relatedGate: string | null;
  relatedPhaseId: string | null;
  phaseLph: number | null;
  ownerUserId: string | null;
};

const LPH_NAMES: Record<number, string> = {
  1: "Grundlagenermittlung",
  2: "Vorplanung",
  3: "Entwurfsplanung",
  4: "Genehmigungsplanung",
  5: "Ausführungsplanung",
  6: "Vorbereitung der Vergabe",
  7: "Mitwirkung bei der Vergabe",
  8: "Objektüberwachung",
  9: "Objektbetreuung",
};

const STATUS_BAR_COLORS: Record<string, string> = {
  active: "#0D2B1A",      // on track dark green
  not_started: "#ECE8E1", // future/derived
  complete: "#0D2B1A",    // on track
};

const MILESTONE_TYPE_LABELS: Record<string, string> = {
  client_decision: "Client Decision",
  approval: "Approval",
  phase_gate: "Phase Gate",
  authority: "Authority",
  handover: "Handover",
};

type ViewMode = "gantt" | "milestones" | "summary";

export default function SchedulePage() {
  const { id } = useParams() as { id: string };
  const [view, setView] = useState<ViewMode>("gantt");
  const [phases, setPhases] = useState<Phase[]>([]);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newMilestone, setNewMilestone] = useState({ name: "", date: "", type: "phase_gate", relatedGate: "" });

  const fetchData = useCallback(async () => {
    try {
      const [pRes, mRes] = await Promise.all([
        fetch(`${API}/api/projects/${id}/phases`),
        fetch(`${API}/api/projects/${id}/milestones`),
      ]);
      if (pRes.ok) setPhases((await pRes.json()).data);
      if (mRes.ok) setMilestones((await mRes.json()).data);
    } catch { /* ignore */ }
    setLoading(false);
  }, [id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const hasDerivedDates = phases.some((p) => p.startDate && p.dateDataState !== "CONFIRMED") ||
    milestones.some((m) => m.dataState !== "CONFIRMED");

  // Compute date range for Gantt
  const { months, minDate, totalDays } = useMemo(() => {
    const dates: number[] = [];
    phases.forEach((p) => {
      if (p.startDate) dates.push(new Date(p.startDate).getTime());
      if (p.endDate) dates.push(new Date(p.endDate).getTime());
    });
    milestones.forEach((m) => dates.push(new Date(m.date).getTime()));
    dates.push(Date.now());

    if (dates.length === 0) return { months: [] as { label: string; start: Date; days: number }[], minDate: new Date(), totalDays: 1 };

    const min = new Date(Math.min(...dates));
    const max = new Date(Math.max(...dates));
    // Extend range by 1 month on each side
    min.setMonth(min.getMonth() - 1);
    min.setDate(1);
    max.setMonth(max.getMonth() + 2);
    max.setDate(0);

    const total = Math.max(1, Math.ceil((max.getTime() - min.getTime()) / (1000 * 60 * 60 * 24)));

    const ms: { label: string; start: Date; days: number }[] = [];
    const cursor = new Date(min);
    while (cursor < max) {
      const monthStart = new Date(cursor);
      const nextMonth = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
      const daysInMonth = Math.ceil((Math.min(nextMonth.getTime(), max.getTime()) - cursor.getTime()) / (1000 * 60 * 60 * 24));
      ms.push({
        label: cursor.toLocaleString("en", { month: "short", year: "2-digit" }),
        start: monthStart,
        days: daysInMonth,
      });
      cursor.setMonth(cursor.getMonth() + 1);
      cursor.setDate(1);
    }

    return { months: ms, minDate: min, totalDays: total };
  }, [phases, milestones]);

  function dayOffset(dateStr: string): number {
    const d = new Date(dateStr);
    return Math.max(0, Math.ceil((d.getTime() - minDate.getTime()) / (1000 * 60 * 60 * 24)));
  }

  function todayOffset(): number {
    return Math.max(0, Math.ceil((Date.now() - minDate.getTime()) / (1000 * 60 * 60 * 24)));
  }

  async function addMilestone() {
    if (!newMilestone.name.trim() || !newMilestone.date) return;
    await fetch(`${API}/api/projects/${id}/milestones`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: newMilestone.name.trim(),
        date: newMilestone.date,
        type: newMilestone.type,
        relatedGate: newMilestone.relatedGate || undefined,
      }),
    });
    setNewMilestone({ name: "", date: "", type: "phase_gate", relatedGate: "" });
    setShowAddModal(false);
    fetchData();
  }

  async function deleteMilestone(milestoneId: string) {
    await fetch(`${API}/api/projects/${id}/milestones/${milestoneId}`, { method: "DELETE" });
    fetchData();
  }

  if (loading) {
    return (
      <AppShell>
        <div className="flex items-center justify-center h-64 text-text-quaternary text-sm">Loading schedule…</div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-text-primary">Schedule</h1>
          <div className="flex items-center gap-3">
            {/* View toggle */}
            <div className="flex border border-border rounded-xl overflow-hidden">
              {(["gantt", "milestones", "summary"] as ViewMode[]).map((v) => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                    view === v ? "bg-ink text-white" : "bg-white text-text-tertiary hover:bg-bg-inset"
                  }`}
                >
                  {v === "gantt" ? "Gantt" : v === "milestones" ? "Milestone List" : "Phase Summary"}
                </button>
              ))}
            </div>
            <button className="btn-primary text-sm" onClick={() => setShowAddModal(true)}>+ Add milestone</button>
          </div>
        </div>

        {/* Derived dates banner */}
        {hasDerivedDates && (
          <div className="bg-status-warning-light border border-status-warning-border rounded-xl px-4 py-3 text-sm text-status-warning-fg">
            Some dates are estimated by back-scheduling from target completion. Items marked DERIVED should be confirmed when possible.
          </div>
        )}

        {/* ── Gantt View ── */}
        {view === "gantt" && (
          <div className="card overflow-x-auto">
            {phases.length === 0 && milestones.length === 0 ? (
              <div className="p-8 text-center text-text-quaternary text-sm">
                No schedule data yet. Phases and milestones will appear once project is set up.
              </div>
            ) : (
              <div className="min-w-[800px]">
                {/* Month headers */}
                <div className="flex border-b border-border">
                  <div className="w-48 flex-shrink-0 px-4 py-2 text-xs font-medium text-text-tertiary uppercase tracking-wide border-r border-border">
                    Item
                  </div>
                  <div className="flex-1 flex relative">
                    {months.map((m, i) => (
                      <div
                        key={i}
                        className="text-xs text-text-quaternary font-mono px-2 py-2 border-r border-border/50 text-center"
                        style={{ width: `${(m.days / totalDays) * 100}%` }}
                      >
                        {m.label}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Phase rows */}
                {phases.map((phase) => {
                  const start = phase.startDate ? dayOffset(phase.startDate) : 0;
                  const end = phase.endDate ? dayOffset(phase.endDate) : start + 30;
                  const width = Math.max(end - start, 2);
                  const isDerived = phase.dateDataState !== "CONFIRMED";

                  return (
                    <div key={phase.id} className="flex border-b border-border/50 hover:bg-bg-inset/20 group">
                      <div className="w-48 flex-shrink-0 px-4 py-3 flex items-center gap-2 border-r border-border">
                        <span className="font-mono text-xs text-text-quaternary">LPH {phase.lph}</span>
                        <span className="text-sm text-text-primary truncate">{LPH_NAMES[phase.lph]}</span>
                      </div>
                      <div className="flex-1 relative py-2 px-1">
                        {phase.startDate && (
                          <div
                            className="absolute top-1/2 -translate-y-1/2 h-6 rounded-sm flex items-center px-2 text-xs text-white font-medium truncate"
                            style={{
                              left: `${(start / totalDays) * 100}%`,
                              width: `${(width / totalDays) * 100}%`,
                              backgroundColor: STATUS_BAR_COLORS[phase.status] || STATUS_BAR_COLORS.not_started,
                              border: isDerived ? "1px dashed #B7792E" : "none",
                            }}
                            title={`LPH ${phase.lph}: ${phase.startDate} → ${phase.endDate || "?"} (${phase.status})`}
                          >
                            {isDerived && <span className="opacity-60 mr-1">?</span>}
                          </div>
                        )}
                        {!phase.startDate && (
                          <div className="flex items-center h-full px-2">
                            <span className="text-xs text-text-quaternary italic">No dates</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}

                {/* Milestone rows */}
                {milestones.map((m) => {
                  const offset = dayOffset(m.date);
                  const isConfirmed = m.dataState === "CONFIRMED";

                  return (
                    <div key={m.id} className="flex border-b border-border/50 hover:bg-bg-inset/20">
                      <div className="w-48 flex-shrink-0 px-4 py-3 flex items-center gap-2 border-r border-border">
                        <span className="text-sm text-text-primary truncate">{m.name}</span>
                      </div>
                      <div className="flex-1 relative py-2 px-1">
                        <div
                          className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rotate-45"
                          style={{
                            left: `${(offset / totalDays) * 100}%`,
                            backgroundColor: isConfirmed ? "#B7792E" : "#9CA3AF",
                          }}
                          title={`${m.name}: ${m.date} (${m.dataState})`}
                        />
                      </div>
                    </div>
                  );
                })}

                {/* Today line (overlay) */}
                <div
                  className="absolute top-0 bottom-0 w-px bg-brand-orange z-10 pointer-events-none"
                  style={{ left: `calc(192px + ${(todayOffset() / totalDays) * (100)}% * (100% - 192px) / 100%)` }}
                />
              </div>
            )}
          </div>
        )}

        {/* ── Milestone List View ── */}
        {view === "milestones" && (
          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-bg-inset/30">
                  <th className="text-left px-4 py-2 text-xs font-medium text-text-tertiary uppercase tracking-wide w-28">Date</th>
                  <th className="text-left px-4 py-2 text-xs font-medium text-text-tertiary uppercase tracking-wide">Milestone</th>
                  <th className="text-left px-4 py-2 text-xs font-medium text-text-tertiary uppercase tracking-wide w-24">Phase</th>
                  <th className="text-left px-4 py-2 text-xs font-medium text-text-tertiary uppercase tracking-wide w-24">Type</th>
                  <th className="text-left px-4 py-2 text-xs font-medium text-text-tertiary uppercase tracking-wide w-20">Data</th>
                  <th className="text-left px-4 py-2 text-xs font-medium text-text-tertiary uppercase tracking-wide w-20">Gate</th>
                  <th className="text-left px-4 py-2 text-xs font-medium text-text-tertiary uppercase tracking-wide w-24">Status</th>
                  <th className="w-10" />
                </tr>
              </thead>
              <tbody>
                {milestones.length === 0 ? (
                  <tr><td colSpan={8} className="px-4 py-8 text-center text-text-quaternary">No milestones yet.</td></tr>
                ) : milestones.map((m) => (
                  <tr key={m.id} className="border-b border-border last:border-0 hover:bg-bg-inset/20">
                    <td className="px-4 py-3 font-mono text-xs text-text-secondary">{m.date}</td>
                    <td className="px-4 py-3 font-medium text-text-primary">{m.name}</td>
                    <td className="px-4 py-3 text-xs text-text-tertiary">{m.phaseLph ? `LPH ${m.phaseLph}` : "—"}</td>
                    <td className="px-4 py-3 text-xs text-text-tertiary">{MILESTONE_TYPE_LABELS[m.type] || m.type}</td>
                    <td className="px-4 py-3"><DataStateChip state={m.dataState} /></td>
                    <td className="px-4 py-3 text-xs font-mono text-text-tertiary">{m.relatedGate ? `Gate ${m.relatedGate}` : "—"}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-sm border ${
                        m.status === "complete" ? "text-status-success-fg bg-status-success-light border-green-200" :
                        m.status === "in_progress" ? "text-brand-orange bg-status-warning-light border-status-warning-border" :
                        "text-text-quaternary bg-bg-bg-page border-border"
                      }`}>
                        {m.status === "not_started" ? "Pending" : m.status === "in_progress" ? "In Progress" : "Complete"}
                      </span>
                    </td>
                    <td className="px-2 py-3">
                      <button onClick={() => deleteMilestone(m.id)} className="text-text-quaternary hover:text-status-danger text-xs">×</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ── Phase Summary View ── */}
        {view === "summary" && (
          <div className="space-y-3">
            {phases.map((p) => (
              <div key={p.id} className="card p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-sm text-text-quaternary">LPH {p.lph}</span>
                    <span className="text-sm font-medium text-text-primary">{LPH_NAMES[p.lph]}</span>
                    <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-sm border ${
                      p.status === "complete" ? "text-status-success-fg bg-status-success-light border-green-200" :
                      p.status === "active" ? "text-brand-orange bg-status-warning-light border-status-warning-border" :
                      "text-text-quaternary bg-bg-bg-page border-border"
                    }`}>
                      {p.status === "not_started" ? "Not Started" : p.status === "active" ? "Active" : "Complete"}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-text-tertiary font-mono">
                    {p.startDate && <span>{p.startDate}</span>}
                    {p.startDate && p.endDate && <span>→</span>}
                    {p.endDate && <span>{p.endDate}</span>}
                    {p.startDate && p.dateDataState !== "CONFIRMED" && <DataStateChip state={p.dateDataState} />}
                    {!p.startDate && <span className="text-text-quaternary">No dates set</span>}
                  </div>
                </div>
                <p className="text-xs text-text-tertiary mt-2">{p.objective}</p>
              </div>
            ))}
          </div>
        )}

        {/* Add Milestone Modal */}
        <Modal open={showAddModal} onClose={() => setShowAddModal(false)} title="Add Milestone">
          <div className="space-y-4">
            <div>
              <label className="label">Name</label>
              <input
                className="input"
                value={newMilestone.name}
                onChange={(e) => setNewMilestone({ ...newMilestone, name: e.target.value })}
                placeholder="Milestone name…"
              />
            </div>
            <div>
              <label className="label">Date</label>
              <input
                type="date"
                className="input"
                value={newMilestone.date}
                onChange={(e) => setNewMilestone({ ...newMilestone, date: e.target.value })}
              />
            </div>
            <div>
              <label className="label">Type</label>
              <select
                className="input"
                value={newMilestone.type}
                onChange={(e) => setNewMilestone({ ...newMilestone, type: e.target.value })}
              >
                <option value="client_decision">Client Decision</option>
                <option value="approval">Approval</option>
                <option value="phase_gate">Phase Gate</option>
                <option value="authority">Authority</option>
                <option value="handover">Handover</option>
              </select>
            </div>
            <div>
              <label className="label">Related Gate (optional)</label>
              <select
                className="input"
                value={newMilestone.relatedGate}
                onChange={(e) => setNewMilestone({ ...newMilestone, relatedGate: e.target.value })}
              >
                <option value="">None</option>
                {["A", "B", "C", "D", "E", "F"].map((g) => (
                  <option key={g} value={g}>Gate {g}</option>
                ))}
              </select>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button className="btn-secondary" onClick={() => setShowAddModal(false)}>Cancel</button>
              <button className="btn-primary" onClick={addMilestone} disabled={!newMilestone.name.trim() || !newMilestone.date}>Add</button>
            </div>
          </div>
        </Modal>
      </div>
    </AppShell>
  );
}
