"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import AppShell from "@/components/layout/AppShell";
import { Modal } from "@/components/ui/Modal";
import { formatDate } from "@/lib/formatters";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

const IMAGE_EXT = new Set(["png", "jpg", "jpeg", "gif", "webp", "svg"]);

function FilePreview({
  projectId,
  docId,
  fallbackName,
}: {
  projectId: string;
  docId: string;
  fallbackName: string;
}) {
  const [data, setData] = useState<{ url: string | null; fileName: string; mimeType: string } | null>(null);
  const [errored, setErrored] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch(`${API}/api/projects/${projectId}/documents/${docId}/file-url`, {
      credentials: "include",
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (alive && j) setData(j.data);
      })
      .catch(() => alive && setErrored(true));
    return () => {
      alive = false;
    };
  }, [projectId, docId]);

  const name = data?.fileName || "";
  const ext = name.includes(".") ? name.slice(name.lastIndexOf(".") + 1).toLowerCase() : "";
  const isImage = IMAGE_EXT.has(ext);
  const isPdf = ext === "pdf";

  let icon: string;
  let tint: string;
  if (isPdf) {
    icon = "PDF";
    tint = "bg-red-500/10 text-red-500 border-red-500/30";
  } else if (ext === "doc" || ext === "docx") {
    icon = "DOC";
    tint = "bg-blue-500/10 text-blue-500 border-blue-500/30";
  } else if (ext === "xls" || ext === "xlsx") {
    icon = "XLS";
    tint = "bg-green-500/10 text-green-500 border-green-500/30";
  } else if (ext === "xml") {
    icon = "XML";
    tint = "bg-purple-500/10 text-purple-500 border-purple-500/30";
  } else {
    icon = ext.toUpperCase().slice(0, 4) || "FILE";
    tint = "bg-bg-inset text-text-tertiary border-border";
  }

  if (isImage && data?.url && !errored) {
    return (
      <div className="w-12 h-12 rounded-sm overflow-hidden border border-border bg-bg-inset shrink-0">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={data.url}
          alt={name}
          className="w-full h-full object-cover"
          onError={() => setErrored(true)}
        />
      </div>
    );
  }

  return (
    <div
      className={`w-12 h-12 rounded-sm border flex items-center justify-center text-[10px] font-mono font-semibold shrink-0 ${tint}`}
      title={name || fallbackName}
    >
      {icon}
    </div>
  );
}

const DOC_TYPES = [
  "Project Briefs",
  "Contracts",
  "Planning Documents",
  "Approval Documents",
  "Tender Documents",
  "Execution Documents",
  "Meeting Records",
  "Correspondence",
  "Evidence",
];

const STATUS_FLOW = [
  "draft",
  "internally_reviewed",
  "approved_for_issue",
  "issued",
  "superseded",
  "awarded_baseline",
  "archived",
];

const STATUS_LABELS: Record<string, { label: string; cls: string }> = {
  draft: { label: "Draft", cls: "bg-bg-inset text-text-tertiary border-border" },
  internally_reviewed: { label: "Internally Reviewed", cls: "bg-status-info-bg text-status-info-fg border-status-info-border" },
  approved_for_issue: { label: "Approved for Issue", cls: "bg-status-success-bg text-status-approve border-status-success-border" },
  issued: { label: "Issued", cls: "bg-status-purple-bg text-status-purple-fg border-status-purple-border" },
  superseded: { label: "Superseded", cls: "bg-status-warning-bg text-status-warning-fg border-status-warning-border" },
  awarded_baseline: { label: "Awarded Baseline", cls: "bg-brand-orange/10 text-brand-orange border-brand-orange/30" },
  archived: { label: "Archived", cls: "bg-bg-inset text-text-tertiary border-border" },
};

type DocVersion = {
  version: number;
  date: string;
  uploadedBy: string;
  status: string;
  changesNote?: string;
  filePath: string;
};

