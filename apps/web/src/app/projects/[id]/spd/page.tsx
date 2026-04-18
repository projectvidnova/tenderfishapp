"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import AppShell from "@/components/layout/AppShell";
import { Modal } from "@/components/ui/Modal";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

const STATUS_LABELS: Record<string, { label: string; cls: string }> = {
  draft: { label: "Draft", cls: "bg-bg-inset text-text-tertiary" },
  submitted: { label: "Submitted", cls: "bg-status-info-bg text-status-info-fg" },
  approved: { label: "Approved", cls: "bg-status-success-bg text-status-approve" },
  revision_requested: { label: "Revision Requested", cls: "bg-status-warning-bg text-status-warning-fg" },
};

const PROJECT_TYPES = [
  "New Build",
  "Refurbishment",
  "Conversion",
  "Interior Fit-Out",
  "Mixed Use",
];

function getToken() {
  if (typeof window !== "undefined") return localStorage.getItem("tf_token") || "";
  return "";
}

type SPDVersion = {
  id: string;
  version: number;
  status: string;
  projectName: string;
  projectGoal: string;
  projectType: string;
  location: string;
  scopeOfWork: string;
  spatialScope: string;
  participants: { name: string; role: string; company?: string; email?: string }[];
  relevantApprovedDocuments: string[];
  assumptions: string[];
  openPoints: { point: string; priority: string; assignedTo?: string }[];
  currentProjectPhase: string | null;
  approvedProjectResources: string | null;
  currentDefinedProjectStatus: string | null;
  approvedBy: string | null;
  approvedAt: string | null;
  createdBy: string;
  createdAt: string;
};

