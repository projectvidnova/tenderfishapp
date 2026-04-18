"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import AppShell from "@/components/layout/AppShell";
import { Modal } from "@/components/ui/Modal";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

type Criterion = { key: string; label: string; met: boolean };
type Consultant = {
  id: string;
  discipline: string;
  contactName: string | null;
  company: string | null;
  email: string | null;
  readinessCriteria: Criterion[];
  invitationStatus: string;
  invitedAt: string | null;
  readinessPercent: number;
  criteriaMet: number;
  criteriaTotal: number;
  canInvite: boolean;
  gateCOpen: boolean;
};

const INV_STATUS: Record<string, { label: string; cls: string }> = {
  not_ready: { label: "Not Ready", cls: "bg-status-warning-bg text-status-warning-fg border-status-warning-border" },
  ready: { label: "Invitation Ready ✓", cls: "bg-status-success-bg text-status-approve border-status-success-border" },
  invited: { label: "Invited", cls: "bg-status-info-bg text-status-info-fg border-status-info-border" },
  accepted: { label: "Accepted", cls: "bg-status-success-bg text-status-approve border-status-success-border" },
};

export default function ConsultantsPage() {
  const { id } = useParams() as { id: string };
  const [consultantList, setConsultantList] = useState<Consultant[]>([]);
  const [gateCOpen, setGateCOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [showInvite, setShowInvite] = useState<Consultant | null>(null);
  const [form, setForm] = useState({ discipline: "", contactName: "", company: "", email: "" });

  const fetchConsultants = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/projects/${id}/consultants`);
      if (res.ok) {
        const json = await res.json();
        setConsultantList(json.data);
        setGateCOpen(json.gateCOpen);
      }
    } catch { /* ignore */ }
    setLoading(false);
  }, [id]);

  useEffect(() => { fetchConsultants(); }, [fetchConsultants]);

  async function addConsultant() {
    if (!form.discipline.trim()) return;
    await fetch(`${API}/api/projects/${id}/consultants`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setForm({ discipline: "", contactName: "", company: "", email: "" });
    setShowAdd(false);
    fetchConsultants();
  }

  async function toggleCriterion(consultant: Consultant, criterionKey: string) {
    const updated = consultant.readinessCriteria.map((c) =>
      c.key === criterionKey ? { ...c, met: !c.met } : c
    );
    await fetch(`${API}/api/projects/${id}/consultants/${consultant.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ readinessCriteria: updated }),
    });
    fetchConsultants();
  }

  async function inviteConsultant(consultantId: string) {
    await fetch(`${API}/api/projects/${id}/consultants/${consultantId}/invite`, {
      method: "POST",
    });
    setShowInvite(null);
    fetchConsultants();
  }

  async function deleteConsultant(consultantId: string) {
    await fetch(`${API}/api/projects/${id}/consultants/${consultantId}`, { method: "DELETE" });
    fetchConsultants();
  }

  if (loading) {
    return (
      <AppShell>
        <div className="flex items-center justify-center h-64 text-text-quaternary text-sm">Loading consultants…</div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-text-primary">Consultants</h1>
          <button className="btn-primary text-sm" onClick={() => setShowAdd(true)}>+ Add consultant discipline</button>
        </div>

        {!gateCOpen && (
          <div className="bg-status-warning-light border border-status-warning-border rounded-xl px-4 py-3 text-sm text-status-warning-fg">
            Gate C is not yet complete. Consultant invitations will be locked until Gate C is passed.
          </div>
        )}

        {/* Consultant cards */}
        {consultantList.length === 0 ? (
          <div className="card px-4 py-8 text-center text-text-quaternary text-sm">
            No consultant disciplines added yet.
          </div>
        ) : (
          <div className="space-y-3">
            {consultantList.map((c) => {
              const isExpanded = expanded === c.id;
              const status = INV_STATUS[c.invitationStatus] || INV_STATUS.not_ready;
              const missingCount = c.criteriaTotal - c.criteriaMet;
              return (
                <div key={c.id} className="card overflow-hidden">
                  {/* Header */}
                  <button
                    className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-bg-inset/20 transition-colors"
                    onClick={() => setExpanded(isExpanded ? null : c.id)}
                  >
                    <div className="flex items-center gap-3">
                      <span className="font-semibold text-text-primary">{c.discipline}</span>
                      {c.company && <span className="text-xs text-text-quaternary">· {c.company}</span>}
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-mono text-brand-orange">{c.readinessPercent}%</span>
                      <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-sm border ${status.cls}`}>
                        {c.criteriaMet === c.criteriaTotal
                          ? status.label
                          : `Not Ready — ${missingCount} criteria missing`}
                      </span>
                      <svg className={`w-4 h-4 text-text-quaternary transition-transform ${isExpanded ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </button>

                  {/* Expanded content */}
                  {isExpanded && (
                    <div className="border-t border-border px-4 py-4 space-y-4">
                      {/* Contact info */}
                      <div className="grid grid-cols-3 gap-3 text-sm">
                        <div>
                          <span className="text-text-tertiary text-xs">Contact</span>
                          <p>{c.contactName || "—"}</p>
                        </div>
                        <div>
                          <span className="text-text-tertiary text-xs">Company</span>
                          <p>{c.company || "—"}</p>
                        </div>
                        <div>
                          <span className="text-text-tertiary text-xs">Email</span>
                          <p>{c.email || "—"}</p>
                        </div>
                      </div>

                      {/* 6-criteria readiness checklist */}
                      <div>
                        <h3 className="text-xs font-medium text-text-tertiary uppercase tracking-wide mb-2">Readiness Checklist</h3>
                        <div className="space-y-2">
                          {c.readinessCriteria.map((criterion) => (
                            <label key={criterion.key} className="flex items-center gap-2 text-sm cursor-pointer">
                              <input
                                type="checkbox"
                                checked={criterion.met}
                                onChange={() => toggleCriterion(c, criterion.key)}
                                className="rounded border-border text-brand-orange focus:ring-brand-orange"
                              />
                              <span className={criterion.met ? "text-text-primary" : "text-text-tertiary"}>{criterion.label}</span>
                              {criterion.met ? (
                                <span className="ml-auto text-xs text-status-approve">✓</span>
                              ) : (
                                <span className="ml-auto text-xs text-status-warning">Missing</span>
                              )}
                            </label>
                          ))}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-3 pt-2 border-t border-border">
                        {c.canInvite && c.invitationStatus !== "invited" && c.invitationStatus !== "accepted" ? (
                          <button
                            className="btn-primary text-sm"
                            onClick={() => setShowInvite(c)}
                          >
                            Invite {c.discipline}
                          </button>
                        ) : (
                          <button
                            className="btn-primary text-sm opacity-50 cursor-not-allowed"
                            disabled
                            title={!c.gateCOpen ? "Gate C not yet open" : "Not all criteria met"}
                          >
                            Invite {c.discipline}
                          </button>
                        )}
                        <button
                          className="text-xs text-status-danger hover:text-status-danger-fg"
                          onClick={() => deleteConsultant(c.id)}
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Add Consultant Modal */}
        <Modal open={showAdd} onClose={() => setShowAdd(false)} title="Add Consultant Discipline">
          <div className="space-y-4">
            <div>
              <label className="label">Discipline *</label>
              <input className="input" value={form.discipline} onChange={(e) => setForm({ ...form, discipline: e.target.value })} placeholder="e.g. Structural Engineering" />
            </div>
            <div>
              <label className="label">Contact Name</label>
              <input className="input" value={form.contactName} onChange={(e) => setForm({ ...form, contactName: e.target.value })} />
            </div>
            <div>
              <label className="label">Company</label>
              <input className="input" value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} />
            </div>
            <div>
              <label className="label">Email</label>
              <input className="input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button className="btn-secondary" onClick={() => setShowAdd(false)}>Cancel</button>
              <button className="btn-primary" onClick={addConsultant} disabled={!form.discipline.trim()}>Add</button>
            </div>
          </div>
        </Modal>

        {/* Invite Modal */}
        <Modal open={!!showInvite} onClose={() => setShowInvite(null)} title={showInvite ? `Invite ${showInvite.discipline}` : ""}>
          {showInvite && (
            <div className="space-y-4">
              <div className="bg-status-warning-light border border-status-warning-border rounded-xl px-4 py-3 text-sm text-status-warning-fg">
                This person will see shared project modules. They will NOT see internal pricing or restricted modules.
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-text-tertiary text-xs">Discipline</span>
                  <p>{showInvite.discipline}</p>
                </div>
                <div>
                  <span className="text-text-tertiary text-xs">Email</span>
                  <p>{showInvite.email || "—"}</p>
                </div>
                <div>
                  <span className="text-text-tertiary text-xs">Role</span>
                  <p>Consultant</p>
                </div>
                <div>
                  <span className="text-text-tertiary text-xs">Access</span>
                  <p>Project-specific only</p>
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button className="btn-secondary" onClick={() => setShowInvite(null)}>Cancel</button>
                <button className="btn-primary" onClick={() => inviteConsultant(showInvite.id)}>Send Invitation</button>
              </div>
            </div>
          )}
        </Modal>
      </div>
    </AppShell>
  );
}
