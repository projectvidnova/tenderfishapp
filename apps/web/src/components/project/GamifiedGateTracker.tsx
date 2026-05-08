"use client";

import { useMemo, useState } from "react";
import { Check, Loader2, Lock } from "lucide-react";

const CRITERION_TOOLTIP =
  "This criterion is automatically verified by AI based on your uploaded documents. Manual overrides are disabled for compliance reasons.";

export type GamifiedGate = {
  /** Gate row UUID — required for Re-Verify API (`POST .../gates/:id/reverify`). */
  id?: string;
  gate: string; // "A" | "B" | ... (enum in DB)
  status: string; // "locked" | "in_progress" | "complete" | "overridden"
  criteria: {
    key: string;
    label: string;
    met: boolean;
    autoCheck: boolean;
  }[];
};

export type GamifiedGateTrackerProps = {
  gates: GamifiedGate[];
  orientation?: "vertical" | "horizontal";
  defaultExpandedGate?: string | null;
  /** When set with gate `id`, shows Re-Verify Gate and calls the algorithmic rescan endpoint. */
  projectId?: string;
  apiBaseUrl?: string;
  /** Called after a successful re-verify so parents can refetch gate data. */
  onAfterReverify?: () => void | Promise<void>;
};

function statusIsComplete(status: string) {
  return status === "complete" || status === "COMPLETED";
}

function statusIsLocked(status: string) {
  return status === "locked" || status === "LOCKED";
}

function statusIsInProgress(status: string) {
  return status === "in_progress" || status === "IN_PROGRESS";
}

