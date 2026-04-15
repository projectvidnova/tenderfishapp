/**
 * GateBadge — circular badge for gates A–F with pass/fail/pending state.
 */

type GateStatus = "PASS" | "FAIL" | "BLOCKED" | "NOT_EVALUATED";

const statusColors: Record<GateStatus, { ring: string; bg: string; text: string }> = {
  PASS: { ring: "border-gate-complete", bg: "bg-gate-complete", text: "text-white" },
  FAIL: { ring: "border-gate-fail", bg: "bg-gate-fail", text: "text-white" },
  BLOCKED: { ring: "border-gate-blocked", bg: "bg-gate-blocked", text: "text-white" },
  NOT_EVALUATED: { ring: "border-card-border", bg: "bg-white", text: "text-gray-400" },
};

interface GateBadgeProps {
  gate: string;
  status: GateStatus | string;
  size?: "sm" | "md" | "lg";
}

export function GateBadge({ gate, status, size = "md" }: GateBadgeProps) {
  const s = statusColors[status as GateStatus] ?? statusColors.NOT_EVALUATED;
  const sizeClasses = {
    sm: "w-7 h-7 text-xs",
    md: "w-10 h-10 text-sm",
    lg: "w-14 h-14 text-base",
  };

  const filled = status === "PASS" || status === "FAIL" || status === "BLOCKED";

  return (
    <div
      className={`${sizeClasses[size]} rounded-full border-2 ${s.ring} ${
        filled ? s.bg : "bg-white"
      } flex items-center justify-center font-mono font-medium ${
        filled ? s.text : s.text
      }`}
    >
      {gate}
    </div>
  );
}
