"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import AppShell from "@/components/layout/AppShell";
import { Modal } from "@/components/ui/Modal";
import { formatDate } from "@/lib/formatters";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

type Blocker = { description: string; gateRef?: string; resolved: boolean };
type Bidder = {
  id: string;
  company: string;
  contactName: string | null;
  email: string | null;
  invitedAt: string;
  returnDue: string | null;
  status: string;
  offerAmount: number | null;
  offerNotes: string | null;
  returnedAt: string | null;
  awardedAt: string | null;
};
type TenderPackage = {
  id: string;
  name: string;
  description: string | null;
  scope: string | null;
  procurementModel: string;
  leadName: string | null;
  targetTenderDate: string | null;
  readinessScore: number;
  tenderReady: boolean;
  invitationEnabled: boolean;
  blockers: Blocker[];
  bidderCount: number;
  returnedCount: number;
  awardedBidder: Bidder | null;
};

const MODEL_LABELS: Record<string, string> = {
  general_contractor: "General Contractor",
  single_trades: "Single Trades",
  unclear: "Unclear",
};

const BIDDER_STATUS: Record<string, { label: string; cls: string }> = {
  invited: { label: "Invited", cls: "bg-status-info-bg text-status-info-fg" },
  pending: { label: "Pending", cls: "bg-bg-inset text-text-tertiary" },
  returned: { label: "Returned", cls: "bg-status-success-bg text-status-approve" },
  late: { label: "Late", cls: "bg-status-danger-bg text-status-reject" },
  withdrawn: { label: "Withdrawn", cls: "bg-bg-inset text-text-tertiary" },
  awarded: { label: "Awarded", cls: "bg-status-warning-bg text-brand-orange" },
};

