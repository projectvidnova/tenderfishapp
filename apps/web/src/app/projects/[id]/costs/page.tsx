"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import AppShell from "@/components/layout/AppShell";
import { Modal } from "@/components/ui/Modal";
import { DataStateChip } from "@/components/ui/DataStateChip";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

const COST_STAGES = [
  { value: "kostenrahmen", label: "Kostenrahmen (LPH 1)", accuracy: "±30%" },
  { value: "kostenschaetzung", label: "Kostenschätzung (LPH 2)", accuracy: "±20%" },
  { value: "kostenberechnung", label: "Kostenberechnung (LPH 3)", accuracy: "±15%" },
  { value: "kostenanschlag", label: "Kostenanschlag (LPH 7)", accuracy: "±5–10%" },
  { value: "kostenfeststellung", label: "Kostenfeststellung (LPH 8)", accuracy: "Actual" },
];

const STATUS_LABELS: Record<string, { label: string; cls: string }> = {
  draft: { label: "Draft", cls: "bg-bg-inset text-text-tertiary" },
  submitted: { label: "Submitted", cls: "bg-status-info-bg text-status-info-fg" },
  approved: { label: "Approved", cls: "bg-status-success-bg text-status-approve" },
  superseded: { label: "Superseded", cls: "bg-status-warning-bg text-status-warning-fg" },
};

const DIN276_GROUPS = [
  { code: "100", label: "100 – Grundstück (Site)" },
  { code: "200", label: "200 – Vorbereitende Maßnahmen (Preliminary)" },
  { code: "300", label: "300 – Bauwerk – Baukonstruktionen (Structure)" },
  { code: "400", label: "400 – Bauwerk – Technische Anlagen (Services)" },
  { code: "500", label: "500 – Außenanlagen und Freiflächen (External)" },
  { code: "600", label: "600 – Ausstattung und Kunstwerke (Equipment)" },
  { code: "700", label: "700 – Baunebenkosten (Fees & Other)" },
];

function formatEur(cents: number) {
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(cents / 100);
}

type CostSnapshot = {
  id: string;
  costStage: string;
  snapshotDate: string;
  totalGross: number | null;
  totalNet: number | null;
  vatRate: number;
  currency: string;
  notes: string | null;
  status: string;
  createdAt: string;
  lineItems?: CostLineItem[];
};

type CostLineItem = {
  id: string;
  costGroupCode: string;
  costGroupLevel: number;
  description: string | null;
  amountNet: number;
  amountGross: number;
  quantity: number | null;
  unit: string | null;
  unitPrice: number | null;
  source: string | null;
  dataState: string | null;
};

type ProjectFact = {
  id: string;
  fieldName: string;
  value: string | null;
  dataState: string;
};

