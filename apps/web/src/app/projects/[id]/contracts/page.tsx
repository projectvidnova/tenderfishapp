"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import AppShell from "@/components/layout/AppShell";
import { ProjectTopBar } from "@/components/project/ProjectTopBar";
import { Modal } from "@/components/ui/Modal";
import { DataStateChip } from "@/components/ui/DataStateChip";
import { formatDate, formatEur } from "@/lib/formatters";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

type Tab = "contracts" | "payments" | "acceptance" | "change_orders" | "diary";
const TABS: { key: Tab; label: string }[] = [
  { key: "contracts", label: "Contracts" },
  { key: "payments", label: "Payments" },
  { key: "acceptance", label: "Acceptance" },
  { key: "change_orders", label: "Change Orders" },
  { key: "diary", label: "Site Diary" },
];

const PAYMENT_TYPE_LABEL: Record<string, string> = {
  abschlagszahlung: "Interim payment",
  teilschlussrechnung: "Partial final invoice",
  schlussrechnung: "Final invoice",
  sicherheitseinbehalt: "Retention release",
};

const ABNAHME_TYPE_LABEL: Record<string, string> = {
  foermliche_abnahme: "Formal acceptance",
  stillschweigende_abnahme: "Implied acceptance",
  teilabnahme: "Partial acceptance",
  fiktive_abnahme: "Deemed acceptance",
};

const NACHTRAG_TYPE_LABEL: Record<string, string> = {
  mengenabweichung: "Quantity variation",
  geaenderte_leistung: "Modified scope",
  zusaetzliche_leistung: "Additional scope",
  selbst_uebernahme: "Owner-performed",
  behinderung: "Obstruction",
  stundenlohn: "Time-and-materials",
};

type Contract = {
  id: string;
  title: string;
  contractorCompany: string;
  contractType: string;
  status: string;
  contractValueNet: number;
  contractValueGross: number;
  awardDate: string | null;
  abnahmeDate: string | null;
  warrantyEndDate: string | null;
  costGroupCode: string | null;
};

type Payment = {
  id: string;
  contractId: string;
  paymentNumber: string;
  type: string;
  invoiceDate: string;
  amountNet: number;
  amountGross: number;
  cumulativeNet: number;
  status: string;
  paidDate: string | null;
};

type Abnahme = {
  id: string;
  contractId: string;
  type: string;
  scheduledDate: string;
  actualDate: string | null;
  status: string;
  warrantyStartDate: string | null;
  defects: { description: string; severity: string; deadline?: string; resolved: boolean }[];
};

type Nachtrag = {
  id: string;
  contractId: string;
  nachtragNumber: string;
  title: string;
  type: string;
  status: string;
  requestedAmountNet: number;
  approvedAmountNet: number | null;
  scheduleImpactDays: number;
  submittedAt: string;
};

type DiaryEntry = {
  id: string;
  entryDate: string;
  status: string;
  activitiesPerformed: string | null;
  weatherData: { temperature?: string; precipitation?: string; wind?: string } | null;
};

const STATUS_CHIP: Record<string, "CONFIRMED" | "DERIVED" | "UNCLEAR" | "MISSING" | "LOCKED"> = {
  draft: "DERIVED",
  tendered: "DERIVED",
  submitted: "DERIVED",
  awarded: "CONFIRMED",
  active: "CONFIRMED",
  approved: "CONFIRMED",
  paid: "CONFIRMED",
  in_warranty: "CONFIRMED",
  closed: "LOCKED",
  terminated: "MISSING",
  completed_without_defects: "CONFIRMED",
  completed_with_defects: "UNCLEAR",
  refused: "MISSING",
  scheduled: "DERIVED",
  rejected: "MISSING",
  partially_approved: "UNCLEAR",
  under_review: "DERIVED",
  disputed: "MISSING",
};

function chipState(status: string) {
  return STATUS_CHIP[status] ?? "DERIVED";
}

