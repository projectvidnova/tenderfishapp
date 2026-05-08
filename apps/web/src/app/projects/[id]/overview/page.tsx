"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { CheckCircle2, Circle, Flag, ShieldAlert } from "lucide-react";
import AppShell from "@/components/layout/AppShell";
import { ProjectTopBar } from "@/components/project/ProjectTopBar";
import { config } from "@/lib/config";

const API = config.apiUrl;

type GateCriterion = {
  key: string;
  label: string;
  met: boolean;
  autoCheck: boolean;
};

type Gate = {
  gate: string;
  status: string;
  criteria: GateCriterion[];
};

type CompliancePhase = {
  lph: number;
  status: string;
  objective: string | null;
};

type ComplianceDashboardData = {
  project: {
    id: string;
    name: string;
    healthScore: string;
  };
  gates: Gate[];
  phases: CompliancePhase[];
  complianceCompletionPercentage: number;
};

type Risk = {
  id: string;
  status: string;
};

type Approval = {
  id: string;
  status: string;
};

type CostSnapshot = {
  id: string;
  status: string;
  totalGross: number | null;
  snapshotDate: string;
};

type ImmediateAction = {
  id: string;
  gate: string;
  criterionKey: string;
  label: string;
  detail: string;
};

const gateOrder = ["A", "B", "C", "D", "E", "F"] as const;

function getCurrentLph(phases: CompliancePhase[]): number {
  const active = phases.find((p) => p.status === "active");
  if (active) return active.lph;
  const completed = phases.filter((p) => p.status === "complete").sort((a, b) => b.lph - a.lph)[0];
  if (completed) return Math.min(9, completed.lph + 1);
  return 1;
}

function budgetStatusText(snapshots: CostSnapshot[]): { text: string; tone: string } {
  if (snapshots.length === 0) return { text: "No baseline", tone: "text-text-quaternary" };
  const sorted = [...snapshots].sort((a, b) => b.snapshotDate.localeCompare(a.snapshotDate));
  const latest = sorted[0];
  if (latest.status === "approved") return { text: "Approved", tone: "text-gate-complete" };
  if (latest.status === "submitted") return { text: "Under Review", tone: "text-brand-orange" };
  if (latest.status === "draft") return { text: "Draft", tone: "text-text-tertiary" };
  return { text: latest.status, tone: "text-text-tertiary" };
}

