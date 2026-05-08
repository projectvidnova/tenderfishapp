"use client";

import { useEffect, useState, useCallback } from "react";
import AppShell from "@/components/layout/AppShell";
import { formatDate, formatDateTime } from "@/lib/formatters";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

type Tab = "workspace" | "team" | "notifications" | "gates" | "integrations" | "audit" | "billing" | "data";

const TABS: { key: Tab; label: string }[] = [
  { key: "workspace", label: "Workspace" },
  { key: "team", label: "Team" },
  { key: "notifications", label: "Notifications" },
  { key: "gates", label: "Gate Rules" },
  { key: "integrations", label: "Integrations" },
  { key: "audit", label: "Audit Log" },
  { key: "billing", label: "Billing" },
  { key: "data", label: "Data & Privacy" },
];

const NOTIFICATION_EVENTS = [
  { key: "gate_blocked", label: "Gate blocked" },
  { key: "approval_overdue", label: "Approval overdue" },
  { key: "approval_requested", label: "Approval requested" },
  { key: "consultant_invitation_ready", label: "Consultant invitation ready" },
  { key: "tender_package_ready", label: "Tender package ready" },
  { key: "gate_override", label: "Gate override" },
  { key: "review_submission_received", label: "Review submission received" },
  { key: "review_overdue", label: "Review overdue" },
  { key: "inbox_unreviewed", label: "Inbox unreviewed" },
  { key: "general", label: "General" },
];

const GATES = ["A", "B", "C", "D", "E", "F"];

const ROLE_LABELS: Record<string, string> = {
  owner: "Owner",
  admin: "Admin",
  member: "Member",
};

interface Workspace {
  id: string;
  name: string;
  slug: string;
  plan: string;
  createdAt: string;
}

interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: string;
  createdAt: string;
}

interface AuditEntry {
  id: string;
  userName: string;
  projectName: string | null;
  action: string;
  entityType: string;
  entityId: string;
  beforeState: Record<string, unknown> | null;
  afterState: Record<string, unknown> | null;
  createdAt: string;
}