export default function ContractsPage() {
  const { id: projectId } = useParams() as { id: string };
  const [tab, setTab] = useState<Tab>("contracts");
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [selected, setSelected] = useState<Contract | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchContracts = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`${API}/api/projects/${projectId}/contracts`, { credentials: "include" });
    if (res.ok) {
      const json = await res.json();
      setContracts(json.data ?? []);
    }
    setLoading(false);
  }, [projectId]);

  useEffect(() => {
    fetchContracts();
  }, [fetchContracts]);

  return (
    <AppShell>
      <ProjectTopBar projectId={projectId} />

      <div className="w-full space-y-6 mt-6">
        <div>
          <h1 className="text-xl font-semibold">Contracts &amp; Acceptance</h1>
          <p className="text-sm text-text-tertiary mt-0.5">
            VOB/B-style contracts, payment certificates, acceptance, change orders, and site diary.
          </p>
        </div>

        <div className="flex border-b border-border gap-1">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                tab === t.key
                  ? "border-brand-orange text-brand-orange"
                  : "border-transparent text-text-tertiary hover:text-text-primary"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === "contracts" && (
          <ContractsList
            contracts={contracts}
            loading={loading}
            onSelect={setSelected}
          />
        )}

        {tab === "payments" && <PaymentsTab projectId={projectId} contracts={contracts} />}
        {tab === "acceptance" && <AbnahmenTab projectId={projectId} contracts={contracts} />}
        {tab === "change_orders" && <NachtraegeTab projectId={projectId} contracts={contracts} />}
        {tab === "diary" && <BautagebuchTab projectId={projectId} />}

        <Modal
          open={!!selected}
          onClose={() => setSelected(null)}
          title={selected?.title ?? ""}
          width="max-w-2xl"
        >
          {selected && <ContractDetail contract={selected} />}
        </Modal>
      </div>
    </AppShell>
  );
}

// ─── Contracts tab ───────────────────────────────────────────

