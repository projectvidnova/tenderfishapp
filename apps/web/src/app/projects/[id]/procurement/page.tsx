"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import AppShell from "@/components/layout/AppShell";
import { Modal } from "@/components/ui/Modal";

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
  invited: { label: "Invited", cls: "bg-blue-100 text-blue-700" },
  pending: { label: "Pending", cls: "bg-gray-100 text-gray-500" },
  returned: { label: "Returned", cls: "bg-green-100 text-[#3F7A5A]" },
  late: { label: "Late", cls: "bg-red-100 text-[#B04A3A]" },
  withdrawn: { label: "Withdrawn", cls: "bg-gray-200 text-gray-500" },
  awarded: { label: "Awarded", cls: "bg-amber-100 text-bronze" },
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
      const res = await fetch(`${API}/api/projects/${id}/tender-packages`);
      if (res.ok) setPackages((await res.json()).data);
    } catch { /* ignore */ }
    setLoading(false);
  }, [id]);

  useEffect(() => { fetchPackages(); }, [fetchPackages]);

  async function fetchBidders(packageId: string) {
    try {
      const res = await fetch(`${API}/api/projects/${id}/tender-packages/${packageId}/bidders`);
      if (res.ok) setBidders((await res.json()).data);
    } catch { /* ignore */ }
  }

  async function createPackage() {
    if (!pkgForm.name.trim()) return;
    await fetch(`${API}/api/projects/${id}/tender-packages`, {
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
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    fetchBidders(packageId);
    fetchPackages();
  }

  async function awardBidder(packageId: string, bidderId: string) {
    await fetch(`${API}/api/projects/${id}/tender-packages/${packageId}/bidders/${bidderId}/award`, {
      method: "POST",
    });
    fetchBidders(packageId);
    fetchPackages();
  }

  async function deletePackage(packageId: string) {
    await fetch(`${API}/api/projects/${id}/tender-packages/${packageId}`, { method: "DELETE" });
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
        <div className="flex items-center justify-center h-64 text-gray-400 text-sm">Loading procurement…</div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-ink">Procurement</h1>
          <button className="btn-primary text-sm" onClick={() => setShowAddPkg(true)}>New tender package</button>
        </div>

        {/* Package list */}
        {packages.length === 0 ? (
          <div className="card px-4 py-8 text-center text-gray-400 text-sm">
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
                    className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-cream/20 transition-colors"
                    onClick={() => toggleExpand(pkg.id)}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="font-semibold text-ink truncate">{pkg.name}</span>
                      <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-sm border ${
                        pkg.procurementModel === "general_contractor" ? "bg-blue-50 text-blue-700 border-blue-200" :
                        pkg.procurementModel === "single_trades" ? "bg-purple-50 text-purple-700 border-purple-200" :
                        "bg-gray-50 text-gray-500 border-gray-200"
                      }`}>
                        {MODEL_LABELS[pkg.procurementModel] || pkg.procurementModel}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-xs shrink-0">
                      {pkg.leadName && <span className="text-gray-500">{pkg.leadName}</span>}
                      <span className="text-gray-400">{pkg.bidderCount} bids</span>
                      <span className={`font-medium ${pkg.tenderReady ? "text-[#3F7A5A]" : "text-amber-600"}`}>
                        {pkg.tenderReady ? "Tender Ready" : "Not Ready"}
                      </span>
                      <svg className={`w-4 h-4 text-gray-400 transition-transform ${isExpanded ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </button>

                  {/* Expanded detail */}
                  {isExpanded && (
                    <div className="border-t border-card-border">
                      {/* Section tabs */}
                      <div className="flex gap-1 px-4 border-b border-card-border bg-cream/20">
                        {["summary", "blockers", "bidders", "comparison"].map((t) => (
                          <button
                            key={t}
                            onClick={() => setActiveTab((prev) => ({ ...prev, [pkg.id]: t }))}
                            className={`px-3 py-2 text-xs font-medium border-b-2 transition-colors capitalize ${
                              tab === t ? "border-bronze text-ink" : "border-transparent text-gray-400 hover:text-gray-600"
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
                                <span className="text-gray-500 text-xs">Model</span>
                                <p>{MODEL_LABELS[pkg.procurementModel]}</p>
                              </div>
                              <div>
                                <span className="text-gray-500 text-xs">Lead</span>
                                <p>{pkg.leadName || "Unassigned"}</p>
                              </div>
                              <div>
                                <span className="text-gray-500 text-xs">Target Tender Date</span>
                                <p className="font-mono">{pkg.targetTenderDate || "—"}</p>
                              </div>
                            </div>
                            {pkg.description && (
                              <div className="text-sm">
                                <span className="text-gray-500 text-xs">Description</span>
                                <p>{pkg.description}</p>
                              </div>
                            )}
                            {pkg.scope && (
                              <div className="text-sm">
                                <span className="text-gray-500 text-xs">Scope</span>
                                <p>{pkg.scope}</p>
                              </div>
                            )}
                            <div className="flex items-center gap-3 pt-2 border-t border-card-border">
                              <button className="text-xs text-red-500 hover:text-red-700" onClick={() => deletePackage(pkg.id)}>Remove package</button>
                            </div>
                          </div>
                        )}

                        {/* Blockers tab */}
                        {tab === "blockers" && (
                          <div>
                            {pkg.blockers.length === 0 ? (
                              <p className="text-sm text-gray-400">No blockers recorded.</p>
                            ) : (
                              <table className="w-full text-sm">
                                <thead>
                                  <tr className="border-b border-card-border">
                                    <th className="text-left py-2 text-xs font-medium text-gray-500 uppercase">Blocker</th>
                                    <th className="text-left py-2 text-xs font-medium text-gray-500 uppercase w-24">Gate</th>
                                    <th className="text-left py-2 text-xs font-medium text-gray-500 uppercase w-24">Status</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {pkg.blockers.map((b, i) => (
                                    <tr key={i} className="border-b border-card-border last:border-0">
                                      <td className="py-2">{b.description}</td>
                                      <td className="py-2 text-xs text-gray-400">{b.gateRef || "—"}</td>
                                      <td className="py-2">
                                        <span className={`text-xs font-medium ${b.resolved ? "text-[#3F7A5A]" : "text-[#B04A3A]"}`}>
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
                              <p className="text-sm text-gray-400 text-center py-4">No bidders invited yet.</p>
                            ) : (
                              <table className="w-full text-sm">
                                <thead>
                                  <tr className="border-b border-card-border">
                                    <th className="text-left py-2 text-xs font-medium text-gray-500 uppercase">Company</th>
                                    <th className="text-left py-2 text-xs font-medium text-gray-500 uppercase w-28">Invited</th>
                                    <th className="text-left py-2 text-xs font-medium text-gray-500 uppercase w-28">Return Due</th>
                                    <th className="text-left py-2 text-xs font-medium text-gray-500 uppercase w-24">Status</th>
                                    <th className="text-left py-2 text-xs font-medium text-gray-500 uppercase w-32">Action</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {bidders.map((b) => {
                                    const st = BIDDER_STATUS[b.status] || BIDDER_STATUS.pending;
                                    return (
                                      <tr key={b.id} className="border-b border-card-border last:border-0">
                                        <td className="py-2 font-medium">{b.company}</td>
                                        <td className="py-2 text-xs text-gray-400 font-mono">{new Date(b.invitedAt).toLocaleDateString()}</td>
                                        <td className="py-2 text-xs text-gray-400 font-mono">{b.returnDue || "—"}</td>
                                        <td className="py-2">
                                          <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-sm ${st.cls}`}>
                                            {st.label}
                                          </span>
                                        </td>
                                        <td className="py-2">
                                          <div className="flex gap-2">
                                            {b.status === "invited" && (
                                              <button className="text-xs text-bronze hover:text-bronze-dark" onClick={() => updateBidderStatus(pkg.id, b.id, "returned")}>Mark Returned</button>
                                            )}
                                            {b.status === "returned" && (
                                              <button className="text-xs text-[#3F7A5A] hover:opacity-80 font-medium" onClick={() => awardBidder(pkg.id, b.id)}>Award</button>
                                            )}
                                            {(b.status === "invited" || b.status === "pending") && (
                                              <button className="text-xs text-gray-400 hover:text-gray-600" onClick={() => updateBidderStatus(pkg.id, b.id, "withdrawn")}>Withdraw</button>
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
                              <p className="text-sm text-gray-400 text-center py-4">No returned bids to compare.</p>
                            ) : (
                              <table className="w-full text-sm">
                                <thead>
                                  <tr className="border-b border-card-border">
                                    <th className="text-left py-2 text-xs font-medium text-gray-500 uppercase">Bidder</th>
                                    <th className="text-left py-2 text-xs font-medium text-gray-500 uppercase w-28">Offer (€)</th>
                                    <th className="text-left py-2 text-xs font-medium text-gray-500 uppercase">Notes</th>
                                    <th className="text-left py-2 text-xs font-medium text-gray-500 uppercase w-24">Status</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {bidders
                                    .filter((b) => b.status === "returned" || b.status === "awarded")
                                    .map((b) => (
                                      <tr key={b.id} className={`border-b border-card-border last:border-0 ${b.status === "awarded" ? "bg-amber-50" : ""}`}>
                                        <td className="py-2 font-medium">{b.company}</td>
                                        <td className="py-2 font-mono">{b.offerAmount != null ? (b.offerAmount / 100).toLocaleString("de-DE", { style: "currency", currency: "EUR" }) : "—"}</td>
                                        <td className="py-2 text-xs text-gray-500">{b.offerNotes || "—"}</td>
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
