"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import AppShell from "@/components/layout/AppShell";
import { Modal } from "@/components/ui/Modal";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

/* ──── Status kanban columns ──── */
const KANBAN_COLUMNS = [
  { key: "received", label: "Received" },
  { key: "completeness_check", label: "Completeness Check" },
  { key: "assigned", label: "Assigned" },
  { key: "under_review", label: "Under Review" },
  { key: "deviation_log", label: "Deviation Log" },
  { key: "closed", label: "Closed" },
] as const;

const OUTCOME_LABELS: Record<string, { label: string; cls: string }> = {
  approved: { label: "Approved", cls: "bg-emerald-100 text-emerald-700" },
  approved_with_comments: { label: "Approved with Comments", cls: "bg-blue-100 text-blue-700" },
  resubmission_required: { label: "Resubmission Required", cls: "bg-amber-100 text-amber-700" },
  rejected: { label: "Rejected", cls: "bg-red-100 text-[#B04A3A]" },
};

const SEVERITY_LABELS: Record<string, { label: string; cls: string }> = {
  minor: { label: "Minor", cls: "bg-blue-100 text-blue-700" },
  major: { label: "Major", cls: "bg-amber-100 text-amber-700" },
  critical: { label: "Critical", cls: "bg-red-100 text-[#B04A3A]" },
};

interface Deviation {
  itemNo: number;
  description: string;
  severity: string;
  designImpact: string;
  technicalImpact: string;
  scheduleImpact: string;
  status: string;
  resolutionNotes?: string;
}

interface Review {
  id: string;
  title: string;
  type: string;
  packageName: string | null;
  contractor: string | null;
  submittedBy: string;
  submissionDate: string;
  status: string;
  reviewerId: string | null;
  reviewerName: string | null;
  reviewDueDate: string | null;
  reviewOutcome: string | null;
  reviewComment: string | null;
  reviewDate: string | null;
  deviations: Deviation[];
  deviationCount: number;
  isOverdue: boolean;
  createdAt: string;
}

