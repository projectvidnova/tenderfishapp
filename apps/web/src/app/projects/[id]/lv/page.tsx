"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import AppShell from "@/components/layout/AppShell";
import { ProjectTopBar } from "@/components/project/ProjectTopBar";
import { DataStateChip } from "@/components/ui/DataStateChip";
import { CheckCircle2, AlertTriangle, Download, Upload, ChevronRight, ChevronDown, RefreshCw } from "lucide-react";
import { formatDin276Label } from "@tenderfish/shared";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

type Lv = {
  id: string;
  projectId: string;
  title: string;
  lvNumber: string | null;
  exchangePhase: string;
  totalNet: number;
  totalGross: number;
  positionCount: number;
  gaebVersion: string | null;
  parentLvId: string | null;
  version: number;
  createdAt: string;
};

type Position = {
  id: string;
  ordnungszahl: string;
  titel: string | null;
  titelLevel: number;
  kurztext: string;
  langtext: string | null;
  menge: number;
  einheit: string;
  einheitspreis: number;
  gesamtpreis: number;
  costGroupCode: string | null;
  din276Confidence: number | null;
  din276Source: string | null;
  din276Rationale: string | null;
};

type MathError = {
  ordnungszahl: string;
  expected: number;
  actual: number;
  delta: number;
  kind: "line" | "group" | "total";
};

type MathReport = {
  passed: boolean;
  errors: MathError[];
  checkedAt: string;
  totals: { computedNet: number; storedNet: number; storedGross: number };
  positionCount: number;
};

function formatEur(cents: number) {
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(cents / 100);
}

function formatQty(menge: number) {
  return (menge / 1000).toLocaleString("de-DE", { maximumFractionDigits: 3 });
}

