"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import AppShell from "@/components/layout/AppShell";
import { DataStateChip } from "@/components/ui/DataStateChip";
import { Modal } from "@/components/ui/Modal";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

const LPH_META: Record<number, { name: string; nameDe: string }> = {
  1: { name: "Basic Evaluation", nameDe: "Grundlagenermittlung" },
  2: { name: "Preliminary Design", nameDe: "Vorplanung" },
  3: { name: "Design Development", nameDe: "Entwurfsplanung" },
  4: { name: "Approval Planning", nameDe: "Genehmigungsplanung" },
  5: { name: "Detailed Design", nameDe: "Ausführungsplanung" },
  6: { name: "Tender Preparation", nameDe: "Vorbereitung der Vergabe" },
  7: { name: "Tender & Award", nameDe: "Mitwirkung bei der Vergabe" },
  8: { name: "Construction Supervision", nameDe: "Objektüberwachung" },
  9: { name: "Project Closeout", nameDe: "Objektbetreuung" },
};

type Phase = {
  id: string;
  lph: number;
  status: string;
  startDate: string | null;
  endDate: string | null;
  dateDataState: string;
  objective: string;
  taskCounts: { total: number; complete: number; inProgress: number; notStarted: number };
  requiredOutputs: number;
  workPackages: number;
  decisions: number;
  documents: number;
};

type Task = {
  id: string;
  name: string;
  description: string | null;
  type: string;
  status: string;
  dueDate: string | null;
  ownerName: string | null;
  ownerUserId: string | null;
  reviewerName: string | null;
  approverName: string | null;
  evidenceRequired: boolean;
  dependencies: string[];
  decisionMaker: string | null;
  decisionStatus: string | null;
  decisionNotes: string | null;
  documentType: string | null;
  documentRequiredFor: string | null;
  documentFileRef: string | null;
};

const STATUS_DOT: Record<string, string> = {
  complete: "bg-status-success",
  active: "bg-brand-orange",
  not_started: "bg-border",
};

const TASK_STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  not_started: { label: "Not Started", cls: "text-text-quaternary bg-bg-bg-page border-border" },
  in_progress: { label: "In Progress", cls: "text-brand-orange bg-status-warning-light border-status-warning-border" },
  complete: { label: "Complete", cls: "text-status-success-fg bg-status-success-light border-green-200" },
};

const DECISION_STATUS: Record<string, { label: string; cls: string }> = {
  open: { label: "Open", cls: "text-status-info-fg bg-status-info-light border-blue-200" },
  decided: { label: "Decided", cls: "text-status-success-fg bg-status-success-light border-green-200" },
  overdue: { label: "Overdue", cls: "text-status-danger bg-status-danger-light border-status-danger-border" },
};

const INNER_TABS = ["Required Outputs", "Work Packages", "Required Decisions", "Required Documents", "Dependencies"] as const;
type InnerTab = typeof INNER_TABS[number];
const TAB_TYPE_MAP: Record<InnerTab, string> = {
  "Required Outputs": "required_output",
  "Work Packages": "work_package",
  "Required Decisions": "decision",
  "Required Documents": "document",
  "Dependencies": "dependency",
};

function StatusBadge({ status }: { status: string }) {
  const s = TASK_STATUS_LABEL[status] || TASK_STATUS_LABEL.not_started;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-sm border ${s.cls}`}>
      {s.label}
    </span>
  );
}

function DecisionBadge({ status }: { status: string }) {
  const s = DECISION_STATUS[status] || DECISION_STATUS.open;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-sm border ${s.cls}`}>
      {s.label}
    </span>
  );
}

