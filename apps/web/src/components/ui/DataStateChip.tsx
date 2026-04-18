/**
 * DataStateChip — shows the extraction confidence state for a project fact.
 * States: CONFIRMED, DERIVED, UNCLEAR, MISSING, LOCKED
 */

type DataState = "CONFIRMED" | "DERIVED" | "UNCLEAR" | "MISSING" | "LOCKED";

const styleMap: Record<DataState, string> = {
  CONFIRMED: "bg-status-success-light text-state-confirmed-text",
  DERIVED: "bg-status-info-light text-status-info",
  UNCLEAR: "bg-status-warning-light text-state-unclear-text",
  MISSING: "bg-status-danger-light text-state-missing-text",
  LOCKED: "bg-bg-inset text-text-tertiary",
};

export function DataStateChip({ state }: { state: DataState | string }) {
  const classes = styleMap[state as DataState] ?? styleMap.MISSING;
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 text-xs font-mono font-semibold rounded-full ${classes}`}
    >
      {state}
    </span>
  );
}