export default function CostsPage() {
  const { id } = useParams() as { id: string };
  const [snapshots, setSnapshots] = useState<CostSnapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [showDetail, setShowDetail] = useState<CostSnapshot | null>(null);
  const [showAddItem, setShowAddItem] = useState(false);
  const [form, setForm] = useState({ costStage: "kostenrahmen", snapshotDate: new Date().toISOString().slice(0, 10), notes: "" });
  const [itemForm, setItemForm] = useState({ costGroupCode: "300", description: "", amountNet: "", amountGross: "", source: "estimate", dataState: "DERIVED" });
  const [facts, setFacts] = useState<ProjectFact[]>([]);
  const [confirmingFactId, setConfirmingFactId] = useState<string | null>(null);

  const fetchSnapshots = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/projects/${id}/cost-snapshots`, {
        credentials: "include",
      });
      if (res.ok) {
        const json = await res.json();
        setSnapshots(json.data || []);
      }
    } catch { /* ignore */ }
    setLoading(false);
  }, [id]);

  const fetchFacts = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/projects/${id}/facts`, {
        credentials: "include",
      });
      if (res.ok) {
        const json = await res.json();
        setFacts(json.data || []);
      }
    } catch {
      // ignore
    }
  }, [id]);

  useEffect(() => {
    fetchSnapshots();
    fetchFacts();
  }, [fetchSnapshots, fetchFacts]);

  async function createSnapshot() {
    const res = await fetch(`${API}/api/projects/${id}/cost-snapshots`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(form),
    });
    if (res.ok) { setShowAdd(false); fetchSnapshots(); setForm({ costStage: "kostenrahmen", snapshotDate: new Date().toISOString().slice(0, 10), notes: "" }); }
  }

  async function openDetail(snap: CostSnapshot) {
    try {
      const res = await fetch(`${API}/api/projects/${id}/cost-snapshots/${snap.id}`, {
        credentials: "include",
      });
      if (res.ok) {
        const json = await res.json();
        setShowDetail(json.data);
      }
    } catch { /* ignore */ }
  }

  async function addLineItem() {
    if (!showDetail) return;
    const res = await fetch(`${API}/api/projects/${id}/cost-snapshots/${showDetail.id}/line-items`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        costGroupCode: itemForm.costGroupCode,
        costGroupLevel: 1,
        description: itemForm.description || null,
        amountNet: Math.round(parseFloat(itemForm.amountNet || "0") * 100),
        amountGross: Math.round(parseFloat(itemForm.amountGross || "0") * 100),
        source: itemForm.source,
        dataState: itemForm.dataState,
      }),
    });
    if (res.ok) { setShowAddItem(false); openDetail(showDetail); setItemForm({ costGroupCode: "300", description: "", amountNet: "", amountGross: "", source: "estimate", dataState: "DERIVED" }); }
  }

  async function updateStatus(snapId: string, status: string) {
    await fetch(`${API}/api/projects/${id}/cost-snapshots/${snapId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ status }),
    });
    fetchSnapshots();
    if (showDetail?.id === snapId) openDetail(showDetail);
  }

  async function confirmFact(factId: string) {
    try {
      setConfirmingFactId(factId);
      await fetch(`${API}/api/projects/${id}/facts/${factId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ dataState: "CONFIRMED" }),
      });
      await fetchFacts();
    } catch {
      // ignore
    } finally {
      setConfirmingFactId(null);
    }
  }

  if (loading) return <AppShell><div className="p-8 text-text-quaternary">Loading…</div></AppShell>;

  const aiCostFacts = facts.filter((fact) => fact.fieldName === "cost_item");
  const parseFact = (raw: string | null): Record<string, unknown> | null => {
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : null;
    } catch {
      return null;
    }
  };

  return (
    <AppShell>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Cost Estimate (DIN 276)</h1>
            <p className="text-sm text-text-tertiary mt-1">Manage cost snapshots across HOAI phases</p>
          </div>
          <button className="btn-primary" onClick={() => setShowAdd(true)}>+ New Snapshot</button>
        </div>

        <div className="grid grid-cols-5 gap-3">
          {COST_STAGES.map((stage) => {
            const snap = snapshots.find((s) => s.costStage === stage.value && s.status !== "superseded");
            return (
              <div key={stage.value} className="card p-4 text-center">
                <p className="text-xs text-text-tertiary font-medium uppercase tracking-wide">{stage.value.replace("ae", "ä")}</p>
                <p className="text-xs text-text-quaternary mt-0.5">{stage.accuracy}</p>
                {snap ? (
                  <>
                    <p className="text-lg font-semibold mt-2">{snap.totalGross ? formatEur(snap.totalGross) : "—"}</p>
                    <span className={`inline-block mt-1 text-[10px] px-2 py-0.5 rounded-full font-medium ${STATUS_LABELS[snap.status]?.cls || ""}`}>
                      {STATUS_LABELS[snap.status]?.label || snap.status}
                    </span>
                  </>
                ) : (
                  <p className="text-sm text-text-quaternary mt-2">—</p>
                )}
              </div>
            );
          })}
        </div>

        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-bg-inset/30">
                <th className="text-left px-4 py-2 text-xs font-medium text-text-tertiary uppercase">Stage</th>
                <th className="text-left px-4 py-2 text-xs font-medium text-text-tertiary uppercase">Date</th>
                <th className="text-right px-4 py-2 text-xs font-medium text-text-tertiary uppercase">Net</th>
                <th className="text-right px-4 py-2 text-xs font-medium text-text-tertiary uppercase">Gross</th>
                <th className="text-left px-4 py-2 text-xs font-medium text-text-tertiary uppercase">Status</th>
                <th className="text-left px-4 py-2 text-xs font-medium text-text-tertiary uppercase">Actions</th>
              </tr>
            </thead>
            <tbody>
              {snapshots.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-text-quaternary">No cost snapshots yet. Create one to begin tracking costs.</td></tr>
              ) : snapshots.map((s) => (
                <tr key={s.id} className="border-b border-border last:border-0 hover:bg-bg-inset/20">
                  <td className="px-4 py-3 font-medium">{COST_STAGES.find((cs) => cs.value === s.costStage)?.label || s.costStage}</td>
                  <td className="px-4 py-3 text-text-secondary">{new Date(s.snapshotDate).toLocaleDateString("de-DE")}</td>
                  <td className="px-4 py-3 text-right font-mono">{s.totalNet ? formatEur(s.totalNet) : "—"}</td>
                  <td className="px-4 py-3 text-right font-mono font-medium">{s.totalGross ? formatEur(s.totalGross) : "—"}</td>
                  <td className="px-4 py-3">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${STATUS_LABELS[s.status]?.cls || "bg-bg-inset text-text-tertiary"}`}>
                      {STATUS_LABELS[s.status]?.label || s.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button className="text-xs text-brand-orange hover:text-brand-orange-hover font-medium" onClick={() => openDetail(s)}>View</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {aiCostFacts.length > 0 && (
          <div className="card overflow-hidden">
            <div className="px-4 py-3 border-b border-border bg-bg-inset/30">
              <h2 className="text-sm font-semibold">AI-Extracted Cost Rows (DIN 276)</h2>
              <p className="text-xs text-text-tertiary mt-0.5">
                These rows are inferred from uploaded documents and linked to source documents.
              </p>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-bg-inset/20">
                  <th className="text-left px-4 py-2 text-xs font-medium text-text-tertiary uppercase">DIN Group</th>
                  <th className="text-left px-4 py-2 text-xs font-medium text-text-tertiary uppercase">Description</th>
                  <th className="text-right px-4 py-2 text-xs font-medium text-text-tertiary uppercase font-mono">Qty</th>
                  <th className="text-right px-4 py-2 text-xs font-medium text-text-tertiary uppercase font-mono">Amount (EUR)</th>
                  <th className="text-left px-4 py-2 text-xs font-medium text-text-tertiary uppercase">State</th>
                  <th className="text-left px-4 py-2 text-xs font-medium text-text-tertiary uppercase">Action</th>
                </tr>
              </thead>
              <tbody>
                {aiCostFacts.map((fact) => {
                  const parsed = parseFact(fact.value);
                  const din = typeof parsed?.din276_code === "string" ? parsed.din276_code : "—";
                  const description = typeof parsed?.description === "string" ? parsed.description : "—";
                  const quantity =
                    typeof parsed?.quantity === "number"
                      ? parsed.quantity.toLocaleString("de-DE")
                      : "—";
                  const amount =
                    typeof parsed?.amount === "number"
                      ? new Intl.NumberFormat("de-DE", {
                          style: "currency",
                          currency: "EUR",
                          maximumFractionDigits: 0,
                        }).format(parsed.amount)
                      : "—";
                  return (
                    <tr key={fact.id} className="border-b border-border last:border-0">
                      <td className="px-4 py-2 font-mono text-xs font-semibold">{din}</td>
                      <td className="px-4 py-2 text-text-secondary">{description}</td>
                      <td className="px-4 py-2 text-right font-mono">{quantity}</td>
                      <td className="px-4 py-2 text-right font-mono">{amount}</td>
                      <td className="px-4 py-2">
                        <DataStateChip state={fact.dataState} />
                      </td>
                      <td className="px-4 py-2">
                        {fact.dataState !== "CONFIRMED" && (
                          <button
                            onClick={() => confirmFact(fact.id)}
                            disabled={confirmingFactId === fact.id}
                            className="text-xs font-medium text-brand-orange hover:text-brand-orange-hover disabled:opacity-50"
                          >
                            Review & Confirm
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <Modal open={showAdd} onClose={() => setShowAdd(false)} title="New Cost Snapshot">
          <div className="space-y-4">
            <div>
              <label className="label">Cost Stage *</label>
              <select className="input" value={form.costStage} onChange={(e) => setForm({ ...form, costStage: e.target.value })}>
                {COST_STAGES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Snapshot Date *</label>
              <input type="date" className="input" value={form.snapshotDate} onChange={(e) => setForm({ ...form, snapshotDate: e.target.value })} />
            </div>
            <div>
              <label className="label">Notes</label>
              <textarea className="input" rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button className="btn-secondary" onClick={() => setShowAdd(false)}>Cancel</button>
              <button className="btn-primary" onClick={createSnapshot}>Create</button>
            </div>
          </div>
        </Modal>

        <Modal open={!!showDetail} onClose={() => { setShowDetail(null); setShowAddItem(false); }} title={`Cost Snapshot — ${COST_STAGES.find((s) => s.value === showDetail?.costStage)?.label || ""}`} width="max-w-3xl">
          {showDetail && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_LABELS[showDetail.status]?.cls || ""}`}>
                  {STATUS_LABELS[showDetail.status]?.label || showDetail.status}
                </span>
                <span className="text-xs text-text-tertiary">{new Date(showDetail.snapshotDate).toLocaleDateString("de-DE")}</span>
                {showDetail.totalGross && <span className="text-sm font-semibold ml-auto">{formatEur(showDetail.totalGross)}</span>}
              </div>
              {showDetail.notes && <p className="text-sm text-text-secondary">{showDetail.notes}</p>}

              {showDetail.status === "draft" && (
                <div className="flex gap-2">
                  <button className="btn-primary text-xs" onClick={() => updateStatus(showDetail.id, "submitted")}>Submit for Review</button>
                </div>
              )}
              {showDetail.status === "submitted" && (
                <div className="flex gap-2">
                  <button className="btn-primary text-xs" onClick={() => updateStatus(showDetail.id, "approved")}>Approve</button>
                  <button className="btn-secondary text-xs" onClick={() => updateStatus(showDetail.id, "draft")}>Return to Draft</button>
                </div>
              )}

              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">Line Items (DIN 276)</h3>
                {showDetail.status === "draft" && (
                  <button className="text-xs text-brand-orange font-medium" onClick={() => setShowAddItem(true)}>+ Add Item</button>
                )}
              </div>

              {showAddItem && (
                <div className="bg-bg-inset rounded-xl p-4 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="label">Cost Group *</label>
                      <select className="input" value={itemForm.costGroupCode} onChange={(e) => setItemForm({ ...itemForm, costGroupCode: e.target.value })}>
                        {DIN276_GROUPS.map((g) => <option key={g.code} value={g.code}>{g.label}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="label">Data State</label>
                      <select className="input" value={itemForm.dataState} onChange={(e) => setItemForm({ ...itemForm, dataState: e.target.value })}>
                        <option value="CONFIRMED">Confirmed</option>
                        <option value="DERIVED">Derived</option>
                        <option value="UNCLEAR">Unclear</option>
                        <option value="MISSING">Missing</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="label">Description</label>
                    <input className="input" value={itemForm.description} onChange={(e) => setItemForm({ ...itemForm, description: e.target.value })} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="label">Amount Net (€)</label>
                      <input type="number" step="0.01" className="input" value={itemForm.amountNet} onChange={(e) => setItemForm({ ...itemForm, amountNet: e.target.value })} />
                    </div>
                    <div>
                      <label className="label">Amount Gross (€)</label>
                      <input type="number" step="0.01" className="input" value={itemForm.amountGross} onChange={(e) => setItemForm({ ...itemForm, amountGross: e.target.value })} />
                    </div>
                  </div>
                  <div className="flex justify-end gap-3 pt-1">
                    <button className="btn-secondary text-xs" onClick={() => setShowAddItem(false)}>Cancel</button>
                    <button className="btn-primary text-xs" onClick={addLineItem}>Add</button>
                  </div>
                </div>
              )}

              <div className="card overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-bg-inset/30">
                      <th className="text-left px-4 py-2 text-xs font-medium text-text-tertiary uppercase">KG Code</th>
                      <th className="text-left px-4 py-2 text-xs font-medium text-text-tertiary uppercase">Description</th>
                      <th className="text-right px-4 py-2 text-xs font-medium text-text-tertiary uppercase">Net</th>
                      <th className="text-right px-4 py-2 text-xs font-medium text-text-tertiary uppercase">Gross</th>
                      <th className="text-left px-4 py-2 text-xs font-medium text-text-tertiary uppercase">Source</th>
                      <th className="text-left px-4 py-2 text-xs font-medium text-text-tertiary uppercase">State</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(!showDetail.lineItems || showDetail.lineItems.length === 0) ? (
                      <tr><td colSpan={6} className="px-4 py-6 text-center text-text-quaternary">No line items yet.</td></tr>
                    ) : showDetail.lineItems.map((item) => (
                      <tr key={item.id} className="border-b border-border last:border-0">
                        <td className="px-4 py-2 font-mono text-xs font-medium">{item.costGroupCode}</td>
                        <td className="px-4 py-2 text-text-secondary">{item.description || "—"}</td>
                        <td className="px-4 py-2 text-right font-mono">{formatEur(item.amountNet)}</td>
                        <td className="px-4 py-2 text-right font-mono font-medium">{formatEur(item.amountGross)}</td>
                        <td className="px-4 py-2 text-xs text-text-tertiary">{item.source || "—"}</td>
                        <td className="px-4 py-2">{item.dataState && <DataStateChip state={item.dataState} />}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </Modal>
      </div>
    </AppShell>
  );
}