export default function ProjectOverviewPage() {
  const { id: projectId } = useParams() as { id: string };
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [compliance, setCompliance] = useState<ComplianceDashboardData | null>(null);
  const [risks, setRisks] = useState<Risk[]>([]);
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [snapshots, setSnapshots] = useState<CostSnapshot[]>([]);

  const fetchAll = useCallback(async () => {
    try {
      const [complianceRes, risksRes, approvalsRes, costsRes] = await Promise.all([
        fetch(`${API}/api/projects/${projectId}/compliance-dashboard`, { credentials: "include" }),
        fetch(`${API}/api/projects/${projectId}/risks`, { credentials: "include" }),
        fetch(`${API}/api/projects/${projectId}/approvals`, { credentials: "include" }),
        fetch(`${API}/api/projects/${projectId}/cost-snapshots`, { credentials: "include" }),
      ]);

      if (complianceRes.ok) {
        const json = await complianceRes.json();
        setCompliance(json.data);
      }
      if (risksRes.ok) {
        const json = await risksRes.json();
        setRisks(json.data || []);
      }
      if (approvalsRes.ok) {
        const json = await approvalsRes.json();
        setApprovals(json.data || []);
      }
      if (costsRes.ok) {
        const json = await costsRes.json();
        setSnapshots(json.data || []);
      }
    } catch {
      // silent fail; UI shows "no data" states
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const immediateActions = useMemo<ImmediateAction[]>(() => {
    if (!compliance) return [];
    const gatesSorted = [...compliance.gates].sort(
      (a, b) => gateOrder.indexOf(a.gate as (typeof gateOrder)[number]) - gateOrder.indexOf(b.gate as (typeof gateOrder)[number])
    );
    const blockingGate = gatesSorted.find((g) => g.status === "in_progress" || g.status === "locked");
    if (!blockingGate) return [];

    const unmet = blockingGate.criteria.filter((c) => !c.met);
    return unmet.map((criterion) => ({
      id: `${blockingGate.gate}:${criterion.key}`,
      gate: blockingGate.gate,
      criterionKey: criterion.key,
      label: criterion.label,
      detail: `Missing ${criterion.label} for Gate ${blockingGate.gate}`,
    }));
  }, [compliance]);

  const currentLph = useMemo(() => getCurrentLph(compliance?.phases || []), [compliance]);
  const openRiskCount = useMemo(() => risks.filter((r) => r.status === "open").length, [risks]);
  const pendingApprovalCount = useMemo(
    () => approvals.filter((a) => a.status === "pending" || a.status === "in_review" || a.status === "overdue").length,
    [approvals]
  );
  const budgetStatus = useMemo(() => budgetStatusText(snapshots), [snapshots]);

  if (loading) {
    return (
      <AppShell>
        <div className="animate-pulse space-y-4">
          <div className="h-16 bg-bg-inset rounded-xl" />
          <div className="h-64 bg-bg-inset rounded-xl" />
        </div>
      </AppShell>
    );
  }

  if (!compliance) {
    return (
      <AppShell>
        <div className="text-center py-20 text-text-quaternary">Project data unavailable.</div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <ProjectTopBar projectId={projectId} />

      <div className="w-full space-y-6 mt-6">
        {/* Top area: Immediate actions + vitals */}
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_340px] gap-6">
          <section id="next-action" className="card p-5 scroll-mt-24">
            <div className="flex items-center justify-between gap-3 mb-4">
              <h2 className="text-sm font-semibold text-text-primary uppercase tracking-wide">Immediate Actions</h2>
              <span className="text-xs text-text-quaternary font-mono">
                Gate blockers
              </span>
            </div>

            {immediateActions.length === 0 ? (
              <div className="rounded-xl border border-status-success-border bg-status-success-light/30 p-4 flex items-center gap-3">
                <CheckCircle2 size={18} className="text-gate-complete" />
                <div className="text-sm text-text-primary">No active blockers. Current gate can progress.</div>
              </div>
            ) : (
              <div className="space-y-3">
                {immediateActions.map((action) => {
                  return (
                    <div
                      key={action.id}
                      className="rounded-xl border p-4 transition-all duration-300 border-status-danger-border bg-status-danger-light/20"
                    >
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5">
                          <ShieldAlert size={18} className="text-status-danger" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-semibold text-text-primary">
                            {action.detail}
                          </div>
                          <div className="text-xs text-text-tertiary mt-1">Required to continue compliance progression.</div>
                          <div className="mt-2 text-[11px] font-medium text-text-tertiary">
                            Upload supporting evidence and let AI verify this blocker.
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            router.push(`/projects/${projectId}/gates`);
                          }}
                          className="btn-primary text-xs whitespace-nowrap"
                        >
                          Mark done
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <aside className="card p-5 space-y-4">
            <h2 className="text-sm font-semibold text-text-primary uppercase tracking-wide">Project Vitals</h2>

            <div className="rounded-xl border border-border bg-bg-inset/30 px-4 py-3">
              <div className="text-xs text-text-quaternary uppercase tracking-wide">Total Risks Open</div>
              <div className="mt-1 text-2xl font-bold text-text-primary tabular-nums">{openRiskCount}</div>
            </div>

            <div className="rounded-xl border border-border bg-bg-inset/30 px-4 py-3">
              <div className="text-xs text-text-quaternary uppercase tracking-wide">Pending Approvals</div>
              <div className="mt-1 text-2xl font-bold text-text-primary tabular-nums">{pendingApprovalCount}</div>
            </div>

            <div className="rounded-xl border border-border bg-bg-inset/30 px-4 py-3">
              <div className="text-xs text-text-quaternary uppercase tracking-wide">Budget Status</div>
              <div className={`mt-1 text-lg font-semibold ${budgetStatus.tone}`}>{budgetStatus.text}</div>
              {snapshots.length > 0 && (
                <div className="mt-1 text-xs text-text-quaternary">
                  Latest snapshot: {new Date([...snapshots].sort((a, b) => b.snapshotDate.localeCompare(a.snapshotDate))[0].snapshotDate).toLocaleDateString("de-DE")}
                </div>
              )}
            </div>
          </aside>
        </div>

        {/* Bottom full width: Lifecycle Journey */}
        <section className="card p-5">
          <div className="flex items-center justify-between gap-3 mb-5">
            <h2 className="text-sm font-semibold text-text-primary uppercase tracking-wide">Lifecycle Journey</h2>
            <span className="text-xs text-text-quaternary">HOAI phases 1-9</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-9 gap-3">
            {Array.from({ length: 9 }, (_, i) => i + 1).map((lph) => {
              const isCurrent = lph === currentLph;
              const isPast = lph < currentLph;
              const isFuture = lph > currentLph;
              return (
                <div
                  key={lph}
                  className={[
                    "rounded-xl border px-3 py-3 transition-colors",
                    isCurrent
                      ? "border-brand-orange bg-brand-orange-light/20"
                      : isPast
                      ? "border-status-success-border bg-status-success-light/25"
                      : "border-border bg-bg-inset/20",
                  ].join(" ")}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-mono text-text-tertiary">LPH {lph}</span>
                    {isPast ? (
                      <CheckCircle2 size={14} className="text-gate-complete" />
                    ) : isCurrent ? (
                      <Flag size={14} className="text-brand-orange" />
                    ) : (
                      <Circle size={14} className="text-text-quaternary" />
                    )}
                  </div>
                  <div
                    className={[
                      "mt-2 text-xs font-medium",
                      isCurrent ? "text-brand-orange" : isFuture ? "text-text-quaternary" : "text-text-primary",
                    ].join(" ")}
                  >
                    {isCurrent ? "Current phase" : isFuture ? "Upcoming" : "Completed"}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>

    </AppShell>
  );
}

