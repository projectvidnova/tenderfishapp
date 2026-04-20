"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import AppShell from "@/components/layout/AppShell";
import { Modal } from "@/components/ui/Modal";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

type View = "submissions" | "queue" | "accepted" | "punch" | "invoicing";

const VIEWS: { key: View; label: string }[] = [
  { key: "submissions", label: "Submissions" },
  { key: "queue", label: "Review Queue" },
  { key: "accepted", label: "Accepted" },
  { key: "punch", label: "Punch List" },
  { key: "invoicing", label: "Invoicing Ready" },
];

const REVIEW_OUTCOMES = [
  { value: "accepted", label: "Accepted" },
  { value: "partially_accepted", label: "Partially Accepted" },
  { value: "rejected", label: "Rejected" },
  { value: "rework_required", label: "Rework Required" },
  { value: "moved_to_punch_list", label: "Moved to Punch List" },
  { value: "requires_clarification", label: "Requires Clarification" },
];

const OUTCOME_STYLE: Record<string, string> = {
  accepted: "bg-status-emerald-bg text-status-emerald-fg",
  approved: "bg-status-emerald-bg text-status-emerald-fg",
  approved_with_comments: "bg-status-info-bg text-status-info-fg",
  partially_accepted: "bg-status-info-bg text-status-info-fg",
  rejected: "bg-status-danger-bg text-status-reject",
  rework_required: "bg-status-warning-bg text-status-warning-fg",
  moved_to_punch_list: "bg-status-purple-bg text-status-purple-fg",
  requires_clarification: "bg-bg-inset text-text-secondary",
};

const PUNCH_STATUS: Record<string, { label: string; cls: string }> = {
  open: { label: "Open", cls: "bg-status-danger-bg text-status-reject" },
  in_progress: { label: "In Progress", cls: "bg-status-info-bg text-status-info-fg" },
  closed: { label: "Closed", cls: "bg-status-emerald-bg text-status-emerald-fg" },
};

interface Submission {
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
  deviations: unknown[];
  createdAt: string;
}

/* Punch list items stored in local state (no DB table for punch yet) */
interface PunchItem {
  id: string;
  description: string;
  fromSubmission: string;
  packageName: string;
  contractor: string;
  status: string;
  targetDate: string;
  owner: string;
}

