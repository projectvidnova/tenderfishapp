"use client";

import { useEffect, useMemo, useState } from "react";
import { config } from "@/lib/config";
import { DataStateChip } from "@/components/ui/DataStateChip";

type ExtractedFact = {
  id: string;
  fieldName: string;
  value: string | null;
  dataState: string;
  sourceRef: string | null;
};

type ExtractedFactsResponse = {
  data: {
    facts: ExtractedFact[];
    gateCriterionUnlocks?: unknown;
  };
};

export default function ExtractedFactsViewer({
  projectId,
}: {
  projectId: string;
}) {
  const [facts, setFacts] = useState<ExtractedFact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedSourceFactId, setExpandedSourceFactId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(`${config.apiUrl}/api/projects/${projectId}/extracted-facts`, {
          credentials: "include",
        });
        if (!res.ok) {
          const body = (await res.json().catch(() => null)) as { error?: string } | null;
          throw new Error(body?.error || `Failed to load extracted facts (${res.status})`);
        }
        const json = (await res.json()) as ExtractedFactsResponse;
        if (!cancelled) setFacts(json.data?.facts || []);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load extracted facts");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const factsSorted = useMemo(() => {
    // Stable ordering: by fieldName, then id.
    return [...facts].sort((a, b) => (a.fieldName || "").localeCompare(b.fieldName || "") || a.id.localeCompare(b.id));
  }, [facts]);

  const formatFieldLabel = (fieldName: string) =>
    fieldName.replace(/_/g, " ").replace(/\s+/g, " ").trim();

  function parseMaybeJson(raw: string): unknown | null {
    try {
      const parsed = JSON.parse(raw);
      return parsed;
    } catch {
      return null;
    }
  }

  function formatFactValue(fieldName: string, rawValue: string | null): string {
    if (!rawValue) return "";

    const parsed = parseMaybeJson(rawValue);
    if (parsed === null) return rawValue;

    // Handle common structured fact encodings from intake pipeline.
    if (fieldName === "cost_item" && parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      const p = parsed as Record<string, unknown>;
      const description = typeof p.description === "string" ? p.description : "Cost item";
      const din = typeof p.din276_code === "string" ? `DIN ${p.din276_code}` : "DIN n/a";
      const quantity =
        typeof p.quantity === "number" ? String(p.quantity) : p.quantity === null ? null : typeof p.quantity === "string" ? p.quantity : null;
      const unit = typeof p.unit === "string" ? p.unit : null;
      const amount =
        typeof p.amount === "number" ? p.amount : p.amount === null ? null : typeof p.amount === "string" ? Number(p.amount) : null;

      const quantityText = quantity
        ? `${quantity}${unit ? ` ${unit}` : ""}`
        : quantity === "" || quantity === null
        ? null
        : String(quantity);

      const amountText =
        typeof amount === "number" && !Number.isNaN(amount)
          ? new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(amount)
          : null;

      return [description, din, quantityText, amountText].filter(Boolean).join(" • ");
    }

    if (fieldName === "overview_commissioned_phases") {
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        const p = parsed as Record<string, unknown>;
        const phases =
          Array.isArray(p.commissioned_phases) && p.commissioned_phases.every((x) => typeof x === "number")
            ? (p.commissioned_phases as number[])
            : Array.isArray(p.phases) && p.phases.every((x) => typeof x === "number")
            ? (p.phases as number[])
            : [];
        if (phases.length > 0) return phases.map((ph) => `LPH ${String(ph)}`).join(", ");
      }
    }

    if (fieldName === "overview_building_permit_status" || fieldName === "building_permit_status") {
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        const p = parsed as Record<string, unknown>;
        const status =
          typeof p.building_permit_status === "string"
            ? p.building_permit_status
            : typeof p.value === "string"
            ? p.value
            : null;
        if (status) return status;
      }
    }

    if (fieldName === "accessibility_requirements") {
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        const p = parsed as Record<string, unknown>;
        const status =
          typeof p.accessibility_requirements === "string"
            ? p.accessibility_requirements
            : typeof p.value === "string"
            ? p.value
            : null;
        if (status) return status;
      }
    }

    // Generic object -> "key: value" lines (still text, not raw JSON).
    if (parsed && typeof parsed === "object") {
      if (Array.isArray(parsed)) {
        return parsed.map((x) => (typeof x === "string" ? x : JSON.stringify(x))).join(", ");
      }

      const obj = parsed as Record<string, unknown>;
      const entries = Object.entries(obj)
        .filter(([, v]) => v !== null && v !== undefined)
        .slice(0, 8)
        .map(([k, v]) => {
          if (Array.isArray(v)) return `${k}: ${v.map((x) => String(x)).join(", ")}`;
          if (typeof v === "object") return `${k}: [object]`;
          return `${k}: ${String(v)}`;
        });

      return entries.length > 0 ? entries.join(" • ") : rawValue;
    }

    // Primitive JSON value -> plain string.
    if (typeof parsed === "string" || typeof parsed === "number" || typeof parsed === "boolean") {
      return String(parsed);
    }

    return rawValue;
  }

  const truncate = (v: string, max = 180) => (v.length > max ? `${v.slice(0, max)}…` : v);

  if (loading) {
    return (
      <div className="card p-5">
        <div className="h-6 bg-bg-inset rounded w-48 animate-pulse" />
        <div className="mt-4 h-10 bg-bg-inset rounded w-full animate-pulse" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="card p-5 border border-status-danger-border bg-danger-light/10">
        <div className="font-medium text-status-danger">Failed to load extracted facts</div>
        <div className="text-sm text-text-secondary mt-1">{error}</div>
      </div>
    );
  }

  return (
    <div className="card p-5 space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-text-primary">Extracted Facts (AI Evidence)</h3>
          <p className="text-sm text-text-tertiary mt-1">
            Every auto-tick gate criterion can be traced back to these extracted document facts.
          </p>
        </div>
        <div className="text-xs font-mono text-text-quaternary whitespace-nowrap">
          {factsSorted.length} facts
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-bg-inset/40">
              <th className="text-left px-4 py-3 font-medium text-text-tertiary text-xs uppercase tracking-wide">
                Field Name
              </th>
              <th className="text-left px-4 py-3 font-medium text-text-tertiary text-xs uppercase tracking-wide">
                Value
              </th>
              <th className="text-left px-4 py-3 font-medium text-text-tertiary text-xs uppercase tracking-wide">
                Data State
              </th>
              <th className="text-left px-4 py-3 font-medium text-text-tertiary text-xs uppercase tracking-wide">
                Source
              </th>
            </tr>
          </thead>
          <tbody>
            {factsSorted.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center text-text-quaternary">
                  No extracted facts found.
                </td>
              </tr>
            )}

            {factsSorted.map((f) => {
              const isExpanded = expandedSourceFactId === f.id;
              const valueText = formatFactValue(f.fieldName, f.value);
              const displayValue = valueText ? truncate(valueText, 220) : "—";

              const sourceText = f.sourceRef ? String(f.sourceRef) : "";
              const displaySource = sourceText ? truncate(sourceText, 120) : "—";

              return (
                <>
                  <tr key={f.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-3 text-text-secondary">
                      <div className="font-medium text-text-primary">{formatFieldLabel(f.fieldName)}</div>
                      <div className="text-[11px] font-mono text-text-quaternary mt-1">{f.fieldName}</div>
                    </td>
                    <td className="px-4 py-3">
                      {f.value ? (
                        <pre className="m-0 whitespace-pre-wrap break-words font-mono text-[12px] text-text-primary">
                          {displayValue}
                        </pre>
                      ) : (
                        <span className="text-text-quaternary">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <DataStateChip state={f.dataState} />
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => setExpandedSourceFactId((prev) => (prev === f.id ? null : f.id))}
                        className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-border hover:bg-bg-inset/40 transition-colors"
                        title={sourceText || "No sourceRef available"}
                      >
                        <span className="text-xs font-medium text-brand-orange">View Source</span>
                        <span className="text-[11px] font-mono text-text-quaternary">{displaySource}</span>
                      </button>
                    </td>
                  </tr>

                  {isExpanded && (
                    <tr className="bg-bg-inset/30 border-b border-border">
                      <td className="px-4 py-3" colSpan={4}>
                        <div className="flex items-center justify-between gap-3">
                          <div className="text-sm font-semibold text-text-primary">Evidence (sourceRef)</div>
                          <button
                            type="button"
                            onClick={() => setExpandedSourceFactId(null)}
                            className="text-xs font-medium text-text-quaternary hover:text-text-secondary transition-colors"
                          >
                            Collapse
                          </button>
                        </div>
                        <pre className="mt-2 mb-0 p-3 rounded-xl border border-border bg-white/60 overflow-auto text-xs font-mono text-text-primary whitespace-pre-wrap break-words">
                          {sourceText || "—"}
                        </pre>
                      </td>
                    </tr>
                  )}
                </>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