export default function LvPage() {
  const params = useParams() as { id: string };
  const projectId = params.id;

  const [lvs, setLvs] = useState<Lv[]>([]);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchLvs = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`${API}/api/projects/${projectId}/lv`, { credentials: "include" });
    if (res.ok) {
      const json = await res.json();
      setLvs(json.data ?? []);
    }
    setLoading(false);
  }, [projectId]);

  useEffect(() => {
    fetchLvs();
  }, [fetchLvs]);

  async function handleImport(file: File) {
    setImporting(true);
    setImportMessage(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`${API}/api/projects/${projectId}/lv/import-gaeb`, {
        method: "POST",
        body: fd,
        credentials: "include",
      });
      const json = await res.json();
      if (!res.ok) {
        setImportMessage(`Import failed: ${json.error ?? res.statusText}`);
      } else {
        const m = json.data?.mathReport;
        const cls = json.data?.classification;
        setImportMessage(
          `Imported ${json.data.positionsImported} positions. ` +
            (cls ? `Classified ${cls.updated} (${cls.ruleHits} rules / ${cls.aiHits} AI). ` : "") +
            (m ? (m.passed ? "Math verified ✓" : `Math: ${m.errors.length} discrepancies`) : "")
        );
        await fetchLvs();
      }
    } catch (err) {
      setImportMessage(`Import error: ${(err as Error).message}`);
    } finally {
      setImporting(false);
    }
  }

  return (
    <AppShell>
      <ProjectTopBar projectId={projectId} />

      <div className="w-full space-y-6 mt-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold">Leistungsverzeichnisse</h1>
            <p className="text-sm text-text-tertiary mt-0.5">
              GAEB DA XML 3.2 — import bids (X83/X84), export tenders (X81) and contracts (X86).
            </p>
          </div>
          <div className="flex items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept=".x81,.x82,.x83,.x84,.x86,.xml"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleImport(f);
                e.target.value = "";
              }}
            />
            <button
              className="btn-primary inline-flex items-center gap-2"
              disabled={importing}
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload size={16} />
              {importing ? "Importing…" : "Import GAEB"}
            </button>
          </div>
        </div>

        {importMessage && (
          <div className="card p-3 text-sm bg-bg-inset/40">{importMessage}</div>
        )}

        {loading ? (
          <div className="card p-8 text-center text-text-tertiary">Loading…</div>
        ) : lvs.length === 0 ? (
          <div className="card p-8 text-center">
            <p className="text-text-secondary">No Leistungsverzeichnisse yet.</p>
            <p className="text-sm text-text-tertiary mt-2">
              Upload a GAEB X83 file to get started.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {lvs.map((lv) => (
              <LvCard key={lv.id} projectId={projectId} lv={lv} />
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}

function LvCard({ projectId, lv }: { projectId: string; lv: Lv }) {
  const [expanded, setExpanded] = useState(false);
  const [positions, setPositions] = useState<Position[]>([]);
  const [mathReport, setMathReport] = useState<MathReport | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<{ message: string; report?: MathReport } | null>(null);

  const verify = useCallback(async () => {
    setVerifying(true);
    const res = await fetch(`${API}/api/projects/${projectId}/lv/${lv.id}/verify-math`, {
      method: "POST",
      credentials: "include",
    });
    if (res.ok) {
      const json = await res.json();
      setMathReport(json.data);
    }
    setVerifying(false);
  }, [projectId, lv.id]);

  const loadPositions = useCallback(async () => {
    const res = await fetch(`${API}/api/projects/${projectId}/lv/${lv.id}`, { credentials: "include" });
    if (res.ok) {
      const json = await res.json();
      setPositions(json.data?.positions ?? []);
    }
  }, [projectId, lv.id]);

  useEffect(() => {
    if (expanded && positions.length === 0) {
      loadPositions();
    }
    if (expanded && !mathReport && !verifying) {
      verify();
    }
  }, [expanded, positions.length, mathReport, verifying, loadPositions, verify]);

  async function exportX81() {
    setExporting(true);
    setExportError(null);
    try {
      const res = await fetch(`${API}/api/projects/${projectId}/lv/${lv.id}/export-gaeb`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ phase: "x81" }),
      });
      if (!res.ok) {
        const json = await res.json();
        setExportError({ message: json.error ?? `HTTP ${res.status}`, report: json.report });
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${lv.lvNumber ?? lv.title}_X81.xml`.replace(/[^a-z0-9_.\-]/gi, "_");
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  }

  async function reclassify() {
    await fetch(`${API}/api/projects/${projectId}/lv/${lv.id}/classify-din276`, {
      method: "POST",
      credentials: "include",
    });
    await loadPositions();
  }

  const mathPill = mathReport ? (
    mathReport.passed ? (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-mono rounded-full bg-status-success-light text-state-confirmed-text border border-status-success-border">
        <CheckCircle2 size={12} /> Math verified
      </span>
    ) : (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-mono rounded-full bg-status-danger-light text-state-missing-text border border-status-danger-border">
        <AlertTriangle size={12} /> {mathReport.errors.length} discrepancies
      </span>
    )
  ) : (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-mono rounded-full bg-bg-inset text-text-tertiary">
      Math: not checked
    </span>
  );

  return (
    <div className="card overflow-hidden">
      <button
        className="w-full flex items-center justify-between gap-4 px-4 py-3 hover:bg-bg-inset/30 text-left"
        onClick={() => setExpanded((v) => !v)}
      >
        <div className="flex items-center gap-3 min-w-0">
          {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          <div className="min-w-0">
            <div className="font-medium text-text-primary truncate">
              {lv.title} {lv.version > 1 && <span className="text-xs text-text-tertiary">v{lv.version}</span>}
            </div>
            <div className="text-xs text-text-tertiary mt-0.5 flex items-center gap-3">
              <span className="font-mono">{lv.exchangePhase.replace("gaeb_", "X")}</span>
              <span>{lv.positionCount} positions</span>
              <span>{formatEur(lv.totalNet)} net</span>
              {lv.gaebVersion && <span>{lv.gaebVersion}</span>}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">{mathPill}</div>
      </button>

      {expanded && (
        <div className="border-t border-border">
          <div className="px-4 py-3 flex items-center justify-between bg-bg-inset/20 gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <button
                className="btn-secondary text-xs inline-flex items-center gap-1"
                onClick={verify}
                disabled={verifying}
              >
                <RefreshCw size={12} /> {verifying ? "Verifying…" : "Re-verify math"}
              </button>
              <button
                className="btn-secondary text-xs inline-flex items-center gap-1"
                onClick={reclassify}
              >
                <RefreshCw size={12} /> Re-classify DIN 276
              </button>
            </div>
            <button
              className="btn-primary text-xs inline-flex items-center gap-1"
              onClick={exportX81}
              disabled={exporting}
            >
              <Download size={12} /> {exporting ? "Exporting…" : "Export X81"}
            </button>
          </div>

          {exportError && (
            <div className="px-4 py-3 bg-status-danger-light/40 border-b border-status-danger-border text-xs">
              <div className="font-semibold text-state-missing-text">Export blocked: {exportError.message}</div>
              {exportError.report && (
                <ul className="mt-2 space-y-0.5 font-mono text-xs">
                  {exportError.report.errors.slice(0, 5).map((e, idx) => (
                    <li key={idx}>
                      {e.kind} @ {e.ordnungszahl}: expected {formatEur(e.expected)}, actual {formatEur(e.actual)} (Δ {formatEur(e.delta)})
                    </li>
                  ))}
                  {exportError.report.errors.length > 5 && <li>… and {exportError.report.errors.length - 5} more</li>}
                </ul>
              )}
            </div>
          )}

          {mathReport && !mathReport.passed && (
            <details className="px-4 py-3 bg-status-danger-light/30 border-b border-border">
              <summary className="text-xs font-semibold cursor-pointer text-state-missing-text">
                {mathReport.errors.length} arithmetic discrepancies
              </summary>
              <ul className="mt-2 space-y-0.5 font-mono text-xs text-text-secondary">
                {mathReport.errors.slice(0, 20).map((e, idx) => (
                  <li key={idx}>
                    [{e.kind}] {e.ordnungszahl}: expected {formatEur(e.expected)}, actual {formatEur(e.actual)}, Δ {formatEur(e.delta)}
                  </li>
                ))}
                {mathReport.errors.length > 20 && <li>… and {mathReport.errors.length - 20} more</li>}
              </ul>
            </details>
          )}

          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-bg-inset/30">
                <th className="text-left px-4 py-2 text-xs font-medium text-text-tertiary uppercase font-mono">OZ</th>
                <th className="text-left px-4 py-2 text-xs font-medium text-text-tertiary uppercase">Description</th>
                <th className="text-left px-4 py-2 text-xs font-medium text-text-tertiary uppercase">DIN 276</th>
                <th className="text-right px-4 py-2 text-xs font-medium text-text-tertiary uppercase">Qty</th>
                <th className="text-left px-4 py-2 text-xs font-medium text-text-tertiary uppercase">Unit</th>
                <th className="text-right px-4 py-2 text-xs font-medium text-text-tertiary uppercase">Unit €</th>
                <th className="text-right px-4 py-2 text-xs font-medium text-text-tertiary uppercase">Total €</th>
              </tr>
            </thead>
            <tbody>
              {positions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-text-quaternary">
                    Loading positions…
                  </td>
                </tr>
              ) : (
                positions.map((p) => (
                  <tr key={p.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-2 font-mono text-xs">{p.ordnungszahl}</td>
                    <td className="px-4 py-2 text-text-secondary">
                      <div className="font-medium">{p.kurztext}</div>
                      {p.titel && <div className="text-xs text-text-quaternary mt-0.5">{p.titel}</div>}
                    </td>
                    <td className="px-4 py-2">
                      {p.costGroupCode ? (
                        <div className="flex items-center gap-1.5">
                          <span
                            className="font-mono text-xs px-1.5 py-0.5 rounded bg-bg-inset border border-border"
                            title={formatDin276Label(p.costGroupCode)}
                          >
                            KG{p.costGroupCode}
                          </span>
                          {typeof p.din276Confidence === "number" && (
                            <DataStateChip
                              state={
                                p.din276Source === "manual"
                                  ? "CONFIRMED"
                                  : p.din276Confidence >= 80
                                  ? "DERIVED"
                                  : "UNCLEAR"
                              }
                              confidence={p.din276Confidence}
                            />
                          )}
                        </div>
                      ) : (
                        <span className="text-text-quaternary text-xs">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-right font-mono">{formatQty(p.menge)}</td>
                    <td className="px-4 py-2 text-xs">{p.einheit}</td>
                    <td className="px-4 py-2 text-right font-mono">{formatEur(p.einheitspreis)}</td>
                    <td className="px-4 py-2 text-right font-mono font-medium">{formatEur(p.gesamtpreis)}</td>
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
