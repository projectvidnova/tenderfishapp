"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import AppShell from "@/components/layout/AppShell";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

const STATUS_LABELS: Record<string, { label: string; cls: string }> = {
  pending_review: { label: "Pending Review", cls: "bg-status-warning-bg text-status-warning-fg" },
  released: { label: "Released", cls: "bg-status-success-bg text-status-approve" },
  recalled: { label: "Recalled", cls: "bg-status-danger-bg text-status-reject" },
};

type TenderRelease = {
  id: string;
  status: string;
  prerequisites: {
    spdApproved: boolean;
    costSnapshotApproved: boolean;
    allPackagesReady: boolean;
    gateDComplete: boolean;
  } | null;
  notes: string | null;
  releasedBy: string | null;
  releasedAt: string | null;
  recalledBy: string | null;
  recalledAt: string | null;
  recallReason: string | null;
  createdAt: string;
};

export default function TenderReleasePage() {
  const { id } = useParams() as { id: string };
  const [release, setRelease] = useState<TenderRelease | null>(null);
  const [loading, setLoading] = useState(true);
  const [notes, setNotes] = useState("");
  const [recallReason, setRecallReason] = useState("");
  const [showRecall, setShowRecall] = useState(false);

  const fetchRelease = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/projects/${id}/tender-release`, {
        credentials: "include",
      });
      if (res.ok) {
        const json = await res.json();
        setRelease(json.data || null);
      }
    } catch { /* ignore */ }
    setLoading(false);
  }, [id]);

  useEffect(() => { fetchRelease(); }, [fetchRelease]);

  async function createRelease() {
    const res = await fetch(`${API}/api/projects/${id}/tender-release`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ notes: notes || null }),
    });
    if (res.ok) { setNotes(""); fetchRelease(); }
  }

  async function updateStatus(status: string, reason?: string) {
    if (!release) return;
    const body: Record<string, string> = { status };
    if (reason) body.recallReason = reason;
    await fetch(`${API}/api/projects/${id}/tender-release/${release.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(body),
    });
    setShowRecall(false);
    setRecallReason("");
    fetchRelease();
  }

  const prereqs = release?.prerequisites;
  const allMet = prereqs && prereqs.spdApproved && prereqs.costSnapshotApproved && prereqs.allPackagesReady && prereqs.gateDComplete;

  if (loading) return <AppShell><div className="p-8 text-text-quaternary">Loading…</div></AppShell>;

  return (
    <AppShell>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Tender Release</h1>
            <p className="text-sm text-text-tertiary mt-1">Formal release of tender packages to bidders</p>
          </div>
        </div>

        {/* Prerequisites checklist */}
        <div className="card p-6 space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-text-tertiary">Prerequisites</h2>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "SPD Approved", met: prereqs?.spdApproved },
              { label: "Cost Snapshot Approved", met: prereqs?.costSnapshotApproved },
              { label: "All Tender Packages Ready", met: prereqs?.allPackagesReady },
              { label: "Gate D Complete", met: prereqs?.gateDComplete },
            ].map((p) => (
              <div key={p.label} className="flex items-center gap-3 px-4 py-3 rounded-xl bg-bg-inset/50">
                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-medium ${
                  p.met ? "bg-status-success-bg text-status-approve" : "bg-status-danger-light text-status-danger"
                }`}>
                  {p.met ? "✓" : "✗"}
                </span>
                <span className="text-sm">{p.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Current release status */}
        {!release ? (
          <div className="card p-6 space-y-4">
            <p className="text-text-tertiary text-sm">No tender release initiated yet.</p>
            {!allMet && (
              <div className="bg-status-warning-light border border-status-warning-border rounded-xl px-4 py-3 text-sm text-status-warning-fg">
                Not all prerequisites are met. You can still initiate a review, but release will require all checks to pass.
              </div>
            )}
            <div>
              <label className="label">Notes (optional)</label>
              <textarea className="input" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Add context for the release review…" />
            </div>
            <button className="btn-primary" onClick={createRelease}>Initiate Tender Release</button>
          </div>
        ) : (
          <div className="card p-6 space-y-4">
            <div className="flex items-center gap-3">
              <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${STATUS_LABELS[release.status]?.cls || ""}`}>
                {STATUS_LABELS[release.status]?.label || release.status}
              </span>
              <span className="text-xs text-text-tertiary">Created {new Date(release.createdAt).toLocaleDateString("de-DE")}</span>
            </div>

            {release.notes && <p className="text-sm text-text-secondary">{release.notes}</p>}

            {release.status === "released" && release.releasedAt && (
              <div className="bg-status-success-light border border-status-success-border rounded-xl px-4 py-3 text-sm text-status-approve">
                Released on {new Date(release.releasedAt).toLocaleString("de-DE")}
              </div>
            )}

            {release.status === "recalled" && (
              <div className="bg-status-danger-light border border-status-danger-border rounded-xl px-4 py-3 text-sm text-status-reject">
                Recalled{release.recalledAt ? ` on ${new Date(release.recalledAt).toLocaleString("de-DE")}` : ""}.
                {release.recallReason && <span className="block mt-1 text-text-secondary">Reason: {release.recallReason}</span>}
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2 pt-2">
              {release.status === "pending_review" && (
                <>
                  <button className="btn-primary" onClick={() => updateStatus("released")} disabled={!allMet}>
                    {allMet ? "Release to Market" : "Prerequisites not met"}
                  </button>
                  <button className="btn-secondary" onClick={() => setShowRecall(true)}>Recall</button>
                </>
              )}
              {release.status === "released" && (
                <button className="btn-secondary text-status-danger" onClick={() => setShowRecall(true)}>Recall Release</button>
              )}
            </div>

            {showRecall && (
              <div className="bg-bg-inset rounded-xl p-4 space-y-3">
                <label className="label">Recall Reason *</label>
                <textarea className="input" rows={2} value={recallReason} onChange={(e) => setRecallReason(e.target.value)} placeholder="Explain why the release is being recalled…" />
                <div className="flex gap-2">
                  <button className="btn-primary text-xs bg-status-danger hover:bg-status-danger/90" onClick={() => updateStatus("recalled", recallReason)} disabled={!recallReason.trim()}>Confirm Recall</button>
                  <button className="btn-secondary text-xs" onClick={() => setShowRecall(false)}>Cancel</button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </AppShell>
  );
}
