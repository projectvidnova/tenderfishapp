/**
 * DataStateChip — shows the extraction confidence state for a project fact.
 * States: CONFIRMED, DERIVED, UNCLEAR, MISSING, LOCKED
 *
 * Optionally accepts a numeric `confidence` (0..100) which is shown in the
 * native browser tooltip on hover. Used for row-level DIN 276 mappings.
 */

type DataState = "CONFIRMED" | "DERIVED" | "UNCLEAR" | "MISSING" | "LOCKED";

const styleMap: Record<DataState, string> = {
  CONFIRMED: "bg-status-success-light text-state-confirmed-text border border-status-success-border",
  DERIVED: "bg-status-warning-light text-brand-orange border border-status-warning-border",
  UNCLEAR: "bg-status-warning-light text-brand-orange border border-status-warning-border",
  MISSING: "bg-status-danger-light text-state-missing-text border border-status-danger-border",
  LOCKED: "bg-bg-inset text-text-tertiary",
};

interface Props {
  state: DataState | string;
  confidence?: number; // 0..100
}

export function DataStateChip({ state, confidence }: Props) {
  const classes = styleMap[state as DataState] ?? styleMap.MISSING;
  const label = state === "DERIVED" ? "INFERRED" : state;
  const tooltip =
    typeof confidence === "number" ? `${label} · ${Math.round(confidence)}% confidence` : undefined;
  const hasConfidence = typeof confidence === "number";
  return (
    <span
      title={tooltip}
      className={`inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-mono font-semibold rounded-full ${classes}`}
    >
      {label}
      {hasConfidence && (
        <span className="font-normal opacity-70">{Math.round(confidence)}%</span>
      )}
    </span>
  );
}
