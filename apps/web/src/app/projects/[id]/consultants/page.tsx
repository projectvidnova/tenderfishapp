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
  not_ready: { label: "Not Ready", cls: "bg-amber-100 text-amber-700 border-amber-300" },
  ready: { label: "Invitation Ready ✓", cls: "bg-green-100 text-[#3F7A5A] border-green-300" },
  invited: { label: "Invited", cls: "bg-blue-100 text-blue-700 border-blue-300" },
  accepted: { label: "Accepted", cls: "bg-green-200 text-[#3F7A5A] border-green-400" },
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
        <div className="flex items-center justify-center h-64 text-gray-400 text-sm">Loading consultants…</div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-ink">Consultants</h1>
          <button className="btn-primary text-sm" onClick={() => setShowAdd(true)}>+ Add consultant discipline</button>
        </div>

        {!gateCOpen && (
          <div className="bg-amber-50 border border-amber-200 rounded-card px-4 py-3 text-sm text-amber-700">
            Gate C is not yet complete. Consultant invitations will be locked until Gate C is passed.
          </div>
        )}

        {/* Consultant cards */}
        {consultantList.length === 0 ? (
          <div className="card px-4 py-8 text-center text-gray-400 text-sm">
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
                    className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-cream/20 transition-colors"
                    onClick={() => setExpanded(isExpanded ? null : c.id)}
                  >
                    <div className="flex items-center gap-3">
                      <span className="font-semibold text-ink">{c.discipline}</span>
                      {c.company && <span className="text-xs text-gray-400">· {c.company}</span>}
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-mono text-bronze">{c.readinessPercent}%</span>
                      <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-sm border ${status.cls}`}>
                        {c.criteriaMet === c.criteriaTotal
                          ? status.label
                          : `Not Ready — ${missingCount} criteria missing`}
                      </span>
                      <svg className={`w-4 h-4 text-gray-400 transition-transform ${isExpanded ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </button>

                  {/* Expanded content */}
                  {isExpanded && (
                    <div className="border-t border-card-border px-4 py-4 space-y-4">
                      {/* Contact info */}
                      <div className="grid grid-cols-3 gap-3 text-sm">
                        <div>
                          <span className="text-gray-500 text-xs">Contact</span>
                          <p>{c.contactName || "—"}</p>
                        </div>
                        <div>
                          <span className="text-gray-500 text-xs">Company</span>
                          <p>{c.company || "—"}</p>
                        </div>
                        <div>
                          <span className="text-gray-500 text-xs">Email</span>
                          <p>{c.email || "—"}</p>
                        </div>
                      </div>

                      {/* 6-criteria readiness checklist */}
                      <div>
                        <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Readiness Checklist</h3>
                        <div className="space-y-2">
                          {c.readinessCriteria.map((criterion) => (
                            <label key={criterion.key} className="flex items-center gap-2 text-sm cursor-pointer">
                              <input
                                type="checkbox"
                                checked={criterion.met}
                                onChange={() => toggleCriterion(c, criterion.key)}
                                className="rounded border-gray-300 text-bronze focus:ring-bronze"
                              />
                              <span className={criterion.met ? "text-ink" : "text-gray-500"}>{criterion.label}</span>
                              {criterion.met ? (
                                <span className="ml-auto text-xs text-[#3F7A5A]">✓</span>
                              ) : (
                                <span className="ml-auto text-xs text-amber-500">Missing</span>
                              )}
                            </label>
                          ))}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-3 pt-2 border-t border-card-border">
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
                          className="text-xs text-red-500 hover:text-red-700"
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
              <div className="bg-amber-50 border border-amber-200 rounded-card px-4 py-3 text-sm text-amber-700">
                This person will see shared project modules. They will NOT see internal pricing or restricted modules.
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-gray-500 text-xs">Discipline</span>
                  <p>{showInvite.discipline}</p>
                </div>
                <div>
                  <span className="text-gray-500 text-xs">Email</span>
                  <p>{showInvite.email || "—"}</p>
                </div>
                <div>
                  <span className="text-gray-500 text-xs">Role</span>
                  <p>Consultant</p>
                </div>
                <div>
                  <span className="text-gray-500 text-xs">Access</span>
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
