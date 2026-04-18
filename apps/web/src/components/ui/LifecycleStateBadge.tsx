"use client";

const STATE_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  input_received: { label: "Input Received", color: "text-text-tertiary", bg: "bg-bg-inset" },
  parsed: { label: "Parsed", color: "text-status-info-fg", bg: "bg-status-info-light" },
  needs_review: { label: "Needs Review", color: "text-status-warning-fg", bg: "bg-status-warning-light" },
  confirmed: { label: "Confirmed", color: "text-status-emerald-fg", bg: "bg-status-emerald-bg" },
  structure_approved: { label: "Structure Approved", color: "text-status-emerald-fg", bg: "bg-status-emerald-bg" },
  cost_ready: { label: "Cost Ready", color: "text-status-teal-fg", bg: "bg-status-teal-bg" },
  detail_ready: { label: "Detail Ready", color: "text-status-indigo-fg", bg: "bg-status-indigo-bg" },
  tender_ready: { label: "Tender Ready", color: "text-status-purple-fg", bg: "bg-status-purple-bg" },
  released_for_tender: { label: "Released", color: "text-status-success-fg", bg: "bg-status-success-light" },
};

export function LifecycleStateBadge({ state }: { state: string | null | undefined }) {
  const s = state || "input_received";
  const cfg = STATE_CONFIG[s] || STATE_CONFIG.input_received;

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full ${cfg.bg} ${cfg.color}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.color.replace("text-", "bg-")}`} />
      {cfg.label}
    </span>
  );
}
