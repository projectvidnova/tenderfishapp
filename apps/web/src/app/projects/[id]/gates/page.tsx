"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { Check, X } from "lucide-react";
import AppShell from "@/components/layout/AppShell";
import { Modal } from "@/components/ui/Modal";
import { formatDate } from "@/lib/formatters";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

const GATE_META: Record<string, { name: string; purpose: string; unlocks: string[] }> = {
  A: { name: "Project Intake Complete", purpose: "Confirms that sufficient baseline information exists to begin structured planning.", unlocks: ["Project dashboard", "Phase planning", "Risk register", "Document management"] },
  B: { name: "Planning Ready", purpose: "Confirms the project objective is clear and a first risk scan has been performed.", unlocks: ["Schedule generation", "Responsibility matrix", "Approval workflows"] },
  C: { name: "Consultant Invitation Ready", purpose: "Confirms that sufficient project documentation exists to invite external consultants.", unlocks: ["Consultant invitations", "Discipline-specific scope sharing"] },
  D: { name: "Tender Ready", purpose: "Confirms that procurement packages are complete and ready for market issue.", unlocks: ["Bidder invitations", "Tender issue", "Bid return tracking"] },
  E: { name: "Execution Ready", purpose: "Confirms that contracts are in place and the project is ready for site execution.", unlocks: ["Execution evidence tracking", "Shop drawing reviews", "Site submissions"] },
  F: { name: "Closeout Ready", purpose: "Confirms that all execution is complete and the project is ready for handover.", unlocks: ["Project closeout", "Final documentation", "Defect liability management"] },
};

type Attestation = {
  supporting_quote: string;
  source_document_id: string;
  source_document_name: string | null;
  reason: string;
};

type Criterion = {
  key: string;
  label: string;
  met: boolean;
  autoCheck: boolean;
  attestation?: Attestation;
};

type Gate = {
  /** Row UUID — use with POST `/gates/:id/reverify` for full stored-document AI rescan */
  id: string;
  gate: string;
  status: string;
  criteria: Criterion[];
  readinessPercent: number;
  criteriaCount: number;
  criteriaMet: number;
  overrideActive: boolean;
  overrideReason: string | null;
  overrideBy: string | null;
  overrideAt: string | null;
};

const STATUS_STYLES: Record<string, { label: string; cls: string }> = {
  complete: { label: "Complete", cls: "bg-status-success-bg text-status-success-fg border-status-success-border" },
  in_progress: { label: "In Progress", cls: "bg-status-warning-bg text-brand-orange border-status-warning-border" },
  locked: { label: "Locked", cls: "bg-bg-inset text-text-tertiary border-border" },
  overridden: { label: "Overridden", cls: "bg-orange-100 text-orange-700 border-orange-300" },
};