function ContractsList({
  contracts,
  loading,
  onSelect,
}: {
  contracts: Contract[];
  loading: boolean;
  onSelect: (c: Contract) => void;
}) {
  if (loading) return <div className="card p-8 text-center text-text-tertiary">Loading…</div>;
  if (contracts.length === 0) {
    return (
      <div className="card p-8 text-center">
        <p className="text-text-secondary">No contracts yet.</p>
        <p className="text-sm text-text-tertiary mt-2">
          Contracts are created automatically when you award a bidder on the Procurement page.
        </p>
      </div>
    );
  }
  return (
    <div className="card overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-bg-inset/30">
            <th className="text-left px-4 py-2 text-xs font-medium text-text-tertiary uppercase">Contract</th>
            <th className="text-left px-4 py-2 text-xs font-medium text-text-tertiary uppercase">Contractor</th>
            <th className="text-right px-4 py-2 text-xs font-medium text-text-tertiary uppercase">Value (net)</th>
            <th className="text-left px-4 py-2 text-xs font-medium text-text-tertiary uppercase">Awarded</th>
            <th className="text-left px-4 py-2 text-xs font-medium text-text-tertiary uppercase">Acceptance</th>
            <th className="text-left px-4 py-2 text-xs font-medium text-text-tertiary uppercase">Status</th>
          </tr>
        </thead>
        <tbody>
          {contracts.map((c) => (
            <tr
              key={c.id}
              className="border-b border-border last:border-0 hover:bg-bg-inset/20 cursor-pointer"
              onClick={() => onSelect(c)}
            >
              <td className="px-4 py-2 font-medium">{c.title}</td>
              <td className="px-4 py-2 text-text-secondary">{c.contractorCompany}</td>
              <td className="px-4 py-2 text-right font-mono">{formatEur(c.contractValueNet)}</td>
              <td className="px-4 py-2 text-xs">{c.awardDate ? formatDate(c.awardDate) : "—"}</td>
              <td className="px-4 py-2 text-xs">{c.abnahmeDate ? formatDate(c.abnahmeDate) : "—"}</td>
              <td className="px-4 py-2">
                <DataStateChip state={chipState(c.status)} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ContractDetail({ contract }: { contract: Contract }) {
  const Field = ({ label, value }: { label: string; value: string }) => (
    <div>
      <div className="text-xs uppercase text-text-tertiary">{label}</div>
      <div className="mt-0.5 text-sm">{value}</div>
    </div>
  );
  return (
    <div className="grid grid-cols-2 gap-4">
      <Field label="Contractor" value={contract.contractorCompany} />
      <Field label="Contract type" value={contract.contractType.toUpperCase()} />
      <Field label="Status" value={contract.status} />
      <Field label="DIN 276" value={contract.costGroupCode ?? "—"} />
      <Field label="Value (net)" value={formatEur(contract.contractValueNet)} />
      <Field label="Value (gross)" value={formatEur(contract.contractValueGross)} />
      <Field label="Award date" value={contract.awardDate ? formatDate(contract.awardDate) : "—"} />
      <Field label="Acceptance" value={contract.abnahmeDate ? formatDate(contract.abnahmeDate) : "—"} />
      <Field
        label="Warranty ends"
        value={contract.warrantyEndDate ? formatDate(contract.warrantyEndDate) : "—"}
      />
    </div>
  );
}

// ─── Payments tab ────────────────────────────────────────────

function PaymentsTab({ projectId, contracts }: { projectId: string; contracts: Contract[] }) {
  const [selectedContract, setSelectedContract] = useState<string>("");
  const [payments, setPayments] = useState<Payment[]>([]);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({
    paymentNumber: "",
    type: "abschlagszahlung" as Payment["type"],
    invoiceDate: new Date().toISOString().slice(0, 10),
    amountNet: "",
    amountGross: "",
    invoiceRef: "",
  });

  useEffect(() => {
    if (!selectedContract) return;
    fetch(`${API}/api/projects/${projectId}/contracts/${selectedContract}/payments`, {
      credentials: "include",
    })
      .then((r) => r.json())
      .then((j) => setPayments(j.data ?? []));
  }, [projectId, selectedContract]);

  async function submit() {
    if (!selectedContract) return;
    const amountNet = Math.round(parseFloat(form.amountNet || "0") * 100);
    const amountGross = Math.round(parseFloat(form.amountGross || "0") * 100);
    const res = await fetch(`${API}/api/projects/${projectId}/contracts/${selectedContract}/payments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        paymentNumber: form.paymentNumber,
        type: form.type,
        invoiceDate: form.invoiceDate,
        invoiceRef: form.invoiceRef || undefined,
        amountNet,
        amountGross,
      }),
    });
    if (res.ok) {
      const j = await res.json();
      setPayments((p) => [...p, j.data]);
      setAdding(false);
      setForm({
        paymentNumber: "",
        type: "abschlagszahlung",
        invoiceDate: new Date().toISOString().slice(0, 10),
        amountNet: "",
        amountGross: "",
        invoiceRef: "",
      });
    }
  }

  return (
    <div className="space-y-4">
      <div className="card p-4 flex items-center justify-between gap-4">
        <select
          className="input max-w-md"
          value={selectedContract}
          onChange={(e) => setSelectedContract(e.target.value)}
        >
          <option value="">Select a contract…</option>
          {contracts.map((c) => (
            <option key={c.id} value={c.id}>
              {c.title} — {c.contractorCompany}
            </option>
          ))}
        </select>
        <button
          className="btn-primary text-xs"
          disabled={!selectedContract}
          onClick={() => setAdding(true)}
        >
          + Payment
        </button>
      </div>

      {adding && (
        <div className="card p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Number</label>
              <input className="input" value={form.paymentNumber} onChange={(e) => setForm({ ...form, paymentNumber: e.target.value })} />
            </div>
            <div>
              <label className="label">Type</label>
              <select className="input" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as Payment["type"] })}>
                <option value="abschlagszahlung">Interim payment</option>
                <option value="teilschlussrechnung">Partial final invoice</option>
                <option value="schlussrechnung">Final invoice</option>
                <option value="sicherheitseinbehalt">Retention release</option>
              </select>
            </div>
            <div>
              <label className="label">Invoice date</label>
              <input type="date" className="input" value={form.invoiceDate} onChange={(e) => setForm({ ...form, invoiceDate: e.target.value })} />
            </div>
            <div>
              <label className="label">Invoice reference</label>
              <input className="input" value={form.invoiceRef} onChange={(e) => setForm({ ...form, invoiceRef: e.target.value })} />
            </div>
            <div>
              <label className="label">Amount net (€)</label>
              <input type="number" step="0.01" className="input" value={form.amountNet} onChange={(e) => setForm({ ...form, amountNet: e.target.value })} />
            </div>
            <div>
              <label className="label">Amount gross (€)</label>
              <input type="number" step="0.01" className="input" value={form.amountGross} onChange={(e) => setForm({ ...form, amountGross: e.target.value })} />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button className="btn-secondary text-xs" onClick={() => setAdding(false)}>
              Cancel
            </button>
            <button className="btn-primary text-xs" onClick={submit}>
              Save
            </button>
          </div>
        </div>
      )}

      {selectedContract && (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-bg-inset/30">
                <th className="text-left px-4 py-2 text-xs font-medium text-text-tertiary uppercase">No.</th>
                <th className="text-left px-4 py-2 text-xs font-medium text-text-tertiary uppercase">Type</th>
                <th className="text-left px-4 py-2 text-xs font-medium text-text-tertiary uppercase">Date</th>
                <th className="text-right px-4 py-2 text-xs font-medium text-text-tertiary uppercase">Net</th>
                <th className="text-right px-4 py-2 text-xs font-medium text-text-tertiary uppercase">Gross</th>
                <th className="text-right px-4 py-2 text-xs font-medium text-text-tertiary uppercase">Cumulative</th>
                <th className="text-left px-4 py-2 text-xs font-medium text-text-tertiary uppercase">Status</th>
              </tr>
            </thead>
            <tbody>
              {payments.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-text-quaternary">
                    No payments recorded yet.
                  </td>
                </tr>
              ) : (
                payments.map((p) => (
                  <tr key={p.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-2 font-mono text-xs">{p.paymentNumber}</td>
                    <td className="px-4 py-2">{PAYMENT_TYPE_LABEL[p.type] ?? p.type}</td>
                    <td className="px-4 py-2 text-xs">{formatDate(p.invoiceDate)}</td>
                    <td className="px-4 py-2 text-right font-mono">{formatEur(p.amountNet)}</td>
                    <td className="px-4 py-2 text-right font-mono">{formatEur(p.amountGross)}</td>
                    <td className="px-4 py-2 text-right font-mono">{formatEur(p.cumulativeNet)}</td>
                    <td className="px-4 py-2">
                      <DataStateChip state={chipState(p.status)} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Acceptance tab (Abnahmen) ───────────────────────────────

function AbnahmenTab({ projectId, contracts }: { projectId: string; contracts: Contract[] }) {
  const [selectedContract, setSelectedContract] = useState("");
  const [items, setItems] = useState<Abnahme[]>([]);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({
    type: "foermliche_abnahme" as Abnahme["type"],
    scheduledDate: new Date().toISOString().slice(0, 10),
    notes: "",
  });

  useEffect(() => {
    if (!selectedContract) return;
    fetch(`${API}/api/projects/${projectId}/contracts/${selectedContract}/abnahmen`, {
      credentials: "include",
    })
      .then((r) => r.json())
      .then((j) => setItems(j.data ?? []));
  }, [projectId, selectedContract]);

  async function submit() {
    if (!selectedContract) return;
    const res = await fetch(`${API}/api/projects/${projectId}/contracts/${selectedContract}/abnahmen`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        type: form.type,
        scheduledDate: form.scheduledDate,
        notes: form.notes || undefined,
      }),
    });
    if (res.ok) {
      const j = await res.json();
      setItems((p) => [...p, j.data]);
      setAdding(false);
    }
  }

  async function complete(a: Abnahme, withDefects: boolean) {
    const res = await fetch(
      `${API}/api/projects/${projectId}/contracts/${selectedContract}/abnahmen/${a.id}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          status: withDefects ? "completed_with_defects" : "completed_without_defects",
          actualDate: new Date().toISOString().slice(0, 10),
        }),
      }
    );
    if (res.ok) {
      const j = await res.json();
      setItems((arr) => arr.map((i) => (i.id === a.id ? j.data : i)));
    }
  }

  return (
    <div className="space-y-4">
      <div className="card p-4 flex items-center justify-between gap-4">
        <select className="input max-w-md" value={selectedContract} onChange={(e) => setSelectedContract(e.target.value)}>
          <option value="">Select a contract…</option>
          {contracts.map((c) => (
            <option key={c.id} value={c.id}>
              {c.title} — {c.contractorCompany}
            </option>
          ))}
        </select>
        <button className="btn-primary text-xs" disabled={!selectedContract} onClick={() => setAdding(true)}>
          + Schedule acceptance
        </button>
      </div>

      {adding && (
        <div className="card p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Type</label>
              <select className="input" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as Abnahme["type"] })}>
                <option value="foermliche_abnahme">Formal acceptance</option>
                <option value="stillschweigende_abnahme">Implied acceptance</option>
                <option value="teilabnahme">Partial acceptance</option>
                <option value="fiktive_abnahme">Deemed acceptance</option>
              </select>
            </div>
            <div>
              <label className="label">Scheduled date</label>
              <input type="date" className="input" value={form.scheduledDate} onChange={(e) => setForm({ ...form, scheduledDate: e.target.value })} />
            </div>
          </div>
          <div>
            <label className="label">Notes</label>
            <textarea className="input" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
          <div className="flex justify-end gap-2">
            <button className="btn-secondary text-xs" onClick={() => setAdding(false)}>
              Cancel
            </button>
            <button className="btn-primary text-xs" onClick={submit}>
              Save
            </button>
          </div>
        </div>
      )}

      {selectedContract && (
        <div className="space-y-2">
          {items.length === 0 ? (
            <div className="card p-8 text-center text-text-tertiary">No acceptance scheduled yet.</div>
          ) : (
            items.map((a) => (
              <div key={a.id} className="card p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="font-medium text-sm">{ABNAHME_TYPE_LABEL[a.type] ?? a.type.replace(/_/g, " ")}</div>
                    <div className="text-xs text-text-tertiary mt-0.5">
                      Scheduled: {formatDate(a.scheduledDate)}
                      {a.actualDate && <> · Performed: {formatDate(a.actualDate)}</>}
                      {a.warrantyStartDate && <> · Warranty starts: {formatDate(a.warrantyStartDate)}</>}
                    </div>
                  </div>
                  <DataStateChip state={chipState(a.status)} />
                </div>
                {a.status === "scheduled" && (
                  <div className="flex gap-2 mt-3">
                    <button className="btn-secondary text-xs" onClick={() => complete(a, false)}>
                      Complete without defects
                    </button>
                    <button className="btn-secondary text-xs" onClick={() => complete(a, true)}>
                      Complete with defects
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ─── Change Orders tab (Nachträge) ───────────────────────────

function NachtraegeTab({ projectId, contracts }: { projectId: string; contracts: Contract[] }) {
  const [selectedContract, setSelectedContract] = useState("");
  const [items, setItems] = useState<Nachtrag[]>([]);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({
    nachtragNumber: "",
    title: "",
    type: "zusaetzliche_leistung" as Nachtrag["type"],
    description: "",
    requestedAmountNet: "",
    submittedBy: "",
    scheduleImpactDays: "0",
  });

  useEffect(() => {
    if (!selectedContract) return;
    fetch(`${API}/api/projects/${projectId}/contracts/${selectedContract}/nachtraege`, { credentials: "include" })
      .then((r) => r.json())
      .then((j) => setItems(j.data ?? []));
  }, [projectId, selectedContract]);

  async function submit() {
    if (!selectedContract) return;
    const res = await fetch(`${API}/api/projects/${projectId}/contracts/${selectedContract}/nachtraege`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        nachtragNumber: form.nachtragNumber,
        title: form.title,
        type: form.type,
        description: form.description,
        requestedAmountNet: Math.round(parseFloat(form.requestedAmountNet || "0") * 100),
        scheduleImpactDays: parseInt(form.scheduleImpactDays || "0", 10),
        submittedBy: form.submittedBy,
      }),
    });
    if (res.ok) {
      const j = await res.json();
      setItems((p) => [j.data, ...p]);
      setAdding(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="card p-4 flex items-center justify-between gap-4">
        <select className="input max-w-md" value={selectedContract} onChange={(e) => setSelectedContract(e.target.value)}>
          <option value="">Select a contract…</option>
          {contracts.map((c) => (
            <option key={c.id} value={c.id}>
              {c.title} — {c.contractorCompany}
            </option>
          ))}
        </select>
        <button className="btn-primary text-xs" disabled={!selectedContract} onClick={() => setAdding(true)}>
          + Change order
        </button>
      </div>

      {adding && (
        <div className="card p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Number</label>
              <input className="input" value={form.nachtragNumber} onChange={(e) => setForm({ ...form, nachtragNumber: e.target.value })} />
            </div>
            <div>
              <label className="label">Type</label>
              <select className="input" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as Nachtrag["type"] })}>
                <option value="mengenabweichung">Quantity variation</option>
                <option value="geaenderte_leistung">Modified scope</option>
                <option value="zusaetzliche_leistung">Additional scope</option>
                <option value="selbst_uebernahme">Owner-performed</option>
                <option value="behinderung">Obstruction</option>
                <option value="stundenlohn">Time-and-materials</option>
              </select>
            </div>
          </div>
          <div>
            <label className="label">Title</label>
            <input className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </div>
          <div>
            <label className="label">Description</label>
            <textarea className="input" rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="label">Requested amount net (€)</label>
              <input type="number" step="0.01" className="input" value={form.requestedAmountNet} onChange={(e) => setForm({ ...form, requestedAmountNet: e.target.value })} />
            </div>
            <div>
              <label className="label">Schedule impact (days)</label>
              <input type="number" className="input" value={form.scheduleImpactDays} onChange={(e) => setForm({ ...form, scheduleImpactDays: e.target.value })} />
            </div>
            <div>
              <label className="label">Submitted by</label>
              <input className="input" value={form.submittedBy} onChange={(e) => setForm({ ...form, submittedBy: e.target.value })} />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button className="btn-secondary text-xs" onClick={() => setAdding(false)}>
              Cancel
            </button>
            <button className="btn-primary text-xs" onClick={submit}>
              Save
            </button>
          </div>
        </div>
      )}

      {selectedContract && (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-bg-inset/30">
                <th className="text-left px-4 py-2 text-xs font-medium text-text-tertiary uppercase">No.</th>
                <th className="text-left px-4 py-2 text-xs font-medium text-text-tertiary uppercase">Title</th>
                <th className="text-left px-4 py-2 text-xs font-medium text-text-tertiary uppercase">Type</th>
                <th className="text-right px-4 py-2 text-xs font-medium text-text-tertiary uppercase">Requested</th>
                <th className="text-right px-4 py-2 text-xs font-medium text-text-tertiary uppercase">Approved</th>
                <th className="text-right px-4 py-2 text-xs font-medium text-text-tertiary uppercase">Days</th>
                <th className="text-left px-4 py-2 text-xs font-medium text-text-tertiary uppercase">Status</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-text-quaternary">
                    No change orders.
                  </td>
                </tr>
              ) : (
                items.map((n) => (
                  <tr key={n.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-2 font-mono text-xs">{n.nachtragNumber}</td>
                    <td className="px-4 py-2">{n.title}</td>
                    <td className="px-4 py-2 text-xs">{NACHTRAG_TYPE_LABEL[n.type] ?? n.type.replace(/_/g, " ")}</td>
                    <td className="px-4 py-2 text-right font-mono">{formatEur(n.requestedAmountNet)}</td>
                    <td className="px-4 py-2 text-right font-mono">
                      {n.approvedAmountNet !== null ? formatEur(n.approvedAmountNet) : "—"}
                    </td>
                    <td className="px-4 py-2 text-right font-mono">{n.scheduleImpactDays}</td>
                    <td className="px-4 py-2">
                      <DataStateChip state={chipState(n.status)} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Site Diary tab (Bautagebuch) ────────────────────────────

function BautagebuchTab({ projectId }: { projectId: string }) {
  const [entries, setEntries] = useState<DiaryEntry[]>([]);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({
    entryDate: new Date().toISOString().slice(0, 10),
    activitiesPerformed: "",
    temperature: "",
    precipitation: "",
    wind: "",
  });

  const fetchEntries = useCallback(async () => {
    const res = await fetch(`${API}/api/projects/${projectId}/construction-diary-entries`, { credentials: "include" });
    if (res.ok) {
      const j = await res.json();
      setEntries(j.data ?? []);
    }
  }, [projectId]);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  async function submit() {
    const res = await fetch(`${API}/api/projects/${projectId}/construction-diary-entries`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        entryDate: form.entryDate,
        activitiesPerformed: form.activitiesPerformed || undefined,
        weatherData: form.temperature || form.precipitation || form.wind
          ? {
              temperature: form.temperature || undefined,
              precipitation: form.precipitation || undefined,
              wind: form.wind || undefined,
            }
          : undefined,
      }),
    });
    if (res.ok) {
      await fetchEntries();
      setAdding(false);
      setForm({
        entryDate: new Date().toISOString().slice(0, 10),
        activitiesPerformed: "",
        temperature: "",
        precipitation: "",
        wind: "",
      });
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button className="btn-primary text-xs" onClick={() => setAdding(true)}>
          + Diary entry
        </button>
      </div>

      {adding && (
        <div className="card p-4 space-y-3">
          <div className="grid grid-cols-4 gap-3">
            <div>
              <label className="label">Date</label>
              <input type="date" className="input" value={form.entryDate} onChange={(e) => setForm({ ...form, entryDate: e.target.value })} />
            </div>
            <div>
              <label className="label">Temperature</label>
              <input className="input" placeholder="e.g. 12°C" value={form.temperature} onChange={(e) => setForm({ ...form, temperature: e.target.value })} />
            </div>
            <div>
              <label className="label">Precipitation</label>
              <input className="input" value={form.precipitation} onChange={(e) => setForm({ ...form, precipitation: e.target.value })} />
            </div>
            <div>
              <label className="label">Wind</label>
              <input className="input" value={form.wind} onChange={(e) => setForm({ ...form, wind: e.target.value })} />
            </div>
          </div>
          <div>
            <label className="label">Activities / notes</label>
            <textarea className="input" rows={3} value={form.activitiesPerformed} onChange={(e) => setForm({ ...form, activitiesPerformed: e.target.value })} />
          </div>
          <div className="flex justify-end gap-2">
            <button className="btn-secondary text-xs" onClick={() => setAdding(false)}>
              Cancel
            </button>
            <button className="btn-primary text-xs" onClick={submit}>
              Save
            </button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {entries.length === 0 ? (
          <div className="card p-8 text-center text-text-tertiary">No diary entries yet.</div>
        ) : (
          entries.map((e) => (
            <div key={e.id} className="card p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="font-medium">{formatDate(e.entryDate)}</div>
                <DataStateChip state={e.status === "signed_off" ? "CONFIRMED" : "DERIVED"} />
              </div>
              {e.weatherData && (
                <div className="text-xs text-text-tertiary mt-1">
                  {[e.weatherData.temperature, e.weatherData.precipitation, e.weatherData.wind].filter(Boolean).join(" · ")}
                </div>
              )}
              {e.activitiesPerformed && (
                <p className="text-sm text-text-secondary mt-2 whitespace-pre-line">{e.activitiesPerformed}</p>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