export default function ExecutionPage() {
  const { id } = useParams() as { id: string };
  const [view, setView] = useState<View>("submissions");
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);

  /* Modals */
  const [showNew, setShowNew] = useState(false);
  const [selected, setSelected] = useState<Submission | null>(null);

  /* New form */
  const [form, setForm] = useState({
    title: "", packageName: "", contractor: "", submittedBy: "",
    submissionDate: "", description: "", completionPct: 0,
  });

  /* Review form */
  const [outcome, setOutcome] = useState("");
  const [comment, setComment] = useState("");

  /* Punch list (local state for now) */
  const [punchItems, setPunchItems] = useState<PunchItem[]>([]);
  const [showAddPunch, setShowAddPunch] = useState(false);
  const [punchForm, setPunchForm] = useState({ description: "", packageName: "", contractor: "", targetDate: "", owner: "" });

  const fetchSubmissions = useCallback(async () => {
    const res = await fetch(`${API}/api/projects/${id}/execution`, { credentials: "include" });
    const json = await res.json();
    setSubmissions(json.data || []);
    setLoading(false);
  }, [id]);

  useEffect(() => { fetchSubmissions(); }, [fetchSubmissions]);

  async function createSubmission() {
    if (!form.title.trim() || !form.submittedBy || !form.submissionDate) return;
    await fetch(`${API}/api/projects/${id}/execution`, {
      credentials: "include",
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: form.title,
        packageName: form.packageName,
        contractor: form.contractor,
        submittedBy: form.submittedBy,
        submissionDate: form.submissionDate,
      }),
    });
    setForm({ title: "", packageName: "", contractor: "", submittedBy: "", submissionDate: "", description: "", completionPct: 0 });
    setShowNew(false);
    fetchSubmissions();
  }

  async function submitReviewAction(submissionId: string) {
    if (!outcome) return;
    await fetch(`${API}/api/projects/${id}/execution/${submissionId}`, {
      credentials: "include",
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        reviewOutcome: outcome === "accepted" ? "approved" : outcome === "partially_accepted" ? "approved_with_comments" : outcome,
        reviewComment: comment,
      }),
    });
    // If moved to punch list, add an item
    if (outcome === "moved_to_punch_list") {
      const s = submissions.find((x) => x.id === submissionId);
      setPunchItems((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          description: s?.title || "Punch item",
          fromSubmission: submissionId,
          packageName: s?.packageName || "",
          contractor: s?.contractor || "",
          status: "open",
          targetDate: "",
          owner: "",
        },
      ]);
    }
    setOutcome(""); setComment("");
    setSelected(null);
    fetchSubmissions();
  }

  function addPunchItem() {
    if (!punchForm.description.trim()) return;
    setPunchItems((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        description: punchForm.description,
        fromSubmission: "",
        packageName: punchForm.packageName,
        contractor: punchForm.contractor,
        status: "open",
        targetDate: punchForm.targetDate,
        owner: punchForm.owner,
      },
    ]);
    setPunchForm({ description: "", packageName: "", contractor: "", targetDate: "", owner: "" });
    setShowAddPunch(false);
  }

  /* Computed views */
  const queueItems = submissions.filter((s) => s.status !== "closed");
  const acceptedItems = submissions.filter((s) => s.reviewOutcome === "approved" || s.reviewOutcome === "approved_with_comments");
  const invoicingItems = acceptedItems; // Same for now — confirmed by admin

  if (loading) return <AppShell><div className="p-8 text-text-quaternary">Loading…</div></AppShell>;

  return (
    <AppShell>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-text-primary">Execution Tracking</h1>
          <button onClick={() => setShowNew(true)} className="btn-primary text-sm">+ New submission</button>
        </div>

        {/* Warning */}
        <div className="bg-status-warning-light border border-status-warning-border rounded px-4 py-2 text-sm text-status-warning-fg">
          Execution evidence confirmation does not constitute formal acceptance, invoice approval, or commercial release.
        </div>

        {/* View toggle */}
        <div className="flex gap-1 bg-bg-inset/50 rounded p-0.5 w-fit">
          {VIEWS.map((v) => (
            <button
              key={v.key}
              onClick={() => setView(v.key)}
              className={`px-3 py-1.5 text-xs rounded transition-colors ${view === v.key ? "bg-white text-text-primary shadow-sm font-medium" : "text-text-tertiary hover:text-text-primary"}`}
            >
              {v.label}
              {v.key === "queue" && <span className="ml-1 text-text-quaternary">({queueItems.length})</span>}
              {v.key === "accepted" && <span className="ml-1 text-text-quaternary">({acceptedItems.length})</span>}
              {v.key === "punch" && <span className="ml-1 text-text-quaternary">({punchItems.length})</span>}
            </button>
          ))}
        </div>

        {/* ── Submissions view ── */}
        {view === "submissions" && (
          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-bg-inset/50">
                  <th className="text-left px-4 py-3 text-xs font-medium text-text-tertiary uppercase">Date</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-text-tertiary uppercase">Contractor</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-text-tertiary uppercase">Package</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-text-tertiary uppercase">Description</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-text-tertiary uppercase">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-text-tertiary uppercase">Reviewer</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-text-tertiary uppercase">Action</th>
                </tr>
              </thead>
              <tbody>
                {submissions.length === 0 ? (
                  <tr><td colSpan={7} className="px-4 py-8 text-center text-text-quaternary">No execution submissions yet.</td></tr>
                ) : (
                  submissions.map((s) => (
                    <tr key={s.id} className="border-b border-border/40 hover:bg-bg-inset/30">
                      <td className="px-4 py-3 text-xs">{new Date(s.submissionDate).toLocaleDateString()}</td>
                      <td className="px-4 py-3 text-xs">{s.contractor || "—"}</td>
                      <td className="px-4 py-3 text-xs">{s.packageName || "—"}</td>
                      <td className="px-4 py-3 text-xs max-w-[200px] truncate">{s.title}</td>
                      <td className="px-4 py-3">
                        {s.reviewOutcome ? (
                          <span className={`text-[10px] px-2 py-0.5 rounded ${OUTCOME_STYLE[s.reviewOutcome] || "bg-bg-inset"}`}>
                            {s.reviewOutcome.replace(/_/g, " ")}
                          </span>
                        ) : (
                          <span className="text-[10px] px-2 py-0.5 rounded bg-status-info-light text-status-info-fg">{s.status.replace(/_/g, " ")}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs">{s.reviewerName || "—"}</td>
                      <td className="px-4 py-3">
                        <button onClick={() => setSelected(s)} className="text-xs text-brand-orange hover:underline">View</button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* ── Review Queue ── */}
        {view === "queue" && (
          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-bg-inset/50">
                  <th className="text-left px-4 py-3 text-xs font-medium text-text-tertiary uppercase">Title</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-text-tertiary uppercase">Package</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-text-tertiary uppercase">Contractor</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-text-tertiary uppercase">Submitted</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-text-tertiary uppercase">Due</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-text-tertiary uppercase">Action</th>
                </tr>
              </thead>
              <tbody>
                {queueItems.length === 0 ? (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-text-quaternary">No items in review queue.</td></tr>
                ) : (
                  queueItems.map((s) => (
                    <tr key={s.id} className="border-b border-border/40 hover:bg-bg-inset/30">
                      <td className="px-4 py-3 text-xs font-medium">{s.title}</td>
                      <td className="px-4 py-3 text-xs">{s.packageName || "—"}</td>
                      <td className="px-4 py-3 text-xs">{s.contractor || "—"}</td>
                      <td className="px-4 py-3 text-xs">{new Date(s.submissionDate).toLocaleDateString()}</td>
                      <td className="px-4 py-3 text-xs">
                        {s.reviewDueDate ? (
                          <span className={new Date(s.reviewDueDate) < new Date() ? "text-status-reject font-semibold" : ""}>
                            {new Date(s.reviewDueDate).toLocaleDateString()}
                          </span>
                        ) : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <button onClick={() => setSelected(s)} className="text-xs text-brand-orange hover:underline">Review</button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* ── Accepted ── */}
        {view === "accepted" && (
          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-bg-inset/50">
                  <th className="text-left px-4 py-3 text-xs font-medium text-text-tertiary uppercase">Title</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-text-tertiary uppercase">Package</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-text-tertiary uppercase">Outcome</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-text-tertiary uppercase">Reviewed</th>
                </tr>
              </thead>
              <tbody>
                {acceptedItems.length === 0 ? (
                  <tr><td colSpan={4} className="px-4 py-8 text-center text-text-quaternary">No accepted items yet.</td></tr>
                ) : (
                  acceptedItems.map((s) => (
                    <tr key={s.id} className="border-b border-border/40">
                      <td className="px-4 py-3 text-xs font-medium">{s.title}</td>
                      <td className="px-4 py-3 text-xs">{s.packageName || "—"}</td>
                      <td className="px-4 py-3">
                        <span className={`text-[10px] px-2 py-0.5 rounded ${OUTCOME_STYLE[s.reviewOutcome || ""] || "bg-bg-inset"}`}>
                          {(s.reviewOutcome || "").replace(/_/g, " ")}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs">{s.reviewDate ? new Date(s.reviewDate).toLocaleDateString() : "—"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* ── Punch List ── */}
        {view === "punch" && (
          <div className="space-y-3">
            <div className="flex justify-end">
              <button onClick={() => setShowAddPunch(true)} className="text-xs text-brand-orange hover:underline">+ Add punch item</button>
            </div>
            <div className="card overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-bg-inset/50">
                    <th className="text-left px-4 py-3 text-xs font-medium text-text-tertiary uppercase">Item</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-text-tertiary uppercase">Package</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-text-tertiary uppercase">Contractor</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-text-tertiary uppercase">Status</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-text-tertiary uppercase">Target</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-text-tertiary uppercase">Owner</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-text-tertiary uppercase">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {punchItems.length === 0 ? (
                    <tr><td colSpan={7} className="px-4 py-8 text-center text-text-quaternary">No punch list items.</td></tr>
                  ) : (
                    punchItems.map((p) => (
                      <tr key={p.id} className="border-b border-border/40">
                        <td className="px-4 py-3 text-xs">{p.description}</td>
                        <td className="px-4 py-3 text-xs">{p.packageName || "—"}</td>
                        <td className="px-4 py-3 text-xs">{p.contractor || "—"}</td>
                        <td className="px-4 py-3">
                          <span className={`text-[10px] px-2 py-0.5 rounded ${PUNCH_STATUS[p.status]?.cls || "bg-bg-inset"}`}>
                            {PUNCH_STATUS[p.status]?.label || p.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs">{p.targetDate || "—"}</td>
                        <td className="px-4 py-3 text-xs">{p.owner || "—"}</td>
                        <td className="px-4 py-3">
                          <select
                            className="text-[10px] border border-border rounded px-1 py-0.5"
                            value={p.status}
                            onChange={(e) => setPunchItems((prev) => prev.map((x) => x.id === p.id ? { ...x, status: e.target.value } : x))}
                          >
                            <option value="open">Open</option>
                            <option value="in_progress">In Progress</option>
                            <option value="closed">Closed</option>
                          </select>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── Invoicing Ready ── */}
        {view === "invoicing" && (
          <div className="space-y-3">
            <div className="card overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-bg-inset/50">
                    <th className="text-left px-4 py-3 text-xs font-medium text-text-tertiary uppercase">Title</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-text-tertiary uppercase">Package</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-text-tertiary uppercase">Contractor</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-text-tertiary uppercase">Accepted</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-text-tertiary uppercase">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {invoicingItems.length === 0 ? (
                    <tr><td colSpan={5} className="px-4 py-8 text-center text-text-quaternary">No items ready for invoicing.</td></tr>
                  ) : (
                    invoicingItems.map((s) => (
                      <tr key={s.id} className="border-b border-border/40">
                        <td className="px-4 py-3 text-xs font-medium">{s.title}</td>
                        <td className="px-4 py-3 text-xs">{s.packageName || "—"}</td>
                        <td className="px-4 py-3 text-xs">{s.contractor || "—"}</td>
                        <td className="px-4 py-3 text-xs">{s.reviewDate ? new Date(s.reviewDate).toLocaleDateString() : "—"}</td>
                        <td className="px-4 py-3">
                          <button className="text-xs bg-status-emerald-bg text-status-emerald-fg px-2 py-1 rounded hover:bg-status-emerald-bg">
                            Confirm ready
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <p className="text-[10px] text-text-quaternary">Confirming &quot;Ready for Invoicing&quot; requires Architect Admin or Client Admin role.</p>
          </div>
        )}
      </div>

      {/* ── New Submission Modal ── */}
      <Modal open={showNew} onClose={() => setShowNew(false)} title="New Execution Submission">
        <div className="space-y-3 text-sm">
          <div>
            <label className="text-xs text-text-tertiary">Title / Description *</label>
            <input className="input mt-1 w-full" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-text-tertiary">Package / Trade</label>
              <input className="input mt-1 w-full" value={form.packageName} onChange={(e) => setForm({ ...form, packageName: e.target.value })} />
            </div>
            <div>
              <label className="text-xs text-text-tertiary">Contractor</label>
              <input className="input mt-1 w-full" value={form.contractor} onChange={(e) => setForm({ ...form, contractor: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-text-tertiary">Reported by *</label>
              <input className="input mt-1 w-full" value={form.submittedBy} onChange={(e) => setForm({ ...form, submittedBy: e.target.value })} />
            </div>
            <div>
              <label className="text-xs text-text-tertiary">Date *</label>
              <input type="date" className="input mt-1 w-full" value={form.submissionDate} onChange={(e) => setForm({ ...form, submissionDate: e.target.value })} />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={() => setShowNew(false)} className="btn-secondary text-sm">Cancel</button>
            <button onClick={createSubmission} className="btn-primary text-sm" disabled={!form.title.trim() || !form.submittedBy || !form.submissionDate}>
              Submit
            </button>
          </div>
        </div>
      </Modal>

      {/* ── Add Punch Item Modal ── */}
      <Modal open={showAddPunch} onClose={() => setShowAddPunch(false)} title="Add Punch Item">
        <div className="space-y-3 text-sm">
          <div>
            <label className="text-xs text-text-tertiary">Description *</label>
            <input className="input mt-1 w-full" value={punchForm.description} onChange={(e) => setPunchForm({ ...punchForm, description: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-text-tertiary">Package</label>
              <input className="input mt-1 w-full" value={punchForm.packageName} onChange={(e) => setPunchForm({ ...punchForm, packageName: e.target.value })} />
            </div>
            <div>
              <label className="text-xs text-text-tertiary">Contractor</label>
              <input className="input mt-1 w-full" value={punchForm.contractor} onChange={(e) => setPunchForm({ ...punchForm, contractor: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-text-tertiary">Target date</label>
              <input type="date" className="input mt-1 w-full" value={punchForm.targetDate} onChange={(e) => setPunchForm({ ...punchForm, targetDate: e.target.value })} />
            </div>
            <div>
              <label className="text-xs text-text-tertiary">Owner</label>
              <input className="input mt-1 w-full" value={punchForm.owner} onChange={(e) => setPunchForm({ ...punchForm, owner: e.target.value })} />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={() => setShowAddPunch(false)} className="btn-secondary text-sm">Cancel</button>
            <button onClick={addPunchItem} className="btn-primary text-sm" disabled={!punchForm.description.trim()}>Add</button>
          </div>
        </div>
      </Modal>

      {/* ── Submission Detail / Review Modal ── */}
      <Modal open={!!selected} onClose={() => setSelected(null)} title={selected?.title || "Submission Detail"}>
        {selected && (
          <div className="space-y-4 text-sm">
            <div className="grid grid-cols-3 gap-3 text-xs">
              <div>
                <span className="block text-[10px] text-text-quaternary uppercase">Package</span>
                {selected.packageName || "—"}
              </div>
              <div>
                <span className="block text-[10px] text-text-quaternary uppercase">Contractor</span>
                {selected.contractor || "—"}
              </div>
              <div>
                <span className="block text-[10px] text-text-quaternary uppercase">Submitted</span>
                {new Date(selected.submissionDate).toLocaleDateString()}
              </div>
            </div>

            {/* Previous review */}
            {selected.reviewOutcome && (
              <div className="bg-bg-inset/50 border border-border rounded p-3">
                <p className="text-[10px] text-text-quaternary mb-1">Review outcome</p>
                <span className={`text-xs px-2 py-0.5 rounded ${OUTCOME_STYLE[selected.reviewOutcome] || "bg-bg-inset"}`}>
                  {selected.reviewOutcome.replace(/_/g, " ")}
                </span>
                {selected.reviewComment && <p className="text-xs text-text-secondary mt-1">{selected.reviewComment}</p>}
                {selected.reviewDate && <p className="text-[10px] text-text-quaternary mt-1">{new Date(selected.reviewDate).toLocaleString()}</p>}
              </div>
            )}

            {/* Review form */}
            {selected.status !== "closed" && (
              <div className="border border-border rounded p-3 space-y-2">
                <label className="text-xs font-medium text-text-tertiary">Submit Review</label>
                <select className="input w-full text-xs" value={outcome} onChange={(e) => setOutcome(e.target.value)}>
                  <option value="">Select outcome…</option>
                  {REVIEW_OUTCOMES.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
                <textarea
                  className="input w-full text-xs"
                  placeholder="Comment (required)…"
                  rows={3}
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                />
                <div className="flex justify-end">
                  <button
                    onClick={() => submitReviewAction(selected.id)}
                    className="btn-primary text-xs"
                    disabled={!outcome || !comment.trim()}
                  >
                    Submit review
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>
    </AppShell>
  );
}
