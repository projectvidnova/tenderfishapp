/**
 * DataStateChip — shows the extraction confidence state for a project fact.
 * States: CONFIRMED, DERIVED, UNCLEAR, MISSING, LOCKED
 */

type DataState = "CONFIRMED" | "DERIVED" | "UNCLEAR" | "MISSING" | "LOCKED";

const styleMap: Record<DataState, string> = {
  CONFIRMED: "bg-state-confirmed-bg text-state-confirmed-text border-state-confirmed-text",
  DERIVED: "bg-state-derived-bg text-state-derived-text border-state-derived-text",
  UNCLEAR: "bg-state-unclear-bg text-state-unclear-text border-state-unclear-text",
  MISSING: "bg-state-missing-bg text-state-missing-text border-state-missing-text",
  LOCKED: "bg-gray-100 text-gray-400 border-gray-300",
};

export function DataStateChip({ state }: { state: DataState | string }) {
  const classes = styleMap[state as DataState] ?? styleMap.MISSING;
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 text-xs font-mono font-medium rounded-sm border ${classes}`}
    >
      {state}
    </span>
  );
}