export default function SettingsPage() {
  const [tab, setTab] = useState<Tab>("workspace");
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [wsName, setWsName] = useState("");
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditEntry[]>([]);
  const [expandedLog, setExpandedLog] = useState<string | null>(null);

  /* Notification prefs — local state (would persist to API in prod) */
  const [notifPrefs, setNotifPrefs] = useState<Record<string, { email: boolean; inApp: boolean }>>(
    Object.fromEntries(NOTIFICATION_EVENTS.map((e) => [e.key, { email: true, inApp: true }]))
  );

  /* Gate rules — local state */
  const [gateRules, setGateRules] = useState<Record<string, string>>(
    Object.fromEntries(GATES.map((g) => [g, "architect_admin_only"]))
  );

  const fetchWorkspace = useCallback(async () => {
    const res = await fetch(`${API}/api/settings/workspace`, { credentials: "include" });
    const json = await res.json();
    if (json.data) { setWorkspace(json.data); setWsName(json.data.name); }
  }, []);

  const fetchTeam = useCallback(async () => {
    const res = await fetch(`${API}/api/settings/team`, { credentials: "include" });
    const json = await res.json();
    setTeam(json.data || []);
  }, []);

  const fetchAudit = useCallback(async () => {
    const res = await fetch(`${API}/api/settings/audit-log`, { credentials: "include" });
    const json = await res.json();
    setAuditLogs(json.data || []);
  }, []);

  useEffect(() => {
    fetchWorkspace();
    fetchTeam();
  }, [fetchWorkspace, fetchTeam]);

  useEffect(() => {
    if (tab === "audit") fetchAudit();
  }, [tab, fetchAudit]);

  async function saveWorkspace() {
    await fetch(`${API}/api/settings/workspace`, {
      credentials: "include",
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: wsName }),
    });
    fetchWorkspace();
  }

  return (
    <AppShell>
      <div className="max-w-5xl mx-auto space-y-6">
        <h1 className="text-2xl font-semibold text-text-primary">Settings</h1>

        {/* Tab navigation */}
        <div className="flex gap-1 overflow-x-auto border-b border-border">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-3 py-2 text-xs font-medium whitespace-nowrap transition-colors ${tab === t.key ? "text-brand-orange border-b-2 border-brand-orange" : "text-text-quaternary hover:text-text-secondary"}`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* ── Workspace ── */}
        {tab === "workspace" && workspace && (
          <div className="card p-6 space-y-4">
            <h2 className="text-sm font-medium text-text-tertiary uppercase tracking-wide">Workspace</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-text-tertiary">Workspace name</label>
                <input className="input mt-1 w-full" value={wsName} onChange={(e) => setWsName(e.target.value)} />
              </div>
              <div>
                <label className="text-xs text-text-tertiary">Slug</label>
                <input className="input mt-1 w-full" value={workspace.slug} disabled />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-text-tertiary">Workspace inbox address</label>
                <div className="flex gap-2 mt-1">
                  <input className="input flex-1" value={`${workspace.slug}@inbox.tenderfish.ai`} readOnly />
                  <button onClick={() => navigator.clipboard.writeText(`${workspace.slug}@inbox.tenderfish.ai`)} className="btn-secondary text-xs">Copy</button>
                </div>
              </div>
              <div>
                <label className="text-xs text-text-tertiary">Plan</label>
                <input className="input mt-1 w-full capitalize" value={workspace.plan} disabled />
              </div>
            </div>
            <div className="flex justify-end pt-2">
              <button onClick={saveWorkspace} className="btn-primary text-sm">Save changes</button>
            </div>
          </div>
        )}

        {/* ── Team ── */}
        {tab === "team" && (
          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-bg-inset/50">
                  <th className="text-left px-4 py-3 text-xs font-medium text-text-tertiary uppercase">Name</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-text-tertiary uppercase">Email</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-text-tertiary uppercase">Role</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-text-tertiary uppercase">Joined</th>
                </tr>
              </thead>
              <tbody>
                {team.length === 0 ? (
                  <tr><td colSpan={4} className="px-4 py-8 text-center text-text-quaternary">No team members.</td></tr>
                ) : (
                  team.map((m) => (
                    <tr key={m.id} className="border-b border-border/40">
                      <td className="px-4 py-3 text-xs font-medium">{m.name || "—"}</td>
                      <td className="px-4 py-3 text-xs">{m.email}</td>
                      <td className="px-4 py-3 text-xs capitalize">{ROLE_LABELS[m.role] || m.role}</td>
                      <td className="px-4 py-3 text-xs">{formatDate(m.createdAt)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* ── Notifications ── */}
        {tab === "notifications" && (
          <div className="card p-6 space-y-4">
            <h2 className="text-sm font-medium text-text-tertiary uppercase tracking-wide">Notification Preferences</h2>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left px-2 py-2 text-xs text-text-quaternary">Event</th>
                  <th className="text-center px-2 py-2 text-xs text-text-quaternary">Email</th>
                  <th className="text-center px-2 py-2 text-xs text-text-quaternary">In-App</th>
                </tr>
              </thead>
              <tbody>
                {NOTIFICATION_EVENTS.map((e) => (
                  <tr key={e.key} className="border-b border-border/40">
                    <td className="px-2 py-2 text-xs">{e.label}</td>
                    <td className="px-2 py-2 text-center">
                      <input
                        type="checkbox"
                        checked={notifPrefs[e.key]?.email ?? true}
                        onChange={() => setNotifPrefs((p) => ({ ...p, [e.key]: { ...p[e.key], email: !p[e.key].email } }))}
                        className="accent-bronze"
                      />
                    </td>
                    <td className="px-2 py-2 text-center">
                      <input
                        type="checkbox"
                        checked={notifPrefs[e.key]?.inApp ?? true}
                        onChange={() => setNotifPrefs((p) => ({ ...p, [e.key]: { ...p[e.key], inApp: !p[e.key].inApp } }))}
                        className="accent-bronze"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="flex justify-end">
              <button className="btn-primary text-sm">Save preferences</button>
            </div>
          </div>
        )}

        {/* ── Gate Rules ── */}
        {tab === "gates" && (
          <div className="card p-6 space-y-4">
            <h2 className="text-sm font-medium text-text-tertiary uppercase tracking-wide">Gate Override Rules</h2>
            <p className="text-xs text-text-quaternary">Configure who can override each gate in projects.</p>
            <div className="space-y-3">
              {GATES.map((g) => (
                <div key={g} className="flex items-center gap-4">
                  <span className="text-sm font-semibold text-text-primary w-20">Gate {g}</span>
                  <select
                    className="input text-xs flex-1 max-w-xs"
                    value={gateRules[g]}
                    onChange={(e) => setGateRules((p) => ({ ...p, [g]: e.target.value }))}
                  >
                    <option value="architect_admin_only">Architect Admin only</option>
                    <option value="any_lead_with_reason">Any Project Lead with reason</option>
                  </select>
                </div>
              ))}
            </div>
            <div className="flex justify-end">
              <button className="btn-primary text-sm">Save rules</button>
            </div>
          </div>
        )}

        {/* ── Integrations ── */}
        {tab === "integrations" && (
          <div className="space-y-4">
            <div className="card p-6 space-y-3">
              <h3 className="text-sm font-medium text-text-primary">GAEB Exchange</h3>
              <p className="text-xs text-text-quaternary">Import cost estimation data via GAEB file format.</p>
              <button className="btn-secondary text-xs">Configure</button>
            </div>
            <div className="card p-6 space-y-3">
              <h3 className="text-sm font-medium text-text-primary">Excel/CSV Import</h3>
              <p className="text-xs text-text-quaternary">Import project data via spreadsheet.</p>
              <button className="btn-secondary text-xs">Download template</button>
            </div>
            <div className="card p-6 space-y-3">
              <h3 className="text-sm font-medium text-text-primary">Workspace Inbox</h3>
              <p className="text-xs text-text-quaternary">Forward project emails to your workspace inbox.</p>
              <div className="flex gap-2">
                <input className="input text-xs flex-1" value={workspace ? `${workspace.slug}@inbox.tenderfish.ai` : "…"} readOnly />
                <button className="btn-secondary text-xs">Copy</button>
              </div>
            </div>
            <div className="card p-6 space-y-3 opacity-50">
              <h3 className="text-sm font-medium text-text-primary">Coming Soon</h3>
              <div className="flex gap-2 flex-wrap">
                {["Gmail", "Outlook", "Procore", "DATEV"].map((s) => (
                  <span key={s} className="text-[10px] bg-bg-inset text-text-quaternary rounded px-2 py-1">{s}</span>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── Audit Log ── */}
        {tab === "audit" && (
          <div className="space-y-3">
            <div className="flex justify-end">
              <button className="btn-secondary text-xs">Export CSV</button>
            </div>
            <div className="card overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-bg-inset/50">
                    <th className="text-left px-4 py-3 text-xs font-medium text-text-tertiary uppercase">Timestamp</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-text-tertiary uppercase">User</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-text-tertiary uppercase">Action</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-text-tertiary uppercase">Entity</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-text-tertiary uppercase">Project</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-text-tertiary uppercase">Details</th>
                  </tr>
                </thead>
                <tbody>
                  {auditLogs.length === 0 ? (
                    <tr><td colSpan={6} className="px-4 py-8 text-center text-text-quaternary">No audit entries yet.</td></tr>
                  ) : (
                    auditLogs.map((log) => (
                      <>
                        <tr key={log.id} className="border-b border-border/40 hover:bg-bg-inset/30">
                          <td className="px-4 py-3 text-xs">{formatDateTime(log.createdAt)}</td>
                          <td className="px-4 py-3 text-xs">{log.userName}</td>
                          <td className="px-4 py-3 text-xs font-medium">{log.action}</td>
                          <td className="px-4 py-3 text-xs">{log.entityType}</td>
                          <td className="px-4 py-3 text-xs">{log.projectName || "—"}</td>
                          <td className="px-4 py-3">
                            <button
                              onClick={() => setExpandedLog(expandedLog === log.id ? null : log.id)}
                              className="text-[10px] text-brand-orange hover:underline"
                            >
                              {expandedLog === log.id ? "Hide" : "Show"}
                            </button>
                          </td>
                        </tr>
                        {expandedLog === log.id && (
                          <tr key={`${log.id}-detail`}>
                            <td colSpan={6} className="px-4 py-3 bg-bg-inset/20">
                              <div className="grid grid-cols-2 gap-4 text-xs">
                                <div>
                                  <p className="text-text-quaternary mb-1">Before</p>
                                  <pre className="bg-white p-2 rounded text-[10px] overflow-auto max-h-32">
                                    {log.beforeState ? JSON.stringify(log.beforeState, null, 2) : "—"}
                                  </pre>
                                </div>
                                <div>
                                  <p className="text-text-quaternary mb-1">After</p>
                                  <pre className="bg-white p-2 rounded text-[10px] overflow-auto max-h-32">
                                    {log.afterState ? JSON.stringify(log.afterState, null, 2) : "—"}
                                  </pre>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── Billing ── */}
        {tab === "billing" && (
          <div className="space-y-4">
            <div className="card p-6 space-y-3">
              <h2 className="text-sm font-medium text-text-tertiary uppercase tracking-wide">Current Plan</h2>
              <div className="flex items-center gap-4">
                <span className="text-lg font-semibold text-text-primary capitalize">{workspace?.plan || "Free"}</span>
                <button className="btn-secondary text-xs">Change plan</button>
              </div>
            </div>
            <div className="card p-6 space-y-3">
              <h3 className="text-sm font-medium text-text-primary">Usage</h3>
              <div className="grid grid-cols-2 gap-4 text-xs text-text-secondary">
                <div>Projects: <strong>—/—</strong></div>
                <div>Users: <strong>{team.length}/—</strong></div>
              </div>
            </div>
            <div className="card p-6 space-y-3">
              <h3 className="text-sm font-medium text-text-primary">Payment Method</h3>
              <p className="text-xs text-text-quaternary">Payment managed via Stripe. Not configured yet.</p>
              <button className="btn-secondary text-xs">Add payment method</button>
            </div>
            <div className="card p-6 space-y-3">
              <h3 className="text-sm font-medium text-text-primary">Invoice History</h3>
              <p className="text-xs text-text-quaternary">No invoices yet.</p>
            </div>
          </div>
        )}

        {/* ── Data & Privacy ── */}
        {tab === "data" && (
          <DataPrivacyTab />
        )}
      </div>
    </AppShell>
  );
}

// ─── Data & Privacy tab ──────────────────────────────────────
// Wires DSGVO Art. 20 (export) + Art. 17 (anonymize) endpoints.

function DataPrivacyTab() {
  const [exporting, setExporting] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleExport() {
    setExporting(true);
    setError(null);
    try {
      const res = await fetch(`${API}/api/account/export`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        setError(json.error ?? `Export fehlgeschlagen (${res.status})`);
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `tenderfish-data-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setExporting(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(`${API}/api/account`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        setError(json.error ?? `Löschung fehlgeschlagen (${res.status})`);
        return;
      }
      window.location.href = "/";
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="card p-3 text-xs text-state-missing-text bg-status-danger-light/40 border-status-danger-border">
          {error}
        </div>
      )}

      <div className="card p-6 space-y-3">
        <h3 className="text-sm font-medium text-text-primary">Daten exportieren (DSGVO Art. 20)</h3>
        <p className="text-xs text-text-quaternary">
          Lädt eine JSON-Datei mit Ihren Profildaten, Audit-Einträgen und sichtbaren Workspace-Projekten herunter.
        </p>
        <button
          onClick={handleExport}
          disabled={exporting}
          className="btn-secondary text-xs"
        >
          {exporting ? "Export läuft…" : "Daten exportieren"}
        </button>
      </div>

      <div className="card p-6 space-y-3">
        <h3 className="text-sm font-medium text-text-primary">Datenschutz-Dokumente</h3>
        <p className="text-xs text-text-quaternary">
          <a className="text-brand-orange hover:underline" href="/datenschutz" target="_blank" rel="noreferrer">Datenschutzerklärung</a>
          {" · "}
          <a className="text-brand-orange hover:underline" href="/impressum" target="_blank" rel="noreferrer">Impressum</a>
        </p>
      </div>

      <div className="card p-6 space-y-3 border-status-danger-border">
        <h3 className="text-sm font-medium text-status-reject">Konto löschen (DSGVO Art. 17)</h3>
        <p className="text-xs text-text-quaternary">
          Anonymisiert Ihr Konto unwiderruflich. Persönliche Profildaten (E-Mail, Name) werden ersetzt;
          Audit-Einträge bleiben pseudonymisiert erhalten, da sie zur revisionssicheren
          Dokumentation rechtlich erforderlich sind.
        </p>
        {confirming ? (
          <div className="space-y-2">
            <p className="text-xs font-medium text-status-reject">
              Diese Aktion kann nicht rückgängig gemacht werden. Sie werden danach abgemeldet.
            </p>
            <div className="flex gap-2">
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="text-xs bg-status-danger-light text-status-reject border border-status-danger-border rounded px-3 py-1.5 hover:bg-status-danger-bg"
              >
                {deleting ? "Lösche…" : "Konto endgültig löschen"}
              </button>
              <button
                onClick={() => setConfirming(false)}
                disabled={deleting}
                className="btn-secondary text-xs"
              >
                Abbrechen
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setConfirming(true)}
            className="text-xs bg-status-danger-light text-status-reject border border-status-danger-border rounded px-3 py-1.5 hover:bg-status-danger-bg"
          >
            Konto löschen
          </button>
        )}
      </div>
    </div>
  );
}