export default function ProcurementPage() {
  const { id } = useParams() as { id: string };
  const [packages, setPackages] = useState<TenderPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Record<string, string>>({});
  const [showAddPkg, setShowAddPkg] = useState(false);
  const [showAddBidder, setShowAddBidder] = useState<string | null>(null);
  const [bidders, setBidders] = useState<Bidder[]>([]);
  const [pkgForm, setPkgForm] = useState({ name: "", description: "", scope: "", procurementModel: "unclear", targetTenderDate: "" });
  const [bidderForm, setBidderForm] = useState({ company: "", contactName: "", email: "", returnDue: "" });

  const fetchPackages = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/projects/${id}/tender-packages`, { credentials: "include" });
      if (res.ok) setPackages((await res.json()).data);
    } catch { /* ignore */ }
    setLoading(false);
  }, [id]);

  useEffect(() => { fetchPackages(); }, [fetchPackages]);

  async function fetchBidders(packageId: string) {
    try {
      const res = await fetch(`${API}/api/projects/${id}/tender-packages/${packageId}/bidders`, { credentials: "include" });
      if (res.ok) setBidders((await res.json()).data);
    } catch { /* ignore */ }
  }

  async function createPackage() {
    if (!pkgForm.name.trim()) return;
    await fetch(`${API}/api/projects/${id}/tender-packages`, {
      credentials: "include",
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(pkgForm),
    });
    setPkgForm({ name: "", description: "", scope: "", procurementModel: "unclear", targetTenderDate: "" });
    setShowAddPkg(false);
    fetchPackages();
  }

  async function addBidder(packageId: string) {
    if (!bidderForm.company.trim()) return;
    await fetch(`${API}/api/projects/${id}/tender-packages/${packageId}/bidders`, {
      credentials: "include",
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(bidderForm),
    });
    setBidderForm({ company: "", contactName: "", email: "", returnDue: "" });
    setShowAddBidder(null);
    fetchBidders(packageId);
    fetchPackages();
  }

  async function updateBidderStatus(packageId: string, bidderId: string, status: string) {
    await fetch(`${API}/api/projects/${id}/tender-packages/${packageId}/bidders/${bidderId}`, {
      credentials: "include",
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    fetchBidders(packageId);
    fetchPackages();
  }

  async function awardBidder(packageId: string, bidderId: string) {
    await fetch(`${API}/api/projects/${id}/tender-packages/${packageId}/bidders/${bidderId}/award`, {
      credentials: "include",
      method: "POST",
    });
    fetchBidders(packageId);
    fetchPackages();
  }

  async function deletePackage(packageId: string) {
    await fetch(`${API}/api/projects/${id}/tender-packages/${packageId}`, { method: "DELETE" , credentials: "include" });
    fetchPackages();
  }

  function toggleExpand(packageId: string) {
    if (expanded === packageId) {
      setExpanded(null);
    } else {
      setExpanded(packageId);
      setActiveTab((prev) => ({ ...prev, [packageId]: prev[packageId] || "summary" }));
      fetchBidders(packageId);
    }
  }

  if (loading) {
    return (
      <AppShell>
        <div className="flex items-center justify-center h-64 text-text-quaternary text-sm">Loading procurement…</div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-text-primary">Procurement</h1>
          <button className="btn-primary text-sm" onClick={() => setShowAddPkg(true)}>New tender package</button>
        </div>

        {/* Package list */}
        {packages.length === 0 ? (
          <div className="card px-4 py-8 text-center text-text-quaternary text-sm">
            No tender packages created yet.
          </div>
        ) : (
          <div className="space-y-3">
            {packages.map((pkg) => {
              const isExpanded = expanded === pkg.id;
              const tab = activeTab[pkg.id] || "summary";
              return (
                <div key={pkg.id} className="card overflow-hidden">
                  {/* Header row */}
                  <button
                    className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-bg-inset/20 transition-colors"
                    onClick={() => toggleExpand(pkg.id)}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="font-semibold text-text-primary truncate">{pkg.name}</span>
                      <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-sm border ${
                        pkg.procurementModel === "general_contractor" ? "bg-status-info-light text-status-info-fg border-blue-200" :
                        pkg.procurementModel === "single_trades" ? "bg-status-purple-bg text-status-purple-fg border-status-purple-border" :
                        "bg-bg-bg-page text-text-tertiary border-border"
                      }`}>
                        {MODEL_LABELS[pkg.procurementModel] || pkg.procurementModel}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-xs shrink-0">
                      {pkg.leadName && <span className="text-text-tertiary">{pkg.leadName}</span>}
                      <span className="text-text-quaternary">{pkg.bidderCount} bids</span>
                      <span className={`font-medium ${pkg.tenderReady ? "text-status-approve" : "text-status-warning-fg"}`}>
                        {pkg.tenderReady ? "Tender Ready" : "Not Ready"}
                      </span>
                      <svg className={`w-4 h-4 text-text-quaternary transition-transform ${isExpanded ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </button>

                  {/* Expanded detail */}
                  {isExpanded && (
                    <div className="border-t border-border">
                      {/* Section tabs */}
                      <div className="flex gap-1 px-4 border-b border-border bg-bg-inset/20">
                        {["summary", "blockers", "bidders", "comparison"].map((t) => (
                          <button
                            key={t}
                            onClick={() => setActiveTab((prev) => ({ ...prev, [pkg.id]: t }))}
                            className={`px-3 py-2 text-xs font-medium border-b-2 transition-colors capitalize ${
                              tab === t ? "border-brand-orange text-text-primary" : "border-transparent text-text-quaternary hover:text-text-secondary"
                            }`}
                          >
                            {t}
                          </button>
                        ))}
                      </div>

                      <div className="px-4 py-4">
                        {/* Summary tab */}
                        {tab === "summary" && (
                          <div className="space-y-3">
                            <div className="grid grid-cols-3 gap-3 text-sm">
                              <div>
                                <span className="text-text-tertiary text-xs">Model</span>
                                <p>{MODEL_LABELS[pkg.procurementModel]}</p>
                              </div>
                              <div>
                                <span className="text-text-tertiary text-xs">Lead</span>
                                <p>{pkg.leadName || "Unassigned"}</p>
                              </div>
                              <div>
                                <span className="text-text-tertiary text-xs">Target Tender Date</span>
                                <p className="font-mono">{pkg.targetTenderDate || "—"}</p>
                              </div>
                            </div>
                            {pkg.description && (
                              <div className="text-sm">
                                <span className="text-text-tertiary text-xs">Description</span>
                                <p>{pkg.description}</p>
                              </div>
                            )}
                            {pkg.scope && (
                              <div className="text-sm">
                                <span className="text-text-tertiary text-xs">Scope</span>
                                <p>{pkg.scope}</p>
                              </div>
                            )}
                            <div className="flex items-center gap-3 pt-2 border-t border-border">
                              <button className="text-xs text-status-danger hover:text-status-danger-fg" onClick={() => deletePackage(pkg.id)}>Remove package</button>
                            </div>
                          </div>
                        )}

                        {/* Blockers tab */}
                        {tab === "blockers" && (
                          <div>
                            {pkg.blockers.length === 0 ? (
                              <p className="text-sm text-text-quaternary">No blockers recorded.</p>
                            ) : (
                              <table className="w-full text-sm">
                                <thead>
                                  <tr className="border-b border-border">
                                    <th className="text-left py-2 text-xs font-medium text-text-tertiary uppercase">Blocker</th>
                                    <th className="text-left py-2 text-xs font-medium text-text-tertiary uppercase w-24">Gate</th>
                                    <th className="text-left py-2 text-xs font-medium text-text-tertiary uppercase w-24">Status</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {pkg.blockers.map((b, i) => (
                                    <tr key={i} className="border-b border-border last:border-0">
                                      <td className="py-2">{b.description}</td>
                                      <td className="py-2 text-xs text-text-quaternary">{b.gateRef || "—"}</td>
                                      <td className="py-2">
                                        <span className={`text-xs font-medium ${b.resolved ? "text-status-approve" : "text-status-reject"}`}>
                                          {b.resolved ? "Resolved" : "Active"}
                                        </span>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            )}
                          </div>
                        )}

                        {/* Bidders tab */}
                        {tab === "bidders" && (
                          <div className="space-y-3">
                            <div className="flex justify-end">
                              <button className="btn-secondary text-xs" onClick={() => setShowAddBidder(pkg.id)}>+ Add bidder</button>
                            </div>
                            {bidders.length === 0 ? (
                              <p className="text-sm text-text-quaternary text-center py-4">No bidders invited yet.</p>
                            ) : (
                              <table className="w-full text-sm">
                                <thead>
                                  <tr className="border-b border-border">
                                    <th className="text-left py-2 text-xs font-medium text-text-tertiary uppercase">Company</th>
                                    <th className="text-left py-2 text-xs font-medium text-text-tertiary uppercase w-28">Invited</th>
                                    <th className="text-left py-2 text-xs font-medium text-text-tertiary uppercase w-28">Return Due</th>
                                    <th className="text-left py-2 text-xs font-medium text-text-tertiary uppercase w-24">Status</th>
                                    <th className="text-left py-2 text-xs font-medium text-text-tertiary uppercase w-32">Action</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {bidders.map((b) => {
                                    const st = BIDDER_STATUS[b.status] || BIDDER_STATUS.pending;
                                    return (
                                      <tr key={b.id} className="border-b border-border last:border-0">
                                        <td className="py-2 font-medium">{b.company}</td>
                                        <td className="py-2 text-xs text-text-quaternary font-mono">{formatDate(b.invitedAt)}</td>
                                        <td className="py-2 text-xs text-text-quaternary font-mono">{b.returnDue || "—"}</td>
                                        <td className="py-2">
                                          <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-sm ${st.cls}`}>
                                            {st.label}
                                          </span>
                                        </td>
                                        <td className="py-2">
                                          <div className="flex gap-2">
                                            {b.status === "invited" && (
                                              <button className="text-xs text-brand-orange hover:text-brand-orange-dark" onClick={() => updateBidderStatus(pkg.id, b.id, "returned")}>Mark Returned</button>
                                            )}
                                            {b.status === "returned" && (
                                              <button className="text-xs text-status-approve hover:opacity-80 font-medium" onClick={() => awardBidder(pkg.id, b.id)}>Award</button>
                                            )}
                                            {(b.status === "invited" || b.status === "pending") && (
                                              <button className="text-xs text-text-quaternary hover:text-text-secondary" onClick={() => updateBidderStatus(pkg.id, b.id, "withdrawn")}>Withdraw</button>
                                            )}
                                          </div>
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            )}
                          </div>
                        )}

                        {/* Comparison tab */}
                        {tab === "comparison" && (
                          <div>
                            {bidders.filter((b) => b.status === "returned" || b.status === "awarded").length === 0 ? (
                              <p className="text-sm text-text-quaternary text-center py-4">No returned bids to compare.</p>
                            ) : (
                              <table className="w-full text-sm">
                                <thead>
                                  <tr className="border-b border-border">
                                    <th className="text-left py-2 text-xs font-medium text-text-tertiary uppercase">Bidder</th>
                                    <th className="text-left py-2 text-xs font-medium text-text-tertiary uppercase w-28">Offer (€)</th>
                                    <th className="text-left py-2 text-xs font-medium text-text-tertiary uppercase">Notes</th>
                                    <th className="text-left py-2 text-xs font-medium text-text-tertiary uppercase w-24">Status</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {bidders
                                    .filter((b) => b.status === "returned" || b.status === "awarded")
                                    .map((b) => (
                                      <tr key={b.id} className={`border-b border-border last:border-0 ${b.status === "awarded" ? "bg-status-warning-light" : ""}`}>
                                        <td className="py-2 font-medium">{b.company}</td>
                                        <td className="py-2 font-mono">{b.offerAmount != null ? (b.offerAmount / 100).toLocaleString("de-DE", { style: "currency", currency: "EUR" }) : "—"}</td>
                                        <td className="py-2 text-xs text-text-tertiary">{b.offerNotes || "—"}</td>
                                        <td className="py-2">
                                          <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-sm ${(BIDDER_STATUS[b.status] || BIDDER_STATUS.pending).cls}`}>
                                            {(BIDDER_STATUS[b.status] || BIDDER_STATUS.pending).label}
                                          </span>
                                        </td>
                                      </tr>
                                    ))}
                                </tbody>
                              </table>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Add package modal */}
        <Modal open={showAddPkg} onClose={() => setShowAddPkg(false)} title="New Tender Package">
          <div className="space-y-4">
            <div>
              <label className="label">Package Name *</label>
              <input className="input" value={pkgForm.name} onChange={(e) => setPkgForm({ ...pkgForm, name: e.target.value })} placeholder="e.g. Structural steel" />
            </div>
            <div>
              <label className="label">Procurement Model</label>
              <select className="input" value={pkgForm.procurementModel} onChange={(e) => setPkgForm({ ...pkgForm, procurementModel: e.target.value })}>
                <option value="general_contractor">General Contractor</option>
                <option value="single_trades">Single Trades</option>
                <option value="unclear">Unclear</option>
              </select>
            </div>
            <div>
              <label className="label">Description</label>
              <textarea className="input" rows={2} value={pkgForm.description} onChange={(e) => setPkgForm({ ...pkgForm, description: e.target.value })} />
            </div>
            <div>
              <label className="label">Scope</label>
              <textarea className="input" rows={2} value={pkgForm.scope} onChange={(e) => setPkgForm({ ...pkgForm, scope: e.target.value })} />
            </div>
            <div>
              <label className="label">Target Tender Date</label>
              <input type="date" className="input" value={pkgForm.targetTenderDate} onChange={(e) => setPkgForm({ ...pkgForm, targetTenderDate: e.target.value })} />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button className="btn-secondary" onClick={() => setShowAddPkg(false)}>Cancel</button>
              <button className="btn-primary" onClick={createPackage} disabled={!pkgForm.name.trim()}>Create</button>
            </div>
          </div>
        </Modal>

        {/* Add bidder modal */}
        <Modal open={!!showAddBidder} onClose={() => setShowAddBidder(null)} title="Add Bidder">
          <div className="space-y-4">
            <div>
              <label className="label">Company *</label>
              <input className="input" value={bidderForm.company} onChange={(e) => setBidderForm({ ...bidderForm, company: e.target.value })} />
            </div>
            <div>
              <label className="label">Contact Name</label>
              <input className="input" value={bidderForm.contactName} onChange={(e) => setBidderForm({ ...bidderForm, contactName: e.target.value })} />
            </div>
            <div>
              <label className="label">Email</label>
              <input className="input" type="email" value={bidderForm.email} onChange={(e) => setBidderForm({ ...bidderForm, email: e.target.value })} />
            </div>
            <div>
              <label className="label">Return Due Date</label>
              <input type="date" className="input" value={bidderForm.returnDue} onChange={(e) => setBidderForm({ ...bidderForm, returnDue: e.target.value })} />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button className="btn-secondary" onClick={() => setShowAddBidder(null)}>Cancel</button>
              <button className="btn-primary" onClick={() => showAddBidder && addBidder(showAddBidder)} disabled={!bidderForm.company.trim()}>Add Bidder</button>
            </div>
          </div>
        </Modal>
      </div>
    </AppShell>
  );
}