export default function SPDPage() {
  const { id } = useParams() as { id: string };
  const [current, setCurrent] = useState<SPDVersion | null>(null);
  const [versions, setVersions] = useState<SPDVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showVersions, setShowVersions] = useState(false);
  const [form, setForm] = useState({
    projectName: "", projectGoal: "", projectType: "New Build", location: "",
    scopeOfWork: "", spatialScope: "",
    currentProjectPhase: "", approvedProjectResources: "", currentDefinedProjectStatus: "",
  });
  const [participantsInput, setParticipantsInput] = useState("");
  const [assumptionsInput, setAssumptionsInput] = useState("");
  const [openPointsInput, setOpenPointsInput] = useState("");

  const fetchSPD = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/projects/${id}/spd`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (res.ok) {
        const json = await res.json();
        setCurrent(json.data || null);
      }
    } catch { /* ignore */ }
    setLoading(false);
  }, [id]);

  const fetchVersions = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/projects/${id}/spd/versions`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (res.ok) {
        const json = await res.json();
        setVersions(json.data || []);
      }
    } catch { /* ignore */ }
  }, [id]);

  useEffect(() => { fetchSPD(); }, [fetchSPD]);

  async function createSPD() {
    const res = await fetch(`${API}/api/projects/${id}/spd`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
      body: JSON.stringify({
        ...form,
        participants: participantsInput ? participantsInput.split("\n").filter(Boolean).map((line) => {
          const [name, role, company] = line.split(",").map((s) => s.trim());
          return { name: name || "", role: role || "", company: company || "" };
        }) : [],
        assumptions: assumptionsInput ? assumptionsInput.split("\n").filter(Boolean) : [],
        openPoints: openPointsInput ? openPointsInput.split("\n").filter(Boolean).map((line) => ({
          point: line.trim(), priority: "medium",
        })) : [],
        relevantApprovedDocuments: [],
      }),
    });
    if (res.ok) { setShowCreate(false); fetchSPD(); }
  }

  async function approveSPD(spdId: string) {
    await fetch(`${API}/api/projects/${id}/spd/${spdId}/approve`, {
      method: "POST",
      headers: { Authorization: `Bearer ${getToken()}` },
    });
    fetchSPD();
  }

  function prefillForm(spd: SPDVersion) {
    setForm({
      projectName: spd.projectName, projectGoal: spd.projectGoal,
      projectType: spd.projectType, location: spd.location,
      scopeOfWork: spd.scopeOfWork, spatialScope: spd.spatialScope,
      currentProjectPhase: spd.currentProjectPhase || "",
      approvedProjectResources: spd.approvedProjectResources || "",
      currentDefinedProjectStatus: spd.currentDefinedProjectStatus || "",
    });
    setParticipantsInput(spd.participants.map((p) => `${p.name}, ${p.role}, ${p.company || ""}`).join("\n"));
    setAssumptionsInput(spd.assumptions.join("\n"));
    setOpenPointsInput(spd.openPoints.map((op) => op.point).join("\n"));
  }

  if (loading) return <AppShell><div className="p-8 text-text-quaternary">Loading…</div></AppShell>;

  return (
    <AppShell>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Structured Project Description</h1>
            <p className="text-sm text-text-tertiary mt-1">13 mandatory fields per HOAI requirements</p>
          </div>
          <div className="flex gap-2">
            {current && (
              <button className="btn-secondary" onClick={() => { fetchVersions(); setShowVersions(true); }}>Version History</button>
            )}
            <button className="btn-primary" onClick={() => {
              if (current) prefillForm(current);
              setShowCreate(true);
            }}>
              {current ? "New Revision" : "+ Create SPD"}
            </button>
          </div>
        </div>

        {!current ? (
          <div className="card p-8 text-center">
            <p className="text-text-quaternary">No project description created yet.</p>
            <p className="text-xs text-text-quaternary mt-1">Create an SPD to define the project scope and requirements.</p>
          </div>
        ) : (
          <>
            {/* Status bar */}
            <div className="flex items-center gap-3">
              <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${STATUS_LABELS[current.status]?.cls || ""}`}>
                {STATUS_LABELS[current.status]?.label || current.status}
              </span>
              <span className="text-xs text-text-tertiary">Version {current.version}</span>
              <span className="text-xs text-text-quaternary">Created {new Date(current.createdAt).toLocaleDateString("de-DE")}</span>
              {current.status === "submitted" && (
                <button className="ml-auto btn-primary text-xs" onClick={() => approveSPD(current.id)}>Approve</button>
              )}
            </div>

            {/* SPD fields display */}
            <div className="grid grid-cols-2 gap-4">
              {[
                { label: "Project Name", value: current.projectName },
                { label: "Project Type", value: current.projectType },
                { label: "Location", value: current.location },
                { label: "Current Phase", value: current.currentProjectPhase },
              ].map((f) => (
                <div key={f.label} className="card p-4">
                  <p className="text-xs text-text-tertiary font-medium uppercase tracking-wide">{f.label}</p>
                  <p className="text-sm mt-1">{f.value || "—"}</p>
                </div>
              ))}
            </div>

            <div className="card p-4 space-y-3">
              <div>
                <p className="text-xs text-text-tertiary font-medium uppercase tracking-wide">Project Goal</p>
                <p className="text-sm mt-1">{current.projectGoal || "—"}</p>
              </div>
              <div>
                <p className="text-xs text-text-tertiary font-medium uppercase tracking-wide">Scope of Work</p>
                <p className="text-sm mt-1 whitespace-pre-wrap">{current.scopeOfWork || "—"}</p>
              </div>
              <div>
                <p className="text-xs text-text-tertiary font-medium uppercase tracking-wide">Spatial Scope</p>
                <p className="text-sm mt-1">{current.spatialScope || "—"}</p>
              </div>
            </div>

            {/* Participants */}
            {current.participants.length > 0 && (
              <div className="card overflow-hidden">
                <div className="px-4 py-3 border-b border-border bg-bg-inset/30">
                  <p className="text-xs font-medium text-text-tertiary uppercase tracking-wide">Identified Participants</p>
                </div>
                <table className="w-full text-sm">
                  <tbody>
                    {current.participants.map((p, i) => (
                      <tr key={i} className="border-b border-border last:border-0">
                        <td className="px-4 py-2 font-medium">{p.name}</td>
                        <td className="px-4 py-2 text-text-secondary">{p.role}</td>
                        <td className="px-4 py-2 text-text-tertiary">{p.company || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Assumptions & Open Points */}
            <div className="grid grid-cols-2 gap-4">
              <div className="card p-4">
                <p className="text-xs text-text-tertiary font-medium uppercase tracking-wide mb-2">Assumptions</p>
                {current.assumptions.length === 0 ? (
                  <p className="text-sm text-text-quaternary">None listed</p>
                ) : (
                  <ul className="space-y-1">
                    {current.assumptions.map((a, i) => (
                      <li key={i} className="text-sm text-text-secondary flex gap-2">
                        <span className="text-text-quaternary">•</span> {a}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="card p-4">
                <p className="text-xs text-text-tertiary font-medium uppercase tracking-wide mb-2">Open Points</p>
                {current.openPoints.length === 0 ? (
                  <p className="text-sm text-text-quaternary">None listed</p>
                ) : (
                  <ul className="space-y-1">
                    {current.openPoints.map((op, i) => (
                      <li key={i} className="text-sm text-text-secondary flex gap-2">
                        <span className="text-status-warning">●</span> {op.point}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </>
        )}

        {/* Create/Revision modal */}
        <Modal open={showCreate} onClose={() => setShowCreate(false)} title={current ? "New SPD Revision" : "Create Project Description"} width="max-w-2xl">
          <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Project Name *</label>
                <input className="input" value={form.projectName} onChange={(e) => setForm({ ...form, projectName: e.target.value })} />
              </div>
              <div>
                <label className="label">Project Type *</label>
                <select className="input" value={form.projectType} onChange={(e) => setForm({ ...form, projectType: e.target.value })}>
                  {PROJECT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="label">Project Goal *</label>
              <textarea className="input" rows={2} value={form.projectGoal} onChange={(e) => setForm({ ...form, projectGoal: e.target.value })} />
            </div>
            <div>
              <label className="label">Location *</label>
              <input className="input" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
            </div>
            <div>
              <label className="label">Scope of Work *</label>
              <textarea className="input" rows={3} value={form.scopeOfWork} onChange={(e) => setForm({ ...form, scopeOfWork: e.target.value })} />
            </div>
            <div>
              <label className="label">Spatial Scope *</label>
              <textarea className="input" rows={2} value={form.spatialScope} onChange={(e) => setForm({ ...form, spatialScope: e.target.value })} />
            </div>
            <div>
              <label className="label">Participants (one per line: name, role, company)</label>
              <textarea className="input font-mono text-xs" rows={4} value={participantsInput} onChange={(e) => setParticipantsInput(e.target.value)} placeholder="Jane Doe, Architect Lead, Studio XYZ" />
            </div>
            <div>
              <label className="label">Assumptions (one per line)</label>
              <textarea className="input" rows={3} value={assumptionsInput} onChange={(e) => setAssumptionsInput(e.target.value)} />
            </div>
            <div>
              <label className="label">Open Points (one per line)</label>
              <textarea className="input" rows={3} value={openPointsInput} onChange={(e) => setOpenPointsInput(e.target.value)} />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="label">Current Phase</label>
                <input className="input" value={form.currentProjectPhase} onChange={(e) => setForm({ ...form, currentProjectPhase: e.target.value })} placeholder="e.g. LPH 2" />
              </div>
              <div>
                <label className="label">Approved Resources</label>
                <input className="input" value={form.approvedProjectResources} onChange={(e) => setForm({ ...form, approvedProjectResources: e.target.value })} />
              </div>
              <div>
                <label className="label">Defined Status</label>
                <input className="input" value={form.currentDefinedProjectStatus} onChange={(e) => setForm({ ...form, currentDefinedProjectStatus: e.target.value })} />
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button className="btn-secondary" onClick={() => setShowCreate(false)}>Cancel</button>
              <button className="btn-primary" onClick={createSPD} disabled={!form.projectName || !form.projectGoal || !form.location}>
                {current ? "Create Revision" : "Create SPD"}
              </button>
            </div>
          </div>
        </Modal>

        {/* Version history modal */}
        <Modal open={showVersions} onClose={() => setShowVersions(false)} title="SPD Version History">
          <div className="space-y-2">
            {versions.length === 0 ? (
              <p className="text-sm text-text-quaternary text-center py-4">No versions found.</p>
            ) : versions.map((v) => (
              <div key={v.id} className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-bg-inset/50">
                <span className="text-sm font-medium">v{v.version}</span>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${STATUS_LABELS[v.status]?.cls || ""}`}>
                  {STATUS_LABELS[v.status]?.label || v.status}
                </span>
                <span className="text-xs text-text-tertiary ml-auto">{new Date(v.createdAt).toLocaleDateString("de-DE")}</span>
              </div>
            ))}
          </div>
        </Modal>
      </div>
    </AppShell>
  );
}
