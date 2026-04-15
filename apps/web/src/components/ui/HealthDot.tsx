/**
 * HealthDot — colored dot indicating project health.
 */

type HealthStatus = "on_track" | "at_risk" | "delayed" | "blocked";

const colors: Record<HealthStatus, { dot: string; label: string }> = {
  on_track: { dot: "bg-health-on-track", label: "On track" },
  at_risk: { dot: "bg-health-at-risk", label: "At risk" },
  delayed: { dot: "bg-health-delayed", label: "Delayed" },
  blocked: { dot: "bg-health-blocked", label: "Blocked" },
};

interface HealthDotProps {
  status: HealthStatus | string;
  showLabel?: boolean;
}

export function HealthDot({ status, showLabel = true }: HealthDotProps) {
  const c = colors[status as HealthStatus] ?? colors.on_track;
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`w-2 h-2 rounded-full ${c.dot}`} />
      {showLabel && <span className="text-sm font-medium">{c.label}</span>}
    </span>
  );
}
