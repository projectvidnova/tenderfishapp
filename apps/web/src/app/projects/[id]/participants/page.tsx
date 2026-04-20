"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import AppShell from "@/components/layout/AppShell";
import { Modal } from "@/components/ui/Modal";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

const STATUS_LABELS: Record<string, { label: string; cls: string }> = {
  pending: { label: "Pending", cls: "bg-status-warning-bg text-status-warning-fg" },
  confirmed: { label: "Confirmed", cls: "bg-status-success-bg text-status-approve" },
  inactive: { label: "Inactive", cls: "bg-bg-inset text-text-tertiary" },
};

const ROLE_OPTIONS = [
  "Client",
  "Client Representative",
  "Architect Lead",
  "Project Lead",
  "Team Member",
  "Structural Engineer",
  "MEP Consultant",
  "Landscape Architect",
  "Contractor",
  "Site Manager",
  "Other",
];

type Participant = {
  id: string;
  name: string;
  role: string;
  company: string | null;
  contactEmail: string | null;
  roleConfirmed: boolean;
  confirmedBy: string | null;
  confirmedAt: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
};

export default function ParticipantsPage() {
  const { id } = useParams() as { id: string };
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", role: "Team Member", company: "", contactEmail: "" });

  const fetchParticipants = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/projects/${id}/participants`, {
        credentials: "include",
      });
      if (res.ok) {
        const json = await res.json();
        setParticipants(json.data || []);
      }
    } catch { /* ignore */ }
    setLoading(false);
  }, [id]);

  useEffect(() => { fetchParticipants(); }, [fetchParticipants]);

  async function create() {
    const res = await fetch(`${API}/api/projects/${id}/participants`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        name: form.name,
        role: form.role,
        company: form.company || null,
        contactEmail: form.contactEmail || null,
      }),
    });
    if (res.ok) { setShowAdd(false); fetchParticipants(); resetForm(); }
  }

  async function update() {
    if (!editingId) return;
    const res = await fetch(`${API}/api/projects/${id}/participants/${editingId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        name: form.name,
        role: form.role,
        company: form.company || null,
        contactEmail: form.contactEmail || null,
      }),
    });
    if (res.ok) { setEditingId(null); fetchParticipants(); resetForm(); }
  }

  async function confirmRole(participantId: string) {
    await fetch(`${API}/api/projects/${id}/participants/${participantId}/confirm`, {
      method: "POST",
      credentials: "include",
    });
    fetchParticipants();
  }

  async function remove(participantId: string) {
    await fetch(`${API}/api/projects/${id}/participants/${participantId}`, {
      method: "DELETE",
      credentials: "include",
    });
    fetchParticipants();
  }

  function resetForm() {
    setForm({ name: "", role: "Team Member", company: "", contactEmail: "" });
  }

  function startEdit(p: Participant) {
    setForm({ name: p.name, role: p.role, company: p.company || "", contactEmail: p.contactEmail || "" });
    setEditingId(p.id);
  }

  const confirmed = participants.filter((p) => p.status === "confirmed");
  const pending = participants.filter((p) => p.status === "pending");

  if (loading) return <AppShell><div className="p-8 text-text-quaternary">Loading…</div></AppShell>;

  return (
    <AppShell>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Participants</h1>
            <p className="text-sm text-text-tertiary mt-1">Project team members and role assignments</p>
          </div>
          <button className="btn-primary" onClick={() => { resetForm(); setShowAdd(true); }}>+ Add Participant</button>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-3 gap-3">
          <div className="card p-4 text-center">
            <p className="text-2xl font-semibold">{participants.length}</p>
            <p className="text-xs text-text-tertiary mt-1">Total</p>
          </div>
          <div className="card p-4 text-center">
            <p className="text-2xl font-semibold text-status-approve">{confirmed.length}</p>
            <p className="text-xs text-text-tertiary mt-1">Confirmed</p>
          </div>
          <div className="card p-4 text-center">
            <p className="text-2xl font-semibold text-status-warning">{pending.length}</p>
            <p className="text-xs text-text-tertiary mt-1">Pending</p>
          </div>
        </div>

        {/* Table */}
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-bg-inset/30">
                <th className="text-left px-4 py-2 text-xs font-medium text-text-tertiary uppercase">Name</th>
                <th className="text-left px-4 py-2 text-xs font-medium text-text-tertiary uppercase">Role</th>
                <th className="text-left px-4 py-2 text-xs font-medium text-text-tertiary uppercase">Company</th>
                <th className="text-left px-4 py-2 text-xs font-medium text-text-tertiary uppercase">Email</th>
                <th className="text-left px-4 py-2 text-xs font-medium text-text-tertiary uppercase">Status</th>
                <th className="text-left px-4 py-2 text-xs font-medium text-text-tertiary uppercase">Actions</th>
              </tr>
            </thead>
            <tbody>
              {participants.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-text-quaternary">No participants added yet.</td></tr>
              ) : participants.map((p) => (
                <tr key={p.id} className="border-b border-border last:border-0 hover:bg-bg-inset/20">
                  <td className="px-4 py-3 font-medium">{p.name}</td>
                  <td className="px-4 py-3 text-text-secondary">{p.role}</td>
                  <td className="px-4 py-3 text-text-secondary">{p.company || "—"}</td>
                  <td className="px-4 py-3 text-text-tertiary text-xs">{p.contactEmail || "—"}</td>
                  <td className="px-4 py-3">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${STATUS_LABELS[p.status]?.cls || "bg-bg-inset text-text-tertiary"}`}>
                      {STATUS_LABELS[p.status]?.label || p.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 flex gap-2">
                    <button className="text-xs text-brand-orange hover:text-brand-orange-hover font-medium" onClick={() => startEdit(p)}>Edit</button>
                    {p.status === "pending" && (
                      <button className="text-xs text-status-approve hover:opacity-80 font-medium" onClick={() => confirmRole(p.id)}>Confirm</button>
                    )}
                    <button className="text-xs text-status-danger hover:opacity-80" onClick={() => remove(p.id)}>Remove</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Add / Edit Modal */}
        <Modal open={showAdd || !!editingId} onClose={() => { setShowAdd(false); setEditingId(null); resetForm(); }} title={editingId ? "Edit Participant" : "Add Participant"}>
          <div className="space-y-4">
            <div>
              <label className="label">Name *</label>
              <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Full name" />
            </div>
            <div>
              <label className="label">Role *</label>
              <select className="input" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                {ROLE_OPTIONS.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Company</label>
              <input className="input" value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} placeholder="Organisation name" />
            </div>
            <div>
              <label className="label">Contact Email</label>
              <input type="email" className="input" value={form.contactEmail} onChange={(e) => setForm({ ...form, contactEmail: e.target.value })} placeholder="email@example.com" />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button className="btn-secondary" onClick={() => { setShowAdd(false); setEditingId(null); resetForm(); }}>Cancel</button>
              <button className="btn-primary" onClick={editingId ? update : create} disabled={!form.name.trim()}>
                {editingId ? "Update" : "Add"}
              </button>
            </div>
          </div>
        </Modal>
      </div>
    </AppShell>
  );
}