export default function ReviewsPage() {
  const { id } = useParams() as { id: string };
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);

  /* Modals */
  const [showNew, setShowNew] = useState(false);
  const [selected, setSelected] = useState<Review | null>(null);
  const [detailTab, setDetailTab] = useState<"docs" | "deviations" | "review">("docs");

  /* New submission form */
  const [form, setForm] = useState({ title: "", packageName: "", contractor: "", submittedBy: "", submissionDate: "" });

  /* Review form */
  const [reviewOutcome, setReviewOutcome] = useState("");
  const [reviewComment, setReviewComment] = useState("");

  /* Deviation form */
  const [showAddDeviation, setShowAddDeviation] = useState(false);
  const [devForm, setDevForm] = useState({ description: "", severity: "minor", designImpact: "", technicalImpact: "", scheduleImpact: "", status: "open" });

  const fetchReviews = useCallback(async () => {
    const res = await fetch(`${API}/api/projects/${id}/reviews`);
    const json = await res.json();
    setReviews(json.data || []);
    setLoading(false);
  }, [id]);

  useEffect(() => { fetchReviews(); }, [fetchReviews]);

  async function createSubmission() {
    if (!form.title.trim() || !form.submittedBy || !form.submissionDate) return;
    await fetch(`${API}/api/projects/${id}/reviews`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, type: "shop_drawing" }),
    });
    setForm({ title: "", packageName: "", contractor: "", submittedBy: "", submissionDate: "" });
    setShowNew(false);
    fetchReviews();
  }

  async function updateStatus(reviewId: string, status: string) {
    await fetch(`${API}/api/projects/${id}/reviews/${reviewId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    fetchReviews();
  }

  async function submitReview(reviewId: string) {
    if (!reviewOutcome) return;
    await fetch(`${API}/api/projects/${id}/reviews/${reviewId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reviewOutcome, reviewComment }),
    });
    setReviewOutcome(""); setReviewComment("");
    setSelected(null);
    fetchReviews();
  }

  async function addDeviation(reviewId: string) {
    if (!devForm.description.trim()) return;
    const current = selected?.deviations || [];
    const newDev: Deviation = {
      itemNo: current.length + 1,
      description: devForm.description,
      severity: devForm.severity,
      designImpact: devForm.designImpact,
      technicalImpact: devForm.technicalImpact,
      scheduleImpact: devForm.scheduleImpact,
      status: devForm.status,
    };
    const deviations = [...current, newDev];
    await fetch(`${API}/api/projects/${id}/reviews/${reviewId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deviations }),
    });
    setShowAddDeviation(false);
    setDevForm({ description: "", severity: "minor", designImpact: "", technicalImpact: "", scheduleImpact: "", status: "open" });
    fetchReviews();
    // Refresh selected
    const res = await fetch(`${API}/api/projects/${id}/reviews`);
    const json = await res.json();
    const updated = (json.data as Review[]).find((r: Review) => r.id === reviewId);
    if (updated) setSelected(updated);
  }

  /* Group by status for kanban */
  const grouped: Record<string, Review[]> = {};
  KANBAN_COLUMNS.forEach((c) => { grouped[c.key] = []; });
  reviews.filter((r) => r.type === "shop_drawing").forEach((r) => {
    if (grouped[r.status]) grouped[r.status].push(r);
    else grouped["received"].push(r);
  });

  if (loading) return <AppShell><div className="p-8 text-gray-400">Loading…</div></AppShell>;

  return (
    <AppShell>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-ink">Shop Drawing Reviews</h1>
          <button onClick={() => setShowNew(true)} className="btn-primary text-sm">+ New submission</button>
        </div>

        {/* Gate E note */}
        <div className="bg-amber-50 border border-amber-200 rounded px-4 py-2 text-sm text-amber-700">
          Gate E must be activated before submissions are considered final.
        </div>

        {/* Kanban Board */}
        <div className="flex gap-3 overflow-x-auto pb-4">
          {KANBAN_COLUMNS.map((col) => (
            <div key={col.key} className="min-w-[240px] flex-shrink-0">
              <div className="flex items-center justify-between mb-2 px-1">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{col.label}</span>
                <span className="text-xs text-gray-400">{grouped[col.key].length}</span>
              </div>
              <div className="space-y-2 min-h-[120px] bg-cream/30 rounded p-2">
                {grouped[col.key].length === 0 && (
                  <p className="text-xs text-gray-300 text-center py-6">No items</p>
                )}
                {grouped[col.key].map((r) => (
                  <button
                    key={r.id}
                    onClick={() => { setSelected(r); setDetailTab("docs"); }}
                    className="card p-3 w-full text-left hover:shadow-md transition-shadow cursor-pointer"
                  >
                    <p className="text-sm font-medium text-ink truncate">{r.title}</p>
                    {r.packageName && <p className="text-xs text-gray-500 mt-0.5">{r.packageName}</p>}
                    {r.contractor && <p className="text-xs text-gray-400">{r.contractor}</p>}
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-[10px] text-gray-400">{new Date(r.submissionDate).toLocaleDateString()}</span>
                      {r.isOverdue && <span className="text-[10px] text-[#B04A3A] font-semibold">OVERDUE</span>}
                      {r.deviationCount > 0 && (
                        <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">{r.deviationCount} dev</span>
                      )}
                    </div>
                    {r.reviewerName && <p className="text-[10px] text-gray-400 mt-1">Reviewer: {r.reviewerName}</p>}
                    {r.reviewOutcome && (
                      <span className={`inline-block text-[10px] px-1.5 py-0.5 rounded mt-1 ${OUTCOME_LABELS[r.reviewOutcome]?.cls || "bg-gray-100"}`}>
                        {OUTCOME_LABELS[r.reviewOutcome]?.label || r.reviewOutcome}
                      </span>
                    )}
                  </button>
                ))}
              </div>
              {/* Quick advance */}
              {col.key !== "closed" && grouped[col.key].length > 0 && (
                <div className="mt-1 text-right">
                  <button
                    onClick={() => {
                      const nextIdx = KANBAN_COLUMNS.findIndex((c) => c.key === col.key) + 1;
                      if (nextIdx < KANBAN_COLUMNS.length) {
                        grouped[col.key].forEach((r) => updateStatus(r.id, KANBAN_COLUMNS[nextIdx].key));
                      }
                    }}
                    className="text-[10px] text-bronze hover:underline"
                  >
                    Move all →
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ── New Submission Modal ── */}
      <Modal open={showNew} onClose={() => setShowNew(false)} title="New Shop Drawing Submission">
        <div className="space-y-3 text-sm">
          <div>
            <label className="text-xs text-gray-500">Drawing title *</label>
            <input className="input mt-1 w-full" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500">Package</label>
              <input className="input mt-1 w-full" value={form.packageName} onChange={(e) => setForm({ ...form, packageName: e.target.value })} />
            </div>
            <div>
              <label className="text-xs text-gray-500">Contractor</label>
              <input className="input mt-1 w-full" value={form.contractor} onChange={(e) => setForm({ ...form, contractor: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500">Submitted by *</label>
              <input className="input mt-1 w-full" value={form.submittedBy} onChange={(e) => setForm({ ...form, submittedBy: e.target.value })} />
            </div>
            <div>
              <label className="text-xs text-gray-500">Submission date *</label>
              <input type="date" className="input mt-1 w-full" value={form.submissionDate} onChange={(e) => setForm({ ...form, submissionDate: e.target.value })} />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={() => setShowNew(false)} className="btn-secondary text-sm">Cancel</button>
            <button onClick={createSubmission} className="btn-primary text-sm" disabled={!form.title.trim() || !form.submittedBy || !form.submissionDate}>
              Create
            </button>
          </div>
        </div>
      </Modal>

      {/* ── Detail Modal ── */}
      <Modal open={!!selected} onClose={() => setSelected(null)} title={selected?.title || ""}>
        {selected && (
          <div className="space-y-4 text-sm">
            {/* Meta */}
            <div className="grid grid-cols-3 gap-2 text-xs text-gray-500">
              <div>
                <span className="block text-[10px] text-gray-400 uppercase">Package</span>
                {selected.packageName || "—"}
              </div>
              <div>
                <span className="block text-[10px] text-gray-400 uppercase">Contractor</span>
                {selected.contractor || "—"}
              </div>
              <div>
                <span className="block text-[10px] text-gray-400 uppercase">Status</span>
                {KANBAN_COLUMNS.find((c) => c.key === selected.status)?.label || selected.status}
              </div>
            </div>

            {/* Status advance */}
            {selected.status !== "closed" && (
              <div className="flex gap-1 flex-wrap">
                {KANBAN_COLUMNS.filter((c) => c.key !== selected.status).map((c) => (
                  <button
                    key={c.key}
                    onClick={() => { updateStatus(selected.id, c.key); setSelected({ ...selected, status: c.key }); }}
                    className="text-[10px] border border-card-border rounded px-2 py-1 hover:bg-cream/50"
                  >
                    → {c.label}
                  </button>
                ))}
              </div>
            )}

            {/* Tabs */}
            <div className="flex gap-4 border-b border-card-border">
              {(["docs", "deviations", "review"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setDetailTab(t)}
                  className={`pb-2 text-xs font-medium capitalize ${detailTab === t ? "text-bronze border-b-2 border-bronze" : "text-gray-400"}`}
                >
                  {t === "docs" ? "Documents" : t === "deviations" ? `Deviation Log (${selected.deviationCount})` : "Review Record"}
                </button>
              ))}
            </div>

            {/* Tab content */}
            {detailTab === "docs" && (
              <div className="text-xs text-gray-400 py-4 text-center">
                Document attachments will appear here when file uploads are configured.
              </div>
            )}

            {detailTab === "deviations" && (
              <div className="space-y-3">
                {(selected.deviations || []).length === 0 ? (
                  <p className="text-xs text-gray-400 py-4 text-center">No deviations logged.</p>
                ) : (
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-card-border">
                        <th className="text-left px-2 py-1 text-gray-400">#</th>
                        <th className="text-left px-2 py-1 text-gray-400">Description</th>
                        <th className="text-left px-2 py-1 text-gray-400">Severity</th>
                        <th className="text-left px-2 py-1 text-gray-400">Design</th>
                        <th className="text-left px-2 py-1 text-gray-400">Technical</th>
                        <th className="text-left px-2 py-1 text-gray-400">Schedule</th>
                        <th className="text-left px-2 py-1 text-gray-400">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(selected.deviations || []).map((d, i) => (
                        <tr key={i} className="border-b border-card-border/40">
                          <td className="px-2 py-1.5">{d.itemNo}</td>
                          <td className="px-2 py-1.5 max-w-[200px] truncate">{d.description}</td>
                          <td className="px-2 py-1.5">
                            <span className={`px-1.5 py-0.5 rounded ${SEVERITY_LABELS[d.severity]?.cls || "bg-gray-100"}`}>
                              {SEVERITY_LABELS[d.severity]?.label || d.severity}
                            </span>
                          </td>
                          <td className="px-2 py-1.5">{d.designImpact || "—"}</td>
                          <td className="px-2 py-1.5">{d.technicalImpact || "—"}</td>
                          <td className="px-2 py-1.5">{d.scheduleImpact || "—"}</td>
                          <td className="px-2 py-1.5 capitalize">{d.status}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}

                {!showAddDeviation ? (
                  <button onClick={() => setShowAddDeviation(true)} className="text-xs text-bronze hover:underline">+ Add deviation</button>
                ) : (
                  <div className="border border-card-border rounded p-3 space-y-2 bg-cream/30">
                    <div>
                      <label className="text-[10px] text-gray-400">Description *</label>
                      <input className="input mt-0.5 w-full text-xs" value={devForm.description} onChange={(e) => setDevForm({ ...devForm, description: e.target.value })} />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] text-gray-400">Severity</label>
                        <select className="input mt-0.5 w-full text-xs" value={devForm.severity} onChange={(e) => setDevForm({ ...devForm, severity: e.target.value })}>
                          <option value="minor">Minor</option>
                          <option value="major">Major</option>
                          <option value="critical">Critical</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] text-gray-400">Status</label>
                        <select className="input mt-0.5 w-full text-xs" value={devForm.status} onChange={(e) => setDevForm({ ...devForm, status: e.target.value })}>
                          <option value="open">Open</option>
                          <option value="resolved">Resolved</option>
                        </select>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="text-[10px] text-gray-400">Design impact</label>
                        <input className="input mt-0.5 w-full text-xs" value={devForm.designImpact} onChange={(e) => setDevForm({ ...devForm, designImpact: e.target.value })} />
                      </div>
                      <div>
                        <label className="text-[10px] text-gray-400">Technical impact</label>
                        <input className="input mt-0.5 w-full text-xs" value={devForm.technicalImpact} onChange={(e) => setDevForm({ ...devForm, technicalImpact: e.target.value })} />
                      </div>
                      <div>
                        <label className="text-[10px] text-gray-400">Schedule impact</label>
                        <input className="input mt-0.5 w-full text-xs" value={devForm.scheduleImpact} onChange={(e) => setDevForm({ ...devForm, scheduleImpact: e.target.value })} />
                      </div>
                    </div>
                    <div className="flex justify-end gap-2">
                      <button onClick={() => setShowAddDeviation(false)} className="text-xs text-gray-400">Cancel</button>
                      <button onClick={() => addDeviation(selected.id)} className="btn-primary text-xs" disabled={!devForm.description.trim()}>Add</button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {detailTab === "review" && (
              <div className="space-y-3">
                {selected.reviewOutcome && (
                  <div className="bg-cream/50 border border-card-border rounded p-3 space-y-1">
                    <p className="text-xs text-gray-400">Previous review</p>
                    <span className={`inline-block text-xs px-2 py-0.5 rounded ${OUTCOME_LABELS[selected.reviewOutcome]?.cls || "bg-gray-100"}`}>
                      {OUTCOME_LABELS[selected.reviewOutcome]?.label || selected.reviewOutcome}
                    </span>
                    {selected.reviewComment && <p className="text-xs text-gray-600 mt-1">{selected.reviewComment}</p>}
                    {selected.reviewDate && <p className="text-[10px] text-gray-400">{new Date(selected.reviewDate).toLocaleString()}</p>}
                  </div>
                )}

                {selected.status !== "closed" && (
                  <div className="space-y-2 border border-card-border rounded p-3">
                    <label className="text-xs font-medium text-gray-500">Submit Review</label>
                    <select className="input w-full text-xs" value={reviewOutcome} onChange={(e) => setReviewOutcome(e.target.value)}>
                      <option value="">Select outcome…</option>
                      <option value="approved">Approved</option>
                      <option value="approved_with_comments">Approved with Comments</option>
                      <option value="resubmission_required">Resubmission Required</option>
                      <option value="rejected">Rejected</option>
                    </select>
                    <textarea
                      className="input w-full text-xs"
                      placeholder="Review comments…"
                      rows={3}
                      value={reviewComment}
                      onChange={(e) => setReviewComment(e.target.value)}
                    />
                    <div className="flex justify-end">
                      <button onClick={() => submitReview(selected.id)} className="btn-primary text-xs" disabled={!reviewOutcome}>
                        Submit review
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </Modal>
    </AppShell>
  );
}