export default function PhasesPage() {
  const { id } = useParams() as { id: string };
  const [phases, setPhases] = useState<Phase[]>([]);
  const [selectedLph, setSelectedLph] = useState(1);
  const [innerTab, setInnerTab] = useState<InnerTab>("Required Outputs");
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newTask, setNewTask] = useState({ name: "", description: "", dueDate: "", decisionMaker: "", documentType: "", documentRequiredFor: "" });
  const [overrideOpen, setOverrideOpen] = useState(false);
  const [overrideStatus, setOverrideStatus] = useState<"not_started" | "active" | "complete">("complete");
  const [overrideReason, setOverrideReason] = useState("");

  const selectedPhase = phases.find((p) => p.lph === selectedLph);

  const fetchPhases = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/projects/${id}/phases/detail`, { credentials: "include" });
      if (res.ok) {
        const json = await res.json();
        setPhases(json.data);
      }
    } catch { /* ignore */ }
  }, [id]);

  const fetchTasks = useCallback(async () => {
    try {
      const type = TAB_TYPE_MAP[innerTab];
      const res = await fetch(`${API}/api/projects/${id}/tasks?lph=${selectedLph}&type=${type}`, { credentials: "include" });
      if (res.ok) {
        const json = await res.json();
        setTasks(json.data);
      }
    } catch { /* ignore */ }
  }, [id, selectedLph, innerTab]);

  useEffect(() => {
    fetchPhases().then(() => setLoading(false));
  }, [fetchPhases]);

  useEffect(() => {
    if (!loading) fetchTasks();
  }, [fetchTasks, loading]);

  async function submitOverride() {
    if (!selectedPhase || overrideReason.trim().length < 10) return;
    setSaving(true);
    try {
      const res = await fetch(`${API}/api/projects/${id}/phases/${selectedLph}`, {
        credentials: "include",
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: overrideStatus,
          manualOverride: true,
          overrideReason: overrideReason.trim(),
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err?.message || err?.error || "Override failed");
      }
      await fetchPhases();
    } catch { /* ignore */ }
    setOverrideOpen(false);
    setOverrideReason("");
    setSaving(false);
  }

  async function updateTask(taskId: string, updates: Record<string, unknown>) {
    setSaving(true);
    try {
      await fetch(`${API}/api/projects/${id}/tasks/${taskId}`, {
        credentials: "include",
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      await fetchTasks();
    } catch { /* ignore */ }
    setSaving(false);
  }

  async function addTask() {
    if (!newTask.name.trim() || !selectedPhase) return;
    const type = TAB_TYPE_MAP[innerTab];
    const body: Record<string, unknown> = {
      lph: selectedLph,
      name: newTask.name.trim(),
      description: newTask.description || undefined,
      type,
      dueDate: newTask.dueDate || undefined,
    };
    if (type === "decision") body.decisionMaker = newTask.decisionMaker || undefined;
    if (type === "document") {
      body.documentType = newTask.documentType || undefined;
      body.documentRequiredFor = newTask.documentRequiredFor || undefined;
    }
    await fetch(`${API}/api/projects/${id}/tasks`, {
      credentials: "include",
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setNewTask({ name: "", description: "", dueDate: "", decisionMaker: "", documentType: "", documentRequiredFor: "" });
    setShowAddModal(false);
    fetchTasks();
  }

  async function deleteTask(taskId: string) {
    await fetch(`${API}/api/projects/${id}/tasks/${taskId}`, { method: "DELETE" , credentials: "include" });
    fetchTasks();
  }

  if (loading) {
    return (
      <AppShell>
        <div className="flex items-center justify-center h-64 text-text-quaternary text-sm">Loading phases…</div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="space-y-6">
        {/* ── Phase Navigator Strip ── */}
        <div className="flex gap-1 overflow-x-auto pb-2">
          {phases.map((phase) => {
            const meta = LPH_META[phase.lph];
            const isActive = phase.lph === selectedLph;
            return (
              <button
                key={phase.lph}
                onClick={() => { setSelectedLph(phase.lph); setInnerTab("Required Outputs"); }}
                className={`flex-shrink-0 flex items-center gap-2 px-4 py-3 rounded-xl border transition-all ${
                  isActive
                    ? "border-brand-orange bg-white shadow-sm"
                    : "border-transparent hover:bg-bg-inset"
                }`}
              >
                <span className={`w-2 h-2 rounded-full ${STATUS_DOT[phase.status] || STATUS_DOT.not_started}`} />
                <span className="font-mono text-xs text-text-tertiary">LPH {phase.lph}</span>
                <span className="text-sm font-medium text-text-primary whitespace-nowrap">{meta?.nameDe || `Phase ${phase.lph}`}</span>
              </button>
            );
          })}
        </div>

        {/* ── Phase Detail ── */}
        {selectedPhase && (
          <div className="space-y-4">
            {/* Phase Header */}
            <div className="card p-6 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <h1 className="text-xl font-semibold text-text-primary">
                    LPH {selectedPhase.lph} · {LPH_META[selectedPhase.lph]?.nameDe}
                  </h1>
                  <StatusBadge status={selectedPhase.status} />
                  {saving && <span className="text-xs text-text-quaternary animate-pulse">Saved</span>}
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[11px] text-text-quaternary leading-snug max-w-xs text-right">
                    Status is derived automatically from completed gates. Use override only as a last resort.
                  </span>
                  <button
                    type="button"
                    className="btn-secondary text-xs text-orange-600 border-orange-300 hover:bg-orange-50"
                    onClick={() => {
                      setOverrideStatus(
                        (selectedPhase.status as "not_started" | "active" | "complete") ?? "complete"
                      );
                      setOverrideReason("");
                      setOverrideOpen(true);
                    }}
                  >
                    Override status
                  </button>
                </div>
              </div>

              <p className="text-sm text-text-secondary">{selectedPhase.objective}</p>

              <div className="flex items-center gap-4 text-xs text-text-tertiary">
                <span className="font-mono">
                  {selectedPhase.startDate || "—"} → {selectedPhase.endDate || "—"}
                </span>
                {selectedPhase.dateDataState !== "CONFIRMED" && selectedPhase.startDate && (
                  <DataStateChip state={selectedPhase.dateDataState} />
                )}
                <span className="text-text-quaternary">|</span>
                <span>{selectedPhase.taskCounts.complete}/{selectedPhase.taskCounts.total} tasks complete</span>
              </div>

              {/* Compact progress bar */}
              {selectedPhase.taskCounts.total > 0 && (
                <div className="h-1.5 bg-bg-inset rounded-full overflow-hidden">
                  <div
                    className="h-full bg-brand-orange rounded-full transition-all"
                    style={{ width: `${(selectedPhase.taskCounts.complete / selectedPhase.taskCounts.total) * 100}%` }}
                  />
                </div>
              )}
            </div>

            {/* Inner Tabs */}
            <div className="flex items-center gap-1 border-b border-border">
              {INNER_TABS.map((tab) => (
                <button
                  key={tab}
                  onClick={() => setInnerTab(tab)}
                  className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                    innerTab === tab
                      ? "border-brand-orange text-text-primary"
                      : "border-transparent text-text-quaternary hover:text-text-secondary"
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>

            {/* Tab Content */}
            <div className="card overflow-hidden">
              {/* Add button */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-bg-inset/30">
                <span className="text-xs text-text-tertiary font-medium">{tasks.length} item{tasks.length !== 1 ? "s" : ""}</span>
                <button
                  onClick={() => setShowAddModal(true)}
                  className="text-xs font-medium text-brand-orange hover:text-brand-orange-dark transition-colors"
                >
                  + Add {innerTab === "Required Outputs" ? "output" : innerTab === "Work Packages" ? "work package" : innerTab === "Required Decisions" ? "decision" : innerTab === "Required Documents" ? "document" : "dependency"}
                </button>
              </div>

              {/* Required Outputs Table */}
              {innerTab === "Required Outputs" && (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-bg-inset/30">
                      <th className="text-left px-4 py-2 text-xs font-medium text-text-tertiary uppercase tracking-wide">Output</th>
                      <th className="text-left px-4 py-2 text-xs font-medium text-text-tertiary uppercase tracking-wide">Description</th>
                      <th className="text-left px-4 py-2 text-xs font-medium text-text-tertiary uppercase tracking-wide w-28">Status</th>
                      <th className="text-left px-4 py-2 text-xs font-medium text-text-tertiary uppercase tracking-wide w-32">Owner</th>
                      <th className="text-left px-4 py-2 text-xs font-medium text-text-tertiary uppercase tracking-wide w-28">Due</th>
                      <th className="w-10" />
                    </tr>
                  </thead>
                  <tbody>
                    {tasks.length === 0 ? (
                      <tr><td colSpan={6} className="px-4 py-8 text-center text-text-quaternary">No required outputs defined.</td></tr>
                    ) : tasks.map((t) => (
                      <tr key={t.id} className="border-b border-border last:border-0 hover:bg-bg-inset/20">
                        <td className="px-4 py-3 font-medium text-text-primary">{t.name}</td>
                        <td className="px-4 py-3 text-text-tertiary truncate max-w-[200px]">{t.description || "—"}</td>
                        <td className="px-4 py-3">
                          <select
                            value={t.status}
                            onChange={(e) => updateTask(t.id, { status: e.target.value })}
                            className="text-xs border border-border rounded-sm px-1.5 py-0.5 bg-white"
                          >
                            <option value="not_started">Not Started</option>
                            <option value="in_progress">In Progress</option>
                            <option value="complete">Complete</option>
                          </select>
                        </td>
                        <td className="px-4 py-3 text-text-tertiary text-xs">{t.ownerName || "—"}</td>
                        <td className="px-4 py-3 text-text-tertiary font-mono text-xs">{t.dueDate || "—"}</td>
                        <td className="px-2 py-3">
                          <button onClick={() => deleteTask(t.id)} className="text-text-quaternary hover:text-status-danger text-xs">×</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {/* Work Packages Table */}
              {innerTab === "Work Packages" && (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-bg-inset/30">
                      <th className="text-left px-4 py-2 text-xs font-medium text-text-tertiary uppercase tracking-wide">Work Package</th>
                      <th className="text-left px-4 py-2 text-xs font-medium text-text-tertiary uppercase tracking-wide w-24">Status</th>
                      <th className="text-left px-4 py-2 text-xs font-medium text-text-tertiary uppercase tracking-wide w-28">Owner</th>
                      <th className="text-left px-4 py-2 text-xs font-medium text-text-tertiary uppercase tracking-wide w-28">Reviewer</th>
                      <th className="text-left px-4 py-2 text-xs font-medium text-text-tertiary uppercase tracking-wide w-28">Approver</th>
                      <th className="text-left px-4 py-2 text-xs font-medium text-text-tertiary uppercase tracking-wide w-24">Due</th>
                      <th className="text-left px-4 py-2 text-xs font-medium text-text-tertiary uppercase tracking-wide w-16">Evidence</th>
                      <th className="w-10" />
                    </tr>
                  </thead>
                  <tbody>
                    {tasks.length === 0 ? (
                      <tr><td colSpan={8} className="px-4 py-8 text-center text-text-quaternary">No work packages defined.</td></tr>
                    ) : tasks.map((t) => (
                      <tr key={t.id} className="border-b border-border last:border-0 hover:bg-bg-inset/20">
                        <td className="px-4 py-3">
                          <div className="font-medium text-text-primary">{t.name}</div>
                          {t.description && <div className="text-xs text-text-quaternary mt-0.5 truncate max-w-[250px]">{t.description}</div>}
                        </td>
                        <td className="px-4 py-3">
                          <select
                            value={t.status}
                            onChange={(e) => updateTask(t.id, { status: e.target.value })}
                            className="text-xs border border-border rounded-sm px-1.5 py-0.5 bg-white"
                          >
                            <option value="not_started">Not Started</option>
                            <option value="in_progress">In Progress</option>
                            <option value="complete">Complete</option>
                          </select>
                        </td>
                        <td className="px-4 py-3 text-text-tertiary text-xs">{t.ownerName || "—"}</td>
                        <td className="px-4 py-3 text-text-tertiary text-xs">{t.reviewerName || "—"}</td>
                        <td className="px-4 py-3 text-text-tertiary text-xs">{t.approverName || "—"}</td>
                        <td className="px-4 py-3 text-text-tertiary font-mono text-xs">{t.dueDate || "—"}</td>
                        <td className="px-4 py-3 text-center">
                          <input
                            type="checkbox"
                            checked={t.evidenceRequired}
                            onChange={(e) => updateTask(t.id, { evidenceRequired: e.target.checked })}
                            className="accent-bronze"
                          />
                        </td>
                        <td className="px-2 py-3">
                          <button onClick={() => deleteTask(t.id)} className="text-text-quaternary hover:text-status-danger text-xs">×</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {/* Required Decisions Table */}
              {innerTab === "Required Decisions" && (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-bg-inset/30">
                      <th className="text-left px-4 py-2 text-xs font-medium text-text-tertiary uppercase tracking-wide">Decision</th>
                      <th className="text-left px-4 py-2 text-xs font-medium text-text-tertiary uppercase tracking-wide w-32">Decision Maker</th>
                      <th className="text-left px-4 py-2 text-xs font-medium text-text-tertiary uppercase tracking-wide w-24">By When</th>
                      <th className="text-left px-4 py-2 text-xs font-medium text-text-tertiary uppercase tracking-wide w-24">Status</th>
                      <th className="text-left px-4 py-2 text-xs font-medium text-text-tertiary uppercase tracking-wide">Notes</th>
                      <th className="w-10" />
                    </tr>
                  </thead>
                  <tbody>
                    {tasks.length === 0 ? (
                      <tr><td colSpan={6} className="px-4 py-8 text-center text-text-quaternary">No decisions required.</td></tr>
                    ) : tasks.map((t) => (
                      <tr key={t.id} className="border-b border-border last:border-0 hover:bg-bg-inset/20">
                        <td className="px-4 py-3 font-medium text-text-primary">{t.name}</td>
                        <td className="px-4 py-3 text-text-tertiary text-xs">{t.decisionMaker || "—"}</td>
                        <td className="px-4 py-3 text-text-tertiary font-mono text-xs">{t.dueDate || "—"}</td>
                        <td className="px-4 py-3">
                          <select
                            value={t.decisionStatus || "open"}
                            onChange={(e) => updateTask(t.id, { decisionStatus: e.target.value })}
                            className="text-xs border border-border rounded-sm px-1.5 py-0.5 bg-white"
                          >
                            <option value="open">Open</option>
                            <option value="decided">Decided</option>
                            <option value="overdue">Overdue</option>
                          </select>
                        </td>
                        <td className="px-4 py-3 text-text-quaternary text-xs truncate max-w-[200px]">{t.decisionNotes || "—"}</td>
                        <td className="px-2 py-3">
                          <button onClick={() => deleteTask(t.id)} className="text-text-quaternary hover:text-status-danger text-xs">×</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {/* Required Documents Table */}
              {innerTab === "Required Documents" && (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-bg-inset/30">
                      <th className="text-left px-4 py-2 text-xs font-medium text-text-tertiary uppercase tracking-wide">Document</th>
                      <th className="text-left px-4 py-2 text-xs font-medium text-text-tertiary uppercase tracking-wide w-28">Type</th>
                      <th className="text-left px-4 py-2 text-xs font-medium text-text-tertiary uppercase tracking-wide w-36">Required For</th>
                      <th className="text-left px-4 py-2 text-xs font-medium text-text-tertiary uppercase tracking-wide w-24">Status</th>
                      <th className="text-left px-4 py-2 text-xs font-medium text-text-tertiary uppercase tracking-wide w-20">Upload</th>
                      <th className="w-10" />
                    </tr>
                  </thead>
                  <tbody>
                    {tasks.length === 0 ? (
                      <tr><td colSpan={6} className="px-4 py-8 text-center text-text-quaternary">No documents required.</td></tr>
                    ) : tasks.map((t) => (
                      <tr key={t.id} className="border-b border-border last:border-0 hover:bg-bg-inset/20">
                        <td className="px-4 py-3 font-medium text-text-primary">{t.name}</td>
                        <td className="px-4 py-3 text-text-tertiary text-xs">{t.documentType || "—"}</td>
                        <td className="px-4 py-3 text-text-tertiary text-xs">{t.documentRequiredFor || "—"}</td>
                        <td className="px-4 py-3">
                          <select
                            value={t.status}
                            onChange={(e) => updateTask(t.id, { status: e.target.value })}
                            className="text-xs border border-border rounded-sm px-1.5 py-0.5 bg-white"
                          >
                            <option value="not_started">Not Started</option>
                            <option value="in_progress">In Progress</option>
                            <option value="complete">Complete</option>
                          </select>
                        </td>
                        <td className="px-4 py-3">
                          {t.documentFileRef ? (
                            <span className="text-xs text-status-success-fg">✓ Uploaded</span>
                          ) : (
                            <button className="text-xs text-brand-orange hover:text-brand-orange-dark font-medium">Upload</button>
                          )}
                        </td>
                        <td className="px-2 py-3">
                          <button onClick={() => deleteTask(t.id)} className="text-text-quaternary hover:text-status-danger text-xs">×</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {/* Dependencies Table */}
              {innerTab === "Dependencies" && (
                <div className="p-4 space-y-3">
                  {tasks.length === 0 ? (
                    <p className="text-center text-text-quaternary text-sm py-8">No dependencies from previous phase.</p>
                  ) : tasks.map((t) => (
                    <div
                      key={t.id}
                      className={`flex items-center justify-between p-3 rounded-xl border ${
                        t.status !== "complete" && selectedPhase?.status === "active"
                          ? "border-status-danger-border bg-status-danger-light/50"
                          : "border-border"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className={`w-2 h-2 rounded-full ${STATUS_DOT[t.status] || STATUS_DOT.not_started}`} />
                        <span className="text-sm text-text-primary">{t.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <StatusBadge status={t.status} />
                        {t.status !== "complete" && selectedPhase?.status === "active" && (
                          <span className="text-xs text-status-danger font-medium">⚠ Incomplete</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Add Task Modal */}
        <Modal open={showAddModal} onClose={() => setShowAddModal(false)} title={`Add ${innerTab.replace("Required ", "")}`}>
          <div className="space-y-4">
            <div>
              <label className="label">Name</label>
              <input
                className="input"
                value={newTask.name}
                onChange={(e) => setNewTask({ ...newTask, name: e.target.value })}
                placeholder={innerTab === "Required Outputs" ? "Output name…" : innerTab === "Work Packages" ? "Work package name…" : innerTab === "Required Decisions" ? "Decision description…" : "Document name…"}
              />
            </div>
            <div>
              <label className="label">Description</label>
              <textarea
                className="input"
                rows={2}
                value={newTask.description}
                onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
              />
            </div>
            <div>
              <label className="label">Due Date</label>
              <input
                type="date"
                className="input"
                value={newTask.dueDate}
                onChange={(e) => setNewTask({ ...newTask, dueDate: e.target.value })}
              />
            </div>
            {innerTab === "Required Decisions" && (
              <div>
                <label className="label">Decision Maker</label>
                <input
                  className="input"
                  value={newTask.decisionMaker}
                  onChange={(e) => setNewTask({ ...newTask, decisionMaker: e.target.value })}
                />
              </div>
            )}
            {innerTab === "Required Documents" && (
              <>
                <div>
                  <label className="label">Document Type</label>
                  <input
                    className="input"
                    value={newTask.documentType}
                    onChange={(e) => setNewTask({ ...newTask, documentType: e.target.value })}
                  />
                </div>
                <div>
                  <label className="label">Required For</label>
                  <input
                    className="input"
                    value={newTask.documentRequiredFor}
                    onChange={(e) => setNewTask({ ...newTask, documentRequiredFor: e.target.value })}
                  />
                </div>
              </>
            )}
            <div className="flex justify-end gap-3 pt-2">
              <button className="btn-secondary" onClick={() => setShowAddModal(false)}>Cancel</button>
              <button className="btn-primary" onClick={addTask} disabled={!newTask.name.trim()}>Add</button>
            </div>
          </div>
        </Modal>

        {/* Manual phase status override — last-resort fallback when gate-derived
            status doesn't reflect reality. Requires a written reason for audit. */}
        <Modal
          open={overrideOpen}
          onClose={() => setOverrideOpen(false)}
          title="Override phase status (last resort)"
          width="max-w-lg"
        >
          <div className="space-y-4 text-sm">
            <p className="text-text-secondary">
              Phase status is normally derived automatically from gate completions.
              Use this only when a gate-derived status is wrong and you need to
              correct it manually. The change is recorded with your reason.
            </p>
            <div>
              <label className="label">New status</label>
              <select
                className="input"
                value={overrideStatus}
                onChange={(e) => setOverrideStatus(e.target.value as typeof overrideStatus)}
              >
                <option value="not_started">Not Started</option>
                <option value="active">Active</option>
                <option value="complete">Complete</option>
              </select>
            </div>
            <div>
              <label className="label">Reason (required, min 10 chars)</label>
              <textarea
                className="input"
                rows={3}
                value={overrideReason}
                onChange={(e) => setOverrideReason(e.target.value)}
                placeholder="e.g. Client signed off this phase off-system on 2026-05-08"
              />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button className="btn-secondary" onClick={() => setOverrideOpen(false)}>
                Cancel
              </button>
              <button
                className="btn-primary text-orange-600 border-orange-300"
                onClick={submitOverride}
                disabled={overrideReason.trim().length < 10 || saving}
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
