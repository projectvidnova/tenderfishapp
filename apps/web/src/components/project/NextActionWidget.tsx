"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Upload, Sparkles, Target, LockKeyhole, ArrowRight } from "lucide-react";

type GateCriterion = {
  key: string;
  label: string;
  met: boolean;
  autoCheck?: boolean;
};

type Gate = {
  gate: string;
  status: string;
  criteria: GateCriterion[];
};

export type NextActionWidgetProps = {
  projectId: string;
  gates: Gate[];
  /**
   * Optional hook to implement an upload modal directly from the widget.
   * If omitted, the default button navigates users to `/projects/:id/gates`.
   */
  onUpload?: (payload: { gate: string; criterionKey: string; criterionLabel: string }) => void;
};

const GATE_ORDER = ["A", "B", "C", "D", "E", "F"] as const;

const GATE_NAME: Record<(typeof GATE_ORDER)[number], string> = {
  A: "Project Intake Complete",
  B: "Planning Ready",
  C: "Consultant Invitation Ready",
  D: "Tender Ready",
  E: "Execution Ready",
  F: "Closeout Ready",
};

function nextGateLetter(current: string): string | null {
  const idx = GATE_ORDER.indexOf(current as (typeof GATE_ORDER)[number]);
  if (idx < 0) return null;
  const next = GATE_ORDER[idx + 1];
  return next ?? null;
}

function stageUnlockText(nextGate: string | null): string {
  if (!nextGate) return "next stage";
  return GATE_NAME[nextGate as (typeof GATE_ORDER)[number]] || "next stage";
}

function uploadObjectiveForCriterion(criterionKey: string, criterionLabel: string): { title: string; lphHint?: string } {
  // Minimal but high-signal mappings for the most common gate blockers.
  if (criterionKey === "bauantrag_submitted") {
    return { title: "Upload Bauantrag", lphHint: "LPH 4" };
  }
  if (criterionKey === "baugenehmigung") {
    return { title: "Upload Baugenehmigung", lphHint: "LPH 4" };
  }
  if (criterionKey === "location") {
    return { title: "Upload Location Evidence" };
  }
  if (criterionKey === "project_name") {
    return { title: "Upload Project Name Evidence" };
  }
  if (criterionKey === "client") {
    return { title: "Upload Client Evidence" };
  }
  if (criterionKey === "time_anchor") {
    return { title: "Upload Deadline/Target-Date Evidence" };
  }
  if (criterionKey === "scope_description") {
    return { title: "Upload Scope Evidence" };
  }
  if (criterionKey === "constraints_identified") {
    return { title: "Upload Constraints Evidence" };
  }

  return {
    title: `Upload evidence for ${criterionLabel}`,
  };
}

export default function NextActionWidget({ projectId, gates, onUpload }: NextActionWidgetProps) {
  const router = useRouter();

  const nextAction = useMemo(() => {
    const sorted = [...GATE_ORDER]
      .map((letter) => gates.find((g) => g.gate === letter))
      .filter((g): g is Gate => Boolean(g));

    // Find the first gate that is either locked or in_progress (skip complete gates).
    const gate = sorted.find((g) => g.status === "locked" || g.status === "in_progress") || null;
    if (!gate) return null;

    const criterion = (gate.criteria || []).find((c) => c.met === false) || null;
    if (!criterion) return null;

    return { gate, criterion };
  }, [gates]);

  if (!nextAction) {
    return (
      <div className="card overflow-hidden border border-status-success-border bg-status-success-light/30">
        <div className="p-5 flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-status-success-light/60 border border-status-success-border flex items-center justify-center text-status-success-fg">
            <Target size={18} />
          </div>
          <div className="flex-1">
            <div className="text-sm font-semibold text-text-primary">All compliance objectives unlocked</div>
            <div className="text-xs text-text-tertiary mt-1">
              There are no remaining locked or incomplete criteria in the current gate sequence.
            </div>
          </div>
          <div className="hidden sm:block text-xs px-3 py-1.5 rounded-lg border border-status-success-border bg-status-success-light/50 text-status-success-fg font-mono">
            READY
          </div>
        </div>
      </div>
    );
  }

  const { gate, criterion } = nextAction;
  const nextGate = nextGateLetter(gate.gate);
  const unlockText = stageUnlockText(nextGate);

  const objective = uploadObjectiveForCriterion(criterion.key, criterion.label);
  const uploadTitle = objective.lphHint
    ? `${objective.title} (${objective.lphHint})`
    : objective.title;

  return (
    <div className="card overflow-hidden border border-brand-orange/40 bg-white shadow-md">
      {/* Header glow */}
      <div className="relative">
        {/* Neutral glow (no orange gradient fill) */}
        <div className="absolute -top-16 -left-16 w-40 h-40 rounded-full bg-bg-inset blur-2xl opacity-40" />
        <div className="absolute -bottom-16 -right-16 w-44 h-44 rounded-full bg-bg-inset blur-2xl opacity-40" />

        <div className="p-5 flex items-start gap-4 relative">
          <div className="w-11 h-11 rounded-2xl bg-brand-orange-light/40 border border-brand-orange/30 flex items-center justify-center text-brand-orange">
            {gate.status === "locked" ? <LockKeyhole size={18} /> : <Sparkles size={18} />}
          </div>

          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono px-2 py-1 rounded-sm border border-brand-orange/20 bg-brand-orange/10 text-brand-orange">
                NEXT BEST ACTION
              </span>
              <span className="text-xs text-text-tertiary font-mono">
                Gate {gate.gate} ·{" "}
                {GATE_NAME[gate.gate as (typeof GATE_ORDER)[number]] || ""}
              </span>
            </div>

            <div className="mt-2 text-sm font-semibold text-text-primary leading-snug">
              <span className="text-status-danger">Action Required:</span>{" "}
              <span className="text-brand-orange">{uploadTitle}</span>{" "}
              <span className="text-text-secondary">to unlock {unlockText}</span>
            </div>

            <div className="mt-4 flex items-center gap-3 flex-wrap">
              <button
                type="button"
                onClick={() => {
                  if (onUpload) {
                    onUpload({ gate: gate.gate, criterionKey: criterion.key, criterionLabel: criterion.label });
                    return;
                  }
                  router.push(`/projects/${projectId}/gates`);
                }}
                className="btn-primary inline-flex items-center gap-2"
              >
                <Upload size={16} />
                Upload Document
                <ArrowRight size={14} />
              </button>

              <Link
                href={`/projects/${projectId}/gates`}
                className="btn-secondary inline-flex items-center gap-2"
              >
                View gate details
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

