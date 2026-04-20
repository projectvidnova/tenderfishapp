"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import AppShell from "@/components/layout/AppShell";
import { Modal } from "@/components/ui/Modal";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

const APPROVAL_TYPES = [
  { value: "client", label: "Client" },
  { value: "internal", label: "Internal" },
  { value: "technical", label: "Technical" },
  { value: "material", label: "Material" },
  { value: "package_release", label: "Package Release" },
  { value: "tender_release", label: "Tender Release" },
  { value: "execution_release", label: "Execution Release" },
  { value: "closeout", label: "Closeout" },
] as const;

type Approval = {
  id: string;
  name: string;
  type: string;
  status: string;
  requestedBy: string;
  requestedByName: string | null;
  approverUserId: string | null;
  approverName: string | null;
  dueDate: string | null;
  approvedAt: string | null;
  notes: string | null;
  relatedGate: string | null;
  relatedPhaseId: string | null;
  createdAt: string;
};

const STATUS_STYLES: Record<string, { label: string; cls: string }> = {
  pending: { label: "Pending", cls: "bg-bg-inset text-text-tertiary border-border" },
  in_review: { label: "In Review", cls: "bg-status-warning-bg text-brand-orange border-status-warning-border" },
  approved: { label: "Approved", cls: "bg-status-success-bg text-status-approve border-status-success-border" },
  rejected: { label: "Rejected", cls: "bg-status-danger-bg text-status-reject border-status-danger-border" },
  overdue: { label: "Overdue", cls: "bg-status-danger-bg text-status-danger-fg border-status-danger-border" },
};