type Document = {
  id: string;
  name: string;
  type: string;
  versions: DocVersion[];
  currentVersion: number;
  status: string;
  createdByName: string | null;
  createdAt: string;
};

export default function DocumentsPage() {
  const { id } = useParams() as { id: string };
  const [docs, setDocs] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeType, setActiveType] = useState<string | null>(null);
  const [showUpload, setShowUpload] = useState(false);
  const [showDetail, setShowDetail] = useState<Document | null>(null);
  const [form, setForm] = useState({ name: "", type: DOC_TYPES[0] });
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [changeNote, setChangeNote] = useState("");
  const [versionFile, setVersionFile] = useState<File | null>(null);

  const fetchDocs = useCallback(async () => {
    try {
      const params = activeType ? `?type=${encodeURIComponent(activeType)}` : "";
      const res = await fetch(`${API}/api/projects/${id}/documents${params}`, { credentials: "include" });
      if (res.ok) setDocs((await res.json()).data);
    } catch { /* ignore */ }
    setLoading(false);
  }, [id, activeType]);

  useEffect(() => { fetchDocs(); }, [fetchDocs]);

  async function createDoc() {
    const effectiveName = form.name.trim() || uploadFile?.name || "";
    if (!effectiveName) return;
    setUploadBusy(true);
    const fd = new FormData();
    fd.append("name", effectiveName);
    fd.append("type", form.type);
    if (uploadFile) fd.append("file", uploadFile);
    await fetch(`${API}/api/projects/${id}/documents`, {
      credentials: "include",
      method: "POST",
      body: fd,
    });
    setForm({ name: "", type: DOC_TYPES[0] });
    setUploadFile(null);
    setShowUpload(false);
    setUploadBusy(false);
    fetchDocs();
  }

  async function downloadDoc(docId: string) {
    const res = await fetch(`${API}/api/projects/${id}/documents/${docId}/file-url`, {
      credentials: "include",
    });
    if (!res.ok) return;
    const json = await res.json();
    const url = json?.data?.url;
    if (url) window.open(url, "_blank", "noopener,noreferrer");
    else alert("This document has no stored file yet. Upload a file when creating it or via 'Upload New Version'.");
  }

  async function updateStatus(docId: string, status: string) {
    await fetch(`${API}/api/projects/${id}/documents/${docId}`, {
      credentials: "include",
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    setShowDetail(null);
    fetchDocs();
  }

  async function newVersion(docId: string) {
    const fd = new FormData();
    if (changeNote) fd.append("changesNote", changeNote);
    if (versionFile) fd.append("file", versionFile);
    await fetch(`${API}/api/projects/${id}/documents/${docId}/versions`, {
      credentials: "include",
      method: "POST",
      body: fd,
    });
    setChangeNote("");
    setVersionFile(null);
    setShowDetail(null);
    fetchDocs();
  }

  async function deleteDoc(docId: string) {
    await fetch(`${API}/api/projects/${id}/documents/${docId}`, { method: "DELETE" , credentials: "include" });
    setShowDetail(null);
    fetchDocs();
  }

  if (loading) {
    return (
      <AppShell>
        <div className="flex items-center justify-center h-64 text-text-quaternary text-sm">Loading documents…</div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="flex gap-4 h-full">
        {/* Left tree */}
        <div className="w-[200px] shrink-0 space-y-1">
          <button
            onClick={() => setActiveType(null)}
            className={`block w-full text-left px-3 py-1.5 text-xs rounded-sm transition-colors ${
              !activeType ? "bg-brand-orange/10 text-brand-orange font-medium" : "text-text-tertiary hover:bg-bg-inset/50"
            }`}
          >
            All Documents
          </button>
          {DOC_TYPES.map((t) => (
            <button
              key={t}
              onClick={() => setActiveType(t)}
              className={`block w-full text-left px-3 py-1.5 text-xs rounded-sm transition-colors ${
                activeType === t ? "bg-brand-orange/10 text-brand-orange font-medium" : "text-text-tertiary hover:bg-bg-inset/50"
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Right content */}
        <div className="flex-1 space-y-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-semibold text-text-primary">
              {activeType || "All Documents"}
            </h1>
            <button className="btn-primary text-sm" onClick={() => setShowUpload(true)}>
              Upload document
            </button>
          </div>

          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-bg-inset/30">
                  <th className="px-4 py-2 w-16"></th>
                  <th className="text-left px-4 py-2 text-xs font-medium text-text-tertiary uppercase tracking-wide">Name</th>
                  <th className="text-left px-4 py-2 text-xs font-medium text-text-tertiary uppercase tracking-wide w-28">Type</th>
                  <th className="text-left px-4 py-2 text-xs font-medium text-text-tertiary uppercase tracking-wide w-20">Version</th>
                  <th className="text-left px-4 py-2 text-xs font-medium text-text-tertiary uppercase tracking-wide w-32">Status</th>
                  <th className="text-left px-4 py-2 text-xs font-medium text-text-tertiary uppercase tracking-wide w-28">Updated</th>
                  <th className="text-left px-4 py-2 text-xs font-medium text-text-tertiary uppercase tracking-wide w-24">Action</th>
                </tr>
              </thead>
              <tbody>
                {docs.length === 0 ? (
                  <tr><td colSpan={7} className="px-4 py-8 text-center text-text-quaternary">No documents found.</td></tr>
                ) : docs.map((doc) => {
                  const st = STATUS_LABELS[doc.status] || STATUS_LABELS.draft;
                  const lastVersion = doc.versions[doc.versions.length - 1];
                  const uploadedFile = lastVersion?.filePath
                    ? lastVersion.filePath.split("/").pop() ?? ""
                    : "";
                  return (
                    <tr key={doc.id} className="border-b border-border last:border-0 hover:bg-bg-inset/20">
                      <td className="px-4 py-3">
                        <FilePreview projectId={id} docId={doc.id} fallbackName={doc.name} />
                      </td>
                      <td className="px-4 py-3 text-text-primary">
                        <div className="font-medium">{doc.name}</div>
                        {uploadedFile && (
                          <div className="text-xs text-text-tertiary mt-0.5 font-mono truncate max-w-xs" title={uploadedFile}>
                            {uploadedFile}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-text-tertiary">{doc.type}</td>
                      <td className="px-4 py-3 text-xs font-mono text-text-tertiary">v{doc.currentVersion}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-sm border ${st.cls}`}>
                          {st.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-text-quaternary font-mono">
                        {lastVersion ? formatDate(lastVersion.date) : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <button className="text-xs text-brand-orange hover:text-brand-orange-dark font-medium" onClick={() => setShowDetail(doc)}>
                            View
                          </button>
                          <button
                            className="text-xs text-text-tertiary hover:text-brand-orange font-medium"
                            onClick={() => downloadDoc(doc.id)}
                          >
                            Download
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Upload Modal */}
      <Modal
        open={showUpload}
        onClose={() => {
          setShowUpload(false);
          setUploadFile(null);
        }}
        title="Upload New Document"
      >
        <div className="space-y-4">
          <div>
            <label className="label">File</label>
            <input
              type="file"
              className="input"
              onChange={(e) => {
                const f = e.target.files?.[0] ?? null;
                setUploadFile(f);
                if (f && !form.name.trim()) setForm({ ...form, name: f.name });
              }}
            />
            {uploadFile && (
              <p className="mt-1 text-xs text-text-tertiary font-mono truncate">
                {uploadFile.name} · {(uploadFile.size / 1024).toFixed(0)} KB
              </p>
            )}
          </div>
          <div>
            <label className="label">Document Name *</label>
            <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Site Survey Report" />
          </div>
          <div>
            <label className="label">Document Type *</label>
            <select className="input" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
              {DOC_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button className="btn-secondary" onClick={() => { setShowUpload(false); setUploadFile(null); }}>Cancel</button>
            <button
              className="btn-primary"
              onClick={createDoc}
              disabled={uploadBusy || (!form.name.trim() && !uploadFile)}
            >
              {uploadBusy ? "Uploading…" : "Upload"}
            </button>
          </div>
        </div>
      </Modal>

      {/* Detail Modal */}
      <Modal open={!!showDetail} onClose={() => { setShowDetail(null); setChangeNote(""); }} title={showDetail?.name || ""} width="max-w-2xl">
        {showDetail && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3 text-sm">
              <div>
                <span className="text-text-tertiary text-xs">Type</span>
                <p>{showDetail.type}</p>
              </div>
              <div>
                <span className="text-text-tertiary text-xs">Current Version</span>
                <p className="font-mono">v{showDetail.currentVersion}</p>
              </div>
              <div>
                <span className="text-text-tertiary text-xs">Status</span>
                <p>
                  <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-sm border ${(STATUS_LABELS[showDetail.status] || STATUS_LABELS.draft).cls}`}>
                    {(STATUS_LABELS[showDetail.status] || STATUS_LABELS.draft).label}
                  </span>
                </p>
              </div>
            </div>

            {/* Version history */}
            <div>
              <h3 className="text-xs font-medium text-text-tertiary uppercase tracking-wide mb-2">Version History</h3>
              <div className="space-y-2">
                {showDetail.versions.map((v) => (
                  <div key={v.version} className="flex items-center justify-between text-sm border-b border-border pb-2 last:border-0">
                    <div>
                      <span className="font-mono text-xs text-text-tertiary">v{v.version}</span>
                      <span className="ml-2">{formatDate(v.date)}</span>
                      {v.changesNote && <span className="ml-2 text-xs text-text-quaternary">— {v.changesNote}</span>}
                    </div>
                    <span className={`inline-flex items-center px-1.5 py-0.5 text-xs rounded-sm ${(STATUS_LABELS[v.status] || STATUS_LABELS.draft).cls}`}>
                      {(STATUS_LABELS[v.status] || STATUS_LABELS.draft).label}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Status transitions */}
            <div>
              <h3 className="text-xs font-medium text-text-tertiary uppercase tracking-wide mb-2">Change Status</h3>
              <div className="flex flex-wrap gap-2">
                {STATUS_FLOW.filter((s) => s !== showDetail.status).map((s) => (
                  <button
                    key={s}
                    onClick={() => updateStatus(showDetail.id, s)}
                    className="text-xs px-2 py-1 border border-border rounded-sm hover:bg-bg-inset/50 transition-colors"
                  >
                    {(STATUS_LABELS[s] || { label: s }).label}
                  </button>
                ))}
              </div>
            </div>

            {/* New version */}
            <div className="border-t border-border pt-4">
              <h3 className="text-xs font-medium text-text-tertiary uppercase tracking-wide mb-2">Upload New Version</h3>
              <div className="space-y-2">
                <input
                  type="file"
                  className="input text-sm"
                  onChange={(e) => setVersionFile(e.target.files?.[0] ?? null)}
                />
                {versionFile && (
                  <p className="text-xs text-text-tertiary font-mono truncate">
                    {versionFile.name} · {(versionFile.size / 1024).toFixed(0)} KB
                  </p>
                )}
                <div className="flex gap-2 items-end">
                  <div className="flex-1">
                    <input className="input text-sm" value={changeNote} onChange={(e) => setChangeNote(e.target.value)} placeholder="Change note (optional)" />
                  </div>
                  <button
                    className="btn-primary text-sm"
                    onClick={() => newVersion(showDetail.id)}
                    disabled={!versionFile && !changeNote}
                  >
                    Upload v{showDetail.currentVersion + 1}
                  </button>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button className="text-xs text-status-danger hover:text-status-danger-fg" onClick={() => deleteDoc(showDetail.id)}>Delete document</button>
            </div>
          </div>
        )}
      </Modal>
    </AppShell>
  );
}