function AnimatedDrawCheckmark({ className = "" }: { className?: string }) {
  return (
    <span className={className} aria-hidden="true">
      <style>{`
        @keyframes tenderfish_draw_check {
          from { stroke-dashoffset: 60; opacity: 0.65; }
          to { stroke-dashoffset: 0; opacity: 1; }
        }
        .tenderfish_draw_check_path {
          stroke-dasharray: 60;
          stroke-dashoffset: 60;
          animation: tenderfish_draw_check 520ms ease-out forwards;
        }
      `}</style>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
        <path
          className="tenderfish_draw_check_path"
          d="M20 6L9 17l-5-5"
          stroke="currentColor"
          strokeWidth="2.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}

/** Read-only, checkbox-shaped indicator (not an interactive form control). */
function ReadOnlyCriterionCheckbox({ met, autoMet }: { met: boolean; autoMet: boolean }) {
  return (
    <span
      title={CRITERION_TOOLTIP}
      className="group relative mt-0.5 shrink-0"
    >
      <span
        role="checkbox"
        aria-checked={met}
        aria-readonly="true"
        aria-disabled="true"
        tabIndex={-1}
        className={[
          "flex h-[18px] w-[18px] items-center justify-center rounded-[4px] border-2 transition-none pointer-events-none select-none",
          met
            ? "border-status-success-border bg-status-success-light text-status-success-fg shadow-[inset_0_0_0_1px_rgba(52,199,89,0.15)]"
            : "border-border bg-bg-inset/80 text-text-quaternary opacity-90",
        ].join(" ")}
      >
        {met ? (
          autoMet ? (
            <AnimatedDrawCheckmark className="text-status-success-fg scale-90" />
          ) : (
            <Check size={12} strokeWidth={3} className="text-status-success-fg" aria-hidden />
          )
        ) : null}
      </span>
    </span>
  );
}

export default function GamifiedGateTracker({
  gates,
  orientation = "vertical",
  defaultExpandedGate = null,
  projectId,
  apiBaseUrl,
  onAfterReverify,
}: GamifiedGateTrackerProps) {
  const gateOrder = useMemo(() => ["A", "B", "C", "D", "E", "F"], []);
  const gateByLetter = useMemo(() => {
    const m = new Map<string, GamifiedGate>();
    for (const g of gates) m.set(g.gate, g);
    return m;
  }, [gates]);

  const normalized = useMemo(() => {
    return gateOrder
      .map((letter) => gateByLetter.get(letter))
      .filter((g): g is GamifiedGate => Boolean(g));
  }, [gateByLetter, gateOrder]);

  const [expandedGate, setExpandedGate] = useState<string | null>(defaultExpandedGate);
  const [reverifyingGateId, setReverifyingGateId] = useState<string | null>(null);

  const API = apiBaseUrl ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

  async function handleReverifyGate(g: GamifiedGate) {
    if (!projectId || !g.id) return;
    setReverifyingGateId(g.id);
    try {
      const res = await fetch(
        `${API}/api/projects/${projectId}/gates/${g.id}/reverify`,
        {
          method: "POST",
          credentials: "include",
        }
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        const msg =
          typeof err.message === "string"
            ? err.message
            : typeof err.error === "string"
              ? err.error
              : "Re-verify failed";
        window.alert(msg);
        return;
      }
      const json = (await res.json().catch(() => ({}))) as {
        data?: {
          rescanNotice?: string;
          rescan?: { documentsProcessed?: number; documentsSkipped?: number };
        };
      };
      if (json.data?.rescanNotice) {
        window.alert(json.data.rescanNotice);
      } else if (json.data?.rescan && typeof json.data.rescan.documentsProcessed === "number") {
        const { documentsProcessed, documentsSkipped } = json.data.rescan;
        if (documentsProcessed > 0) {
          window.alert(
            `Re-verified from storage: ${documentsProcessed} document(s) re-analyzed.` +
              (documentsSkipped ? ` (${documentsSkipped} skipped.)` : "")
          );
        }
      }
      await onAfterReverify?.();
    } finally {
      setReverifyingGateId(null);
    }
  }

  const isVertical = orientation === "vertical";

  return (
    <div
      className={
        isVertical
          ? "flex flex-col gap-4"
          : "flex flex-row gap-6 items-start overflow-x-auto pb-2"
      }
    >
      {normalized.map((g, idx) => {
        const total = g.criteria.length;
        const met = g.criteria.filter((c) => c.met).length;
        const percent = total > 0 ? Math.round((met / total) * 100) : 0;

        const complete = statusIsComplete(g.status);
        const locked = statusIsLocked(g.status);
        const inProgress = statusIsInProgress(g.status);

        const nodeBorder = complete
          ? "border-status-success-border bg-status-success-light/30"
          : locked
            ? "border-border bg-bg-inset"
            : inProgress
              ? "border-brand-orange/40 bg-brand-orange-light/30"
              : "border-border bg-bg-inset";

        const nodeAccent = complete
          ? "text-status-success-fg"
          : locked
            ? "text-text-tertiary"
            : inProgress
              ? "text-brand-orange"
              : "text-text-tertiary";

        const showProgress = inProgress || g.status === "overridden";

        const isExpanded = expandedGate === g.gate;

        return (
          <div
            key={g.gate}
            className={isVertical ? "relative flex" : "relative flex flex-col"}
          >
            {isVertical ? (
              <div
                aria-hidden="true"
                className={`absolute left-[21px] top-[58px] -bottom-[22px] w-px ${
                  idx === normalized.length - 1 ? "hidden" : "bg-border"
                }`}
              />
            ) : (
              <div
                aria-hidden="true"
                className={`absolute right-[-22px] top-[21px] bottom-auto w-px h-[40px] bg-border ${
                  idx === normalized.length - 1 ? "hidden" : ""
                }`}
              />
            )}

            <div
              className={
                isVertical ? "w-full" : "min-w-[260px] max-w-[320px]"
              }
            >
              <button
                type="button"
                onClick={() => setExpandedGate((prev) => (prev === g.gate ? null : g.gate))}
                className={[
                  "w-full text-left card px-4 py-3 transition-colors",
                  "hover:border-brand-orange/50",
                  nodeBorder,
                ].join(" ")}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={[
                      "w-10 h-10 rounded-full flex items-center justify-center border-2 transition-colors",
                      complete
                        ? "border-status-success-fg text-status-success-fg bg-status-success-light/40"
                        : locked
                          ? "border-border text-text-tertiary bg-bg-inset"
                          : inProgress || g.status === "overridden"
                            ? "border-brand-orange bg-brand-orange-light/30 text-brand-orange"
                            : "border-border text-text-tertiary bg-bg-inset",
                    ].join(" ")}
                  >
                    {complete ? (
                      <Check size={18} className="text-status-success-fg" />
                    ) : locked ? (
                      <Lock size={18} className="text-text-tertiary" />
                    ) : (
                      <span className="font-mono font-semibold">{g.gate}</span>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-baseline gap-2">
                          <span className="font-mono text-sm font-semibold text-text-primary">
                            Gate {g.gate}
                          </span>
                          <span
                            className={[
                              "text-[11px] font-medium px-2 py-0.5 rounded-sm border",
                              complete
                                ? "bg-status-success-light text-status-success-fg border-status-success-border"
                                : locked
                                  ? "bg-bg-inset text-text-tertiary border-border"
                                  : inProgress
                                    ? "bg-brand-orange/10 text-brand-orange border-brand-orange/20"
                                    : "bg-bg-inset text-text-tertiary border-border",
                            ].join(" ")}
                          >
                            {complete ? "Complete" : locked ? "Locked" : "In Progress"}
                          </span>
                        </div>
                      </div>

                      {showProgress && (
                        <span className="text-xs font-mono text-text-tertiary whitespace-nowrap">
                          {met}/{total}
                        </span>
                      )}
                    </div>

                    {showProgress && total > 0 && (
                      <div className="mt-3">
                        <div className="w-full h-2 bg-bg-inset rounded-full overflow-hidden">
                          <div
                            className="h-full bg-brand-orange rounded-full transition-all duration-500 ease-out"
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                        <div className="mt-1 text-[11px] text-text-quaternary flex justify-between">
                          <span>{percent}%</span>
                          <span className={nodeAccent}>{inProgress ? "Auto-validated" : ""}</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </button>

              <div
                className={[
                  "overflow-hidden transition-all duration-300 ease-out",
                  isExpanded ? "max-h-[720px] opacity-100" : "max-h-0 opacity-0",
                ].join(" ")}
              >
                <div className="px-1 pt-3 pb-4">
                  <div className="px-4">
                    <div className="flex items-center justify-between gap-3 mb-3">
                      <div className="text-xs font-medium text-text-tertiary uppercase tracking-wide">
                        Fulfilled HOAI / BauVorlV criteria
                      </div>
                      <div className="text-xs font-mono text-text-quaternary whitespace-nowrap">
                        {met}/{total}
                      </div>
                    </div>

                    <div className="space-y-2">
                      {g.criteria.map((c) => {
                        const metItem = c.met;
                        const showAnimated = metItem && c.autoCheck;

                        return (
                          <div
                            key={c.key}
                            title={CRITERION_TOOLTIP}
                            className={[
                              "flex items-start gap-3 rounded-xl border p-3 cursor-default",
                              metItem
                                ? "border-status-success-border bg-status-success-light/40"
                                : "border-border bg-white/60",
                            ].join(" ")}
                          >
                            <ReadOnlyCriterionCheckbox met={metItem} autoMet={Boolean(showAnimated)} />

                            <div className="min-w-0 flex-1">
                              <div className="text-sm text-text-primary font-medium leading-snug">
                                {c.label}
                              </div>
                              <div className="mt-1 flex items-center gap-2">
                                {metItem && c.autoCheck && (
                                  <span className="text-[11px] text-brand-orange font-medium px-2 py-0.5 rounded-sm border border-brand-orange/20 bg-brand-orange/10">
                                    auto-ticked
                                  </span>
                                )}
                                {metItem && !c.autoCheck && (
                                  <span className="text-[11px] text-text-quaternary font-medium">
                                    confirmed
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {projectId && g.id ? (
                      <div className="mt-5 pt-2 border-t border-border/80">
                        <button
                          type="button"
                          onClick={() => void handleReverifyGate(g)}
                          disabled={reverifyingGateId !== null}
                          className="btn-primary w-full justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {reverifyingGateId === g.id ? (
                            <>
                              <Loader2 className="h-4 w-4 animate-spin shrink-0" aria-hidden />
                              Re-verifying…
                            </>
                          ) : (
                            "Re-Verify Gate"
                          )}
                        </button>
                        <p className="mt-2 text-[11px] text-text-quaternary text-center leading-snug">
                          Re-runs AI on all stored project documents and updates criteria automatically.
                        </p>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