export default function GatesPage() {
  const { id } = useParams() as { id: string };
  const [gates, setGates] = useState<Gate[]>([]);
  const [expanded, setExpanded] = useState<string | null>("A");
  const [loading, setLoading] = useState(true);
  const [overrideGate, setOverrideGate] = useState<string | null>(null);
  const [overrideReason, setOverrideReason] = useState("");
  const [overrideAck, setOverrideAck] = useState(false);
  const [reverifyGate, setReverifyGate] = useState<string | null>(null);
  const [reverifyFiles, setReverifyFiles] = useState<FileList | null>(null);
  const [reverifyText, setReverifyText] = useState("");
  const [reverifyStatus, setReverifyStatus] = useState<string>("");
  const [rescanningGateId, setRescanningGateId] = useState<string | null>(null);

  const fetchGates = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/projects/${id}/gates/detail`, { credentials: "include" });
      if (res.ok) setGates((await res.json()).data);
    } catch { /* ignore */ }
    setLoading(false);
  }, [id]);

  useEffect(() => { fetchGates(); }, [fetchGates]);

  async function completeGate(gate: string) {
    const res = await fetch(`${API}/api/projects/${id}/gates/${gate}/complete`, { method: "POST", credentials: "include" });
    if (!res.ok) {
      const err = await res.json();
      alert(err.message || err.error);
      return;
    }
    fetchGates();
  }

  async function submitOverride() {
    if (!overrideGate || overrideReason.trim().length < 50 || !overrideAck) return;
    const res = await fetch(`${API}/api/projects/${id}/gates/${overrideGate}/override`, {
      credentials: "include",
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: overrideReason.trim() }),
    });
    if (!res.ok) {
      const err = await res.json();
      alert(err.message || err.error);
      return;
    }
    setOverrideGate(null);
    setOverrideReason("");
    setOverrideAck(false);
    fetchGates();
  }

  async function submitReverify() {
    if (!reverifyGate) return;
    const hasFiles = !!reverifyFiles && reverifyFiles.length > 0;
    const hasText = reverifyText.trim().length > 0;
    if (!hasFiles && !hasText) return;

    const activeGate = reverifyGate;
    const formData = new FormData();
    if (hasFiles) {
      Array.from(reverifyFiles || []).forEach((file) => {
        formData.append("files", file);
      });
    }
    if (hasText) {
      formData.append("evidenceText", reverifyText.trim());
    }

    // Close modal immediately once evidence is attached and submitted.
    setReverifyGate(null);
    setReverifyFiles(null);
    setReverifyText("");
    setReverifyStatus(`Checking Gate ${activeGate} criteria with AI...`);

    const res = await fetch(`${API}/api/projects/${id}/gates/${activeGate}/reverify`, {
      method: "POST",
      credentials: "include",
      body: formData,
    });
    if (!res.ok) {
      const err = await res.json();
      alert(err.message || err.error);
      setReverifyStatus(`Gate ${activeGate} re-verification failed.`);
      return;
    }
    setReverifyStatus(`Gate ${activeGate} criteria updated from evidence.`);
    await fetchGates();
  }

  /** Re-run AI on every stored project document and refresh gate criteria (algorithmic). */
  async function rescanStoredDocuments(gateRow: Gate) {
    setRescanningGateId(gateRow.id);
    try {
      const res = await fetch(
        `${API}/api/projects/${id}/gates/${gateRow.id}/reverify`,
        {
          method: "POST",
          credentials: "include",
        }
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(
          typeof err.message === "string"
            ? err.message
            : err.error || "Re-scan failed"
        );
        return;
      }
      const json = (await res.json().catch(() => ({}))) as {
        data?: {
          rescanNotice?: string;
          rescan?: { documentsProcessed?: number; documentsSkipped?: number };
        };
      };
      if (json.data?.rescanNotice) {
        alert(json.data.rescanNotice);
      } else if (json.data?.rescan?.documentsProcessed != null && json.data.rescan.documentsProcessed > 0) {
        const { documentsProcessed, documentsSkipped } = json.data.rescan;
        alert(
          `Re-analyzed ${documentsProcessed} stored document(s).` +
            (documentsSkipped ? ` ${documentsSkipped} skipped (no file in storage).` : "")
        );
      }
      await fetchGates();
    } finally {
      setRescanningGateId(null);
    }
  }

  if (loading) {
    return (
      <AppShell>
        <div className="flex items-center justify-center h-64 text-text-quaternary text-sm">Loading gates…</div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold text-text-primary">Gate Control</h1>

        <div className="space-y-3">
          {gates.map((g) => {
            const meta = GATE_META[g.gate];
            const style = STATUS_STYLES[g.status] || STATUS_STYLES.locked;
            const isExpanded = expanded === g.gate;
            const allMet = g.criteriaMet === g.criteriaCount && g.criteriaCount > 0;
            const canComplete = g.status === "in_progress" && allMet;

            return (
              <div key={g.gate} className="card overflow-hidden">
                {/* Header */}
                <button
                  onClick={() => setExpanded(isExpanded ? null : g.gate)}
                  className="w-full px-5 py-4 flex items-center justify-between hover:bg-bg-inset/30 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 ${
                      g.status === "complete" ? "border-green-500 bg-status-success-light" :
                      g.status === "in_progress" ? "border-brand-orange bg-status-warning-light" :
                      g.status === "overridden" ? "border-orange-500 bg-orange-50" :
                      "border-border bg-bg-bg-page"
                    }`}>
                      <span className="font-mono text-sm font-semibold text-text-primary">{g.gate}</span>
                    </div>
                    <div className="text-left">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-text-primary">Gate {g.gate}: {meta?.name}</span>
                        <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-sm border ${style.cls}`}>
                          {style.label}{g.status === "overridden" && " *"}
                        </span>
                      </div>
                      <p className="text-xs text-text-tertiary mt-0.5">{meta?.purpose}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-sm text-text-tertiary">{g.readinessPercent}%</span>
                    <svg className={`w-4 h-4 text-text-quaternary transition-transform ${isExpanded ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </button>

                {/* Expanded body */}
                {isExpanded && (
                  <div className="px-5 pb-5 space-y-4 border-t border-border">
                    {/* Override banner */}
                    {g.overrideActive && (
                      <div className="mt-4 bg-orange-50 border border-orange-200 rounded-xl px-4 py-3 text-sm text-orange-700">
                        Overridden on {g.overrideAt ? formatDate(g.overrideAt) : "—"} — {g.overrideReason || "No reason provided"}. All downstream consequences are in effect.
                      </div>
                    )}

                    {/* Readiness bar */}
                    <div className="mt-4">
                      <div className="flex items-center justify-between text-xs text-text-tertiary mb-1">
                        <span>Readiness</span>
                        <span className="font-mono">{g.criteriaMet}/{g.criteriaCount} criteria met</span>
                      </div>
                      <div className="h-2 bg-bg-inset rounded-full overflow-hidden">
                        <div
                          className="h-full bg-brand-orange rounded-full transition-all"
                          style={{ width: `${g.readinessPercent}%` }}
                        />
                      </div>
                    </div>

                    {/* Criteria — read-only (server derives `met` from project evidence) */}
                    <div className="space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="text-xs font-medium text-text-tertiary uppercase tracking-wide">
                          Criteria
                        </h3>
                        <p className="text-[10px] text-text-quaternary text-right max-w-[14rem] leading-snug">
                          Status is algorithmic from uploaded documents and facts — not editable here.
                        </p>
                      </div>
                      {g.criteria.map((c) => (
                        <div
                          key={c.key}
                          className={`rounded-xl border ${
                            c.met ? "border-green-200 bg-status-success-light/50" : "border-border bg-white"
                          }`}
                        >
                          <div className="flex items-center gap-3 p-2.5">
                            <span
                              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border ${
                                c.met
                                  ? "border-status-success-border bg-status-success-light text-status-success-fg"
                                  : "border-border bg-bg-inset text-text-quaternary"
                              }`}
                              aria-hidden
                            >
                              {c.met ? <Check className="h-4 w-4" strokeWidth={2.5} /> : <X className="h-4 w-4" strokeWidth={2} />}
                            </span>
                            <span className={`text-sm flex-1 ${c.met ? "text-status-success-fg" : "text-text-primary"}`}>
                              {c.label}
                            </span>
                            {c.autoCheck && (
                              <span className="text-[10px] text-text-quaternary shrink-0">auto</span>
                            )}
                          </div>
                          {c.met && c.attestation && (
                            <div className="border-t border-green-200/70 bg-status-success-light/30 px-3 py-2 text-xs text-status-success-fg space-y-1">
                              <div className="flex items-baseline gap-1.5 flex-wrap">
                                <span className="font-medium">Confirmed by</span>
                                <span className="font-mono">
                                  {c.attestation.source_document_name || "uploaded evidence"}
                                </span>
                              </div>
                              {c.attestation.supporting_quote && (
                                <blockquote className="border-l-2 border-status-success-border pl-2 italic text-text-secondary">
                                  &ldquo;{c.attestation.supporting_quote}&rdquo;
                                </blockquote>
                              )}
                              {c.attestation.reason && (
                                <div className="text-text-tertiary text-[11px]">{c.attestation.reason}</div>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Unlocks section */}
                    {meta?.unlocks && meta.unlocks.length > 0 && (
                      <div>
                        <h3 className="text-xs font-medium text-text-tertiary uppercase tracking-wide mb-2">Unlocks when complete</h3>
                        <div className="flex flex-wrap gap-2">
                          {meta.unlocks.map((u) => (
                            <span key={u} className="text-xs bg-bg-inset text-text-secondary px-2 py-1 rounded-sm">{u}</span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex items-center gap-3 pt-2">
                      {canComplete && (
                        <button
                          onClick={() => completeGate(g.gate)}
                          className="btn-primary text-sm"
                        >
                          Mark Gate {g.gate} as Complete
                        </button>
                      )}
                      {g.status !== "complete" && g.status !== "locked" && (
                        <button
                          type="button"
                          onClick={() => void rescanStoredDocuments(g)}
                          disabled={!!rescanningGateId}
                          className="btn-secondary text-sm"
                          title="Re-process all documents already stored for this project"
                        >
                          {rescanningGateId === g.id ? "Re-scanning…" : "Re-scan stored documents"}
                        </button>
                      )}
                      {g.status !== "complete" && g.status !== "locked" && (
                        <button
                          onClick={() => {
                            setReverifyGate(g.gate);
                            setReverifyStatus("");
                            setReverifyFiles(null);
                            setReverifyText("");
                          }}
                          className="btn-secondary text-sm"
                        >
                          Add Evidence & Re-verify
                        </button>
                      )}
                      {g.status !== "complete" && g.status !== "locked" && (
                        <button
                          onClick={() => setOverrideGate(g.gate)}
                          className="btn-secondary text-sm text-orange-600 border-orange-300 hover:bg-orange-50"
                        >
                          Override Gate
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Override Modal */}
        <Modal
          open={!!overrideGate}
          onClose={() => { setOverrideGate(null); setOverrideReason(""); setOverrideAck(false); }}
          title={`Override Gate ${overrideGate}`}
        >
          <div className="space-y-4">
            <div className="bg-orange-50 border border-orange-200 rounded-xl px-4 py-3 text-sm text-orange-700">
              You are overriding Gate {overrideGate}. This action is permanent and logged.
            </div>
            <div>
              <label className="label">Reason (min 50 characters)</label>
              <textarea
                className="input"
                rows={4}
                value={overrideReason}
                onChange={(e) => setOverrideReason(e.target.value)}
                placeholder="Explain why this gate is being overridden…"
              />
              <span className="text-xs text-text-quaternary mt-1 block">{overrideReason.length}/50 characters</span>
            </div>
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={overrideAck}
                onChange={(e) => setOverrideAck(e.target.checked)}
                className="accent-bronze mt-0.5"
              />
              <span className="text-sm text-text-secondary">I confirm this override and accept responsibility for all downstream consequences.</span>
            </label>
            <div className="flex justify-end gap-3 pt-2">
              <button className="btn-secondary" onClick={() => { setOverrideGate(null); setOverrideReason(""); setOverrideAck(false); }}>Cancel</button>
              <button
                className="bg-orange-600 text-white px-4 py-2 text-sm font-medium rounded-button hover:bg-orange-700 transition-colors"
                onClick={submitOverride}
                disabled={overrideReason.trim().length < 50 || !overrideAck}
              >
                Confirm override
              </button>
            </div>
          </div>
        </Modal>

        <Modal
          open={!!reverifyGate}
          onClose={() => {
            setReverifyGate(null);
            setReverifyFiles(null);
            setReverifyStatus("");
          }}
          title={`Add Evidence — Gate ${reverifyGate}`}
        >
          <div className="space-y-4">
            <p className="text-sm text-text-secondary">
              Upload additional project files and re-run AI verification for this gate.
              Criteria and readiness progress will update automatically.
            </p>
            <div>
              <label className="label">Evidence files</label>
              <input
                type="file"
                multiple
                className="input h-auto py-2"
                onChange={(event) => setReverifyFiles(event.target.files)}
              />
              <span className="text-xs text-text-quaternary mt-1 block">
                Supports PDF, Word, Excel and other parsed intake documents.
              </span>
            </div>
            <div>
              <label className="label">Or add supporting text</label>
              <textarea
                className="input min-h-[110px] resize-y"
                placeholder="Paste additional supporting evidence or notes to re-check this gate..."
                value={reverifyText}
                onChange={(event) => setReverifyText(event.target.value)}
              />
            </div>
            {reverifyStatus && (
              <div className="text-xs text-brand-orange bg-status-warning-light border border-status-warning-border rounded-lg px-3 py-2">
                {reverifyStatus}
              </div>
            )}
            <div className="flex justify-end gap-3 pt-1">
              <button
                className="btn-secondary"
                onClick={() => {
                  setReverifyGate(null);
                  setReverifyFiles(null);
                  setReverifyText("");
                  setReverifyStatus("");
                }}
              >
                Cancel
              </button>
              <button
                className="btn-primary"
                onClick={submitReverify}
                disabled={
                  (!reverifyFiles || reverifyFiles.length === 0) &&
                  reverifyText.trim().length === 0
                }
              >
                Re-verify gate
              </button>
            </div>
          </div>
        </Modal>
      </div>
    </AppShell>
  );
}
