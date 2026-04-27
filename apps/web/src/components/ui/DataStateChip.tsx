/**
 * DataStateChip — shows the extraction confidence state for a project fact.
 * States: CONFIRMED, DERIVED, UNCLEAR, MISSING, LOCKED
 */

type DataState = "CONFIRMED" | "DERIVED" | "UNCLEAR" | "MISSING" | "LOCKED";

const styleMap: Record<DataState, string> = {
  CONFIRMED: "bg-status-success-light text-state-confirmed-text border border-status-success-border",
  DERIVED: "bg-status-warning-light text-brand-orange border border-status-warning-border",
  UNCLEAR: "bg-status-warning-light text-brand-orange border border-status-warning-border",
  MISSING: "bg-status-danger-light text-state-missing-text border border-status-danger-border",
  LOCKED: "bg-bg-inset text-text-tertiary",
};

export function DataStateChip({ state }: { state: DataState | string }) {
  const classes = styleMap[state as DataState] ?? styleMap.MISSING;
  const label = state === "DERIVED" ? "INFERRED" : state;
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 text-xs font-mono font-semibold rounded-full ${classes}`}
    >
      {label}
    </span>
  );
}