export default function ApprovalsPage() {
  const { id } = useParams() as { id: string };
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [activeType, setActiveType] = useState("all");
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showDetail, setShowDetail] = useState<Approval | null>(null);
  const [newApproval, setNewApproval] = useState({ name: "", type: "client", dueDate: "", notes: "" });
  const [reviewNotes, setReviewNotes] = useState("");

  const fetchApprovals = useCallback(async () => {
    try {
      const params = activeType !== "all" ? `?type=${activeType}` : "";
      const res = await fetch(`${API}/api/projects/${id}/approvals${params}`, { credentials: "include" });
      if (res.ok) setApprovals((await res.json()).data);
    } catch { /* ignore */ }
    setLoading(false);
  }, [id, activeType]);

  useEffect(() => { fetchApprovals(); }, [fetchApprovals]);

  async function createApproval() {
    if (!newApproval.name.trim() || !newApproval.type) return;
    await fetch(`${API}/api/projects/${id}/approvals`, {
      credentials: "include",
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: newApproval.name.trim(),
        type: newApproval.type,
        dueDate: newApproval.dueDate || undefined,
        notes: newApproval.notes || undefined,
      }),
    });
    setNewApproval({ name: "", type: "client", dueDate: "", notes: "" });
    setShowCreate(false);
    fetchApprovals();
  }

  async function updateApprovalStatus(approvalId: string, status: string, notes?: string) {
    await fetch(`${API}/api/projects/${id}/approvals/${approvalId}`, {
      credentials: "include",
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, notes }),
    });
    setShowDetail(null);
    setReviewNotes("");
    fetchApprovals();
  }

  if (loading) {
    return (
      <AppShell>
        <div className="flex items-center justify-center h-64 text-text-quaternary text-sm">Loading approvals…</div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-text-primary">Approvals</h1>
          <button className="btn-primary text-sm" onClick={() => setShowCreate(true)}>Request approval</button>
        </div>

        {/* Type tabs */}
        <div className="flex gap-1 overflow-x-auto border-b border-border">
          <button
            onClick={() => setActiveType("all")}
            className={`px-3 py-2 text-xs font-medium border-b-2 transition-colors whitespace-nowrap ${
              activeType === "all" ? "border-brand-orange text-text-primary" : "border-transparent text-text-quaternary hover:text-text-secondary"
            }`}
          >
            All
          </button>
          {APPROVAL_TYPES.map((t) => (
            <button
              key={t.value}
              onClick={() => setActiveType(t.value)}
              className={`px-3 py-2 text-xs font-medium border-b-2 transition-colors whitespace-nowrap ${
                activeType === t.value ? "border-brand-orange text-text-primary" : "border-transparent text-text-quaternary hover:text-text-secondary"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Table */}
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-bg-inset/30">
                <th className="text-left px-4 py-2 text-xs font-medium text-text-tertiary uppercase tracking-wide">Approval</th>
                <th className="text-left px-4 py-2 text-xs font-medium text-text-tertiary uppercase tracking-wide w-24">Type</th>
                <th className="text-left px-4 py-2 text-xs font-medium text-text-tertiary uppercase tracking-wide w-28">Requested By</th>
                <th className="text-left px-4 py-2 text-xs font-medium text-text-tertiary uppercase tracking-wide w-24">Date</th>
                <th className="text-left px-4 py-2 text-xs font-medium text-text-tertiary uppercase tracking-wide w-28">Approver</th>
                <th className="text-left px-4 py-2 text-xs font-medium text-text-tertiary uppercase tracking-wide w-24">Due</th>
                <th className="text-left px-4 py-2 text-xs font-medium text-text-tertiary uppercase tracking-wide w-24">Status</th>
                <th className="text-left px-4 py-2 text-xs font-medium text-text-tertiary uppercase tracking-wide w-24">Action</th>
              </tr>
            </thead>
            <tbody>
              {approvals.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-text-quaternary">No approvals found.</td></tr>
              ) : approvals.map((a) => {
                const style = STATUS_STYLES[a.status] || STATUS_STYLES.pending;
                return (
                  <tr key={a.id} className="border-b border-border last:border-0 hover:bg-bg-inset/20">
                    <td className="px-4 py-3 font-medium text-text-primary">{a.name}</td>
                    <td className="px-4 py-3 text-xs text-text-tertiary capitalize">{a.type.replace(/_/g, " ")}</td>
                    <td className="px-4 py-3 text-xs text-text-tertiary">{a.requestedByName || "—"}</td>
                    <td className="px-4 py-3 text-xs text-text-tertiary font-mono">{a.createdAt ? new Date(a.createdAt).toLocaleDateString() : "—"}</td>
                    <td className="px-4 py-3 text-xs text-text-tertiary">{a.approverName || "—"}</td>
                    <td className="px-4 py-3 text-xs text-text-tertiary font-mono">{a.dueDate || "—"}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-sm border ${style.cls}`}>
                        {style.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => { setShowDetail(a); setReviewNotes(a.notes || ""); }}
                        className="text-xs text-brand-orange hover:text-brand-orange-dark font-medium"
                      >
                        {a.status === "pending" || a.status === "in_review" ? "Review" : "View"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Create Approval Modal */}
        <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Request Approval">
          <div className="space-y-4">
            <div>
              <label className="label">Name</label>
              <input
                className="input"
                value={newApproval.name}
                onChange={(e) => setNewApproval({ ...newApproval, name: e.target.value })}
                placeholder="Approval name…"
              />
            </div>
            <div>
              <label className="label">Type</label>
              <select
                className="input"
                value={newApproval.type}
                onChange={(e) => setNewApproval({ ...newApproval, type: e.target.value })}
              >
                {APPROVAL_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Due Date</label>
              <input
                type="date"
                className="input"
                value={newApproval.dueDate}
                onChange={(e) => setNewApproval({ ...newApproval, dueDate: e.target.value })}
              />
            </div>
            <div>
              <label className="label">Notes</label>
              <textarea
                className="input"
                rows={3}
                value={newApproval.notes}
                onChange={(e) => setNewApproval({ ...newApproval, notes: e.target.value })}
              />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button className="btn-secondary" onClick={() => setShowCreate(false)}>Cancel</button>
              <button className="btn-primary" onClick={createApproval} disabled={!newApproval.name.trim()}>Submit</button>
            </div>
          </div>
        </Modal>

        {/* Detail / Review Modal */}
        <Modal
          open={!!showDetail}
          onClose={() => { setShowDetail(null); setReviewNotes(""); }}
          title={showDetail ? `${showDetail.name}` : ""}
          width="max-w-xl"
        >
          {showDetail && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-text-tertiary text-xs">Type</span>
                  <p className="capitalize">{showDetail.type.replace(/_/g, " ")}</p>
                </div>
                <div>
                  <span className="text-text-tertiary text-xs">Status</span>
                  <p>
                    <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-sm border ${(STATUS_STYLES[showDetail.status] || STATUS_STYLES.pending).cls}`}>
                      {(STATUS_STYLES[showDetail.status] || STATUS_STYLES.pending).label}
                    </span>
                  </p>
                </div>
                <div>
                  <span className="text-text-tertiary text-xs">Requested By</span>
                  <p>{showDetail.requestedByName || "—"}</p>
                </div>
                <div>
                  <span className="text-text-tertiary text-xs">Approver</span>
                  <p>{showDetail.approverName || "Not assigned"}</p>
                </div>
                <div>
                  <span className="text-text-tertiary text-xs">Due Date</span>
                  <p className="font-mono">{showDetail.dueDate || "—"}</p>
                </div>
                {showDetail.relatedGate && (
                  <div>
                    <span className="text-text-tertiary text-xs">Related Gate</span>
                    <p>Gate {showDetail.relatedGate}</p>
                  </div>
                )}
              </div>

              {/* Review area */}
              {(showDetail.status === "pending" || showDetail.status === "in_review") && (
                <>
                  <div>
                    <label className="label">Review Comments</label>
                    <textarea
                      className="input"
                      rows={3}
                      value={reviewNotes}
                      onChange={(e) => setReviewNotes(e.target.value)}
                      placeholder="Add review comments…"
                    />
                  </div>
                  <div className="flex items-center gap-3 pt-2">
                    <button
                      className="bg-status-approve text-white px-4 py-2 text-sm font-medium rounded-button hover:opacity-90 transition-opacity"
                      onClick={() => updateApprovalStatus(showDetail.id, "approved", reviewNotes)}
                    >
                      Approve
                    </button>
                    <button
                      className="bg-status-reject text-white px-4 py-2 text-sm font-medium rounded-button hover:opacity-90 transition-opacity"
                      onClick={() => updateApprovalStatus(showDetail.id, "rejected", reviewNotes)}
                    >
                      Reject
                    </button>
                    <button
                      className="btn-secondary text-sm"
                      onClick={() => updateApprovalStatus(showDetail.id, "pending", reviewNotes)}
                    >
                      Request Clarification
                    </button>
                  </div>
                </>
              )}

              {showDetail.status === "approved" && showDetail.approvedAt && (
                <div className="bg-status-success-light border border-green-200 rounded-xl px-4 py-3 text-sm text-status-success-fg">
                  Approved on {new Date(showDetail.approvedAt).toLocaleDateString()}
                  {showDetail.notes && <p className="mt-1 text-xs">{showDetail.notes}</p>}
                </div>
              )}

              {showDetail.status === "rejected" && (
                <div className="bg-status-danger-light border border-status-danger-border rounded-xl px-4 py-3 text-sm text-status-danger-fg">
                  Rejected {showDetail.notes && <span>— {showDetail.notes}</span>}
                </div>
              )}
            </div>
          )}
        </Modal>
      </div>
    </AppShell>
  );
}
