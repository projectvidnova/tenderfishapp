"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import AppShell from "@/components/layout/AppShell";
import { Modal } from "@/components/ui/Modal";
import { formatDate } from "@/lib/formatters";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

const PROJECT_ROLES = [
  "architect_admin",
  "project_lead",
  "team_member",
  "client",
  "client_representative",
  "consultant",
  "reviewer",
  "approver",
  "document_controller",
  "bidder",
  "general_contractor",
  "trade_contractor",
];

const ROLE_LABELS: Record<string, string> = {
  architect_admin: "Architect Admin",
  project_lead: "Project Lead",
  team_member: "Team Member",
  client: "Client",
  client_representative: "Client Representative",
  consultant: "Consultant",
  reviewer: "Reviewer",
  approver: "Approver",
  document_controller: "Document Controller",
  bidder: "Bidder",
  general_contractor: "General Contractor",
  trade_contractor: "Trade Contractor",
};

const STATUS_STYLE: Record<string, { label: string; cls: string }> = {
  pending: { label: "Pending", cls: "bg-status-warning-bg text-status-warning-fg" },
  accepted: { label: "Accepted", cls: "bg-status-emerald-bg text-status-emerald-fg" },
  expired: { label: "Expired", cls: "bg-bg-inset text-text-tertiary" },
  revoked: { label: "Revoked", cls: "bg-status-danger-bg text-status-reject" },
};

interface Invitation {
  id: string;
  email: string;
  role: string;
  status: string;
  invitedByName: string | null;
  gateAtInvitation: string | null;
  expiresAt: string;
  acceptedAt: string | null;
  createdAt: string;
}

export default function InvitationsPage() {
  const { id } = useParams() as { id: string };
  const [tab, setTab] = useState<"team" | "invitations">("team");
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInvite, setShowInvite] = useState(false);
  const [form, setForm] = useState({ email: "", role: "team_member", message: "" });

  const fetchInvitations = useCallback(async () => {
    const res = await fetch(`${API}/api/projects/${id}/invitations`, { credentials: "include" });
    const json = await res.json();
    setInvitations(json.data || []);
    setLoading(false);
  }, [id]);

  useEffect(() => { fetchInvitations(); }, [fetchInvitations]);

  async function sendInvitation() {
    if (!form.email.trim()) return;
    await fetch(`${API}/api/projects/${id}/invitations`, {
      credentials: "include",
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setForm({ email: "", role: "team_member", message: "" });
    setShowInvite(false);
    fetchInvitations();
  }

  async function revokeInvitation(invId: string) {
    await fetch(`${API}/api/projects/${id}/invitations/${invId}`, { method: "DELETE" , credentials: "include" });
    fetchInvitations();
  }

  const pending = invitations.filter((i) => i.status === "pending");
  const accepted = invitations.filter((i) => i.status === "accepted");

  if (loading) return <AppShell><div className="p-8 text-text-quaternary">Loading…</div></AppShell>;

  return (
    <AppShell>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-text-primary">Team & Invitations</h1>
          <button onClick={() => setShowInvite(true)} className="btn-primary text-sm">+ Invite</button>
        </div>

        {/* Tab toggle */}
        <div className="flex gap-4 border-b border-border">
          {(["team", "invitations"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`pb-2 text-sm font-medium capitalize ${tab === t ? "text-brand-orange border-b-2 border-brand-orange" : "text-text-quaternary hover:text-text-secondary"}`}
            >
              {t === "team" ? `Team (${accepted.length})` : `Invitations (${pending.length})`}
            </button>
          ))}
        </div>

        {/* Team tab */}
        {tab === "team" && (
          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-bg-inset/50">
                  <th className="text-left px-4 py-3 text-xs font-medium text-text-tertiary uppercase">Email</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-text-tertiary uppercase">Role</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-text-tertiary uppercase">Joined</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-text-tertiary uppercase">Invited By</th>
                </tr>
              </thead>
              <tbody>
                {accepted.length === 0 ? (
                  <tr><td colSpan={4} className="px-4 py-8 text-center text-text-quaternary">No team members yet.</td></tr>
                ) : (
                  accepted.map((inv) => (
                    <tr key={inv.id} className="border-b border-border/40">
                      <td className="px-4 py-3 text-xs">{inv.email}</td>
                      <td className="px-4 py-3 text-xs">{ROLE_LABELS[inv.role] || inv.role}</td>
                      <td className="px-4 py-3 text-xs">{inv.acceptedAt ? formatDate(inv.acceptedAt) : "—"}</td>
                      <td className="px-4 py-3 text-xs">{inv.invitedByName || "—"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Invitations tab */}
        {tab === "invitations" && (
          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-bg-inset/50">
                  <th className="text-left px-4 py-3 text-xs font-medium text-text-tertiary uppercase">Email</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-text-tertiary uppercase">Role</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-text-tertiary uppercase">Invited By</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-text-tertiary uppercase">Invited On</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-text-tertiary uppercase">Expires</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-text-tertiary uppercase">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-text-tertiary uppercase">Actions</th>
                </tr>
              </thead>
              <tbody>
                {invitations.length === 0 ? (
                  <tr><td colSpan={7} className="px-4 py-8 text-center text-text-quaternary">No invitations sent yet.</td></tr>
                ) : (
                  invitations.map((inv) => (
                    <tr key={inv.id} className="border-b border-border/40">
                      <td className="px-4 py-3 text-xs">{inv.email}</td>
                      <td className="px-4 py-3 text-xs">{ROLE_LABELS[inv.role] || inv.role}</td>
                      <td className="px-4 py-3 text-xs">{inv.invitedByName || "—"}</td>
                      <td className="px-4 py-3 text-xs">{formatDate(inv.createdAt)}</td>
                      <td className="px-4 py-3 text-xs">{formatDate(inv.expiresAt)}</td>
                      <td className="px-4 py-3">
                        <span className={`text-[10px] px-2 py-0.5 rounded ${STATUS_STYLE[inv.status]?.cls || "bg-bg-inset"}`}>
                          {STATUS_STYLE[inv.status]?.label || inv.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {inv.status === "pending" && (
                          <div className="flex gap-1">
                            <button
                              onClick={() => sendInvitation()} // Resend = same flow
                              className="text-[10px] text-status-info-fg hover:underline"
                            >
                              Resend
                            </button>
                            <button
                              onClick={() => revokeInvitation(inv.id)}
                              className="text-[10px] text-status-reject hover:underline"
                            >
                              Revoke
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Invite Modal */}
      <Modal open={showInvite} onClose={() => setShowInvite(false)} title="Send Invitation">
        <div className="space-y-3 text-sm">
          <div>
            <label className="text-xs text-text-tertiary">Email address *</label>
            <input
              className="input mt-1 w-full"
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="colleague@studio.de"
            />
          </div>
          <div>
            <label className="text-xs text-text-tertiary">Role</label>
            <select className="input mt-1 w-full" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
              {PROJECT_ROLES.map((r) => (
                <option key={r} value={r}>{ROLE_LABELS[r]}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-text-tertiary">Message (optional)</label>
            <textarea
              className="input mt-1 w-full"
              rows={3}
              value={form.message}
              onChange={(e) => setForm({ ...form, message: e.target.value })}
              placeholder="Optional personal message…"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={() => setShowInvite(false)} className="btn-secondary text-sm">Cancel</button>
            <button onClick={sendInvitation} className="btn-primary text-sm" disabled={!form.email.trim()}>
              Send Invitation
            </button>
          </div>
        </div>
      </Modal>
    </AppShell>
  );
}
