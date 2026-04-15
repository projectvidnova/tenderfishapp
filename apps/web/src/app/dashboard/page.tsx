"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  FolderKanban,
  AlertCircle,
  CalendarDays,
  ShieldAlert,
  Plus,
  ArrowRight,
} from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

interface ProjectCard {
  id: string;
  name: string;
  type: string;
  status: string;
  healthScore: string;
  procurementModel: string;
  targetCompletion: string | null;
  currentLph: number;
  currentGate: { gate: string; status: string };
}

interface ActionItem {
  projectId: string;
  projectName: string;
  item: string;
  type: string;
  due: string | null;
  link: string;
}

interface Milestone {
  date: string | null;
  projectId: string;
  projectName: string;
  milestone: string;
  phase: string;
  status: string;
}

interface BlockedProject {
  id: string;
  name: string;
  gate: string;
  gateStatus: string;
  topBlocker: string;
  unmetCount: number;
}

interface DashboardData {
  projects: ProjectCard[];
  actionItems: ActionItem[];
  milestones: Milestone[];
  blockedProjects: BlockedProject[];
}

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("tf_token");
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchDashboard = useCallback(async () => {
    const token = getToken();
    try {
      const res = await fetch(`${API}/api/dashboard`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) {
        const json = await res.json();
        setData(json.data);
      }
    } catch {
      // silent fail for polling
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboard();
    const interval = setInterval(fetchDashboard, 60_000);
    return () => clearInterval(interval);
  }, [fetchDashboard]);

  const projects = data?.projects || [];
  const actionItems = data?.actionItems || [];
  const milestones = data?.milestones || [];
  const blockedProjects = data?.blockedProjects || [];

  return (
    <div className="space-y-8">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-ink">Dashboard</h1>
          <p className="text-sm text-gray-500 mt-1">
            Overview of your active projects and pending actions.
          </p>
        </div>
        <Link
          href="/projects/new"
          className="btn-primary flex items-center gap-2"
        >
          <Plus size={16} />
          New Project
        </Link>
      </div>

      {/* Section 1: Active Projects Pipeline */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <FolderKanban size={18} className="text-bronze" />
          <h2 className="text-lg font-medium">Active Projects</h2>
        </div>
        <div className="flex gap-4 overflow-x-auto pb-2">
          {projects.length === 0 && !loading ? (
            <div className="card p-6 min-w-[200px] flex flex-col items-center justify-center text-center">
              <FolderKanban size={32} className="text-gray-300 mb-2" />
              <p className="text-sm text-gray-400">No projects yet</p>
              <Link
                href="/projects/new"
                className="text-sm text-bronze font-medium mt-2 hover:underline"
              >
                Create your first project →
              </Link>
            </div>
          ) : (
            projects.map((p) => (
              <Link
                key={p.id}
                href={`/projects/${p.id}/overview`}
                className="card p-4 min-w-[200px] w-[200px] h-[140px] flex flex-col justify-between hover:border-bronze/50 transition-colors shrink-0"
              >
                <div>
                  <p className="text-sm font-medium text-ink leading-tight line-clamp-2">
                    {p.name}
                  </p>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-xs font-mono font-medium text-bronze bg-bronze/10 px-1.5 py-0.5 rounded-sm">
                      LPH {p.currentLph}
                    </span>
                    <GateBadgeSmall
                      gate={p.currentGate.gate}
                      status={p.currentGate.status}
                    />
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <HealthDot score={p.healthScore} />
                  <span className="text-xs text-gray-400">
                    {p.procurementModel.replace(/_/g, " ")}
                  </span>
                </div>
              </Link>
            ))
          )}
        </div>
      </section>

      {/* Section 2: Action Required */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <AlertCircle size={18} className="text-health-red" />
          <h2 className="text-lg font-medium">Action Required</h2>
        </div>
        <div className="card overflow-hidden">
          {actionItems.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-sm text-gray-400">No pending actions.</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-card-border bg-cream/50">
                  <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wide">
                    Project
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wide">
                    Item
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wide">
                    Type
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wide">
                    Due
                  </th>
                  <th className="text-right px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {actionItems.map((item, i) => (
                  <tr
                    key={i}
                    className="border-b border-card-border last:border-0"
                  >
                    <td className="px-4 py-3 text-ink font-medium">
                      {item.projectName}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{item.item}</td>
                    <td className="px-4 py-3">
                      <ActionTypeChip type={item.type} />
                    </td>
                    <td className="px-4 py-3">
                      {item.due ? (
                        <span
                          className={
                            item.due < new Date().toISOString().slice(0, 10)
                              ? "text-health-red font-medium"
                              : "text-gray-600"
                          }
                        >
                          {item.due}
                        </span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={item.link}
                        className="text-bronze text-xs font-medium hover:underline inline-flex items-center gap-1"
                      >
                        Resolve
                        <ArrowRight size={12} />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      {/* Section 3: Upcoming Milestones */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <CalendarDays size={18} className="text-bronze" />
          <h2 className="text-lg font-medium">Upcoming Milestones</h2>
          <span className="text-xs text-gray-400 ml-1">next 30 days</span>
        </div>
        <div className="card overflow-hidden">
          {milestones.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-sm text-gray-400">
                No upcoming milestones.
              </p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-card-border bg-cream/50">
                  <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wide">
                    Date
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wide">
                    Project
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wide">
                    Milestone
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wide">
                    Phase
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wide">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {milestones.map((m, i) => (
                  <tr
                    key={i}
                    className="border-b border-card-border last:border-0"
                  >
                    <td className="px-4 py-3 font-mono text-xs text-gray-600">
                      {m.date}
                    </td>
                    <td className="px-4 py-3 text-ink font-medium">
                      {m.projectName}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{m.milestone}</td>
                    <td className="px-4 py-3">
                      <span className="text-xs font-mono font-medium text-bronze">
                        {m.phase}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <TaskStatusChip status={m.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      {/* Section 4: Blocked Projects */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <ShieldAlert size={18} className="text-gray-400" />
          <h2 className="text-lg font-medium">Blocked Projects</h2>
        </div>
        {blockedProjects.length === 0 ? (
          <div className="card">
            <div className="p-8 text-center">
              <p className="text-sm text-gray-400">
                No blocked projects — good.
              </p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {blockedProjects.map((bp) => (
              <Link
                key={bp.id}
                href={`/projects/${bp.id}/gates`}
                className="card p-4 hover:border-health-red/30 transition-colors"
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-2 h-2 rounded-full bg-health-red" />
                  <span className="text-sm font-medium text-ink">
                    {bp.name}
                  </span>
                </div>
                <p className="text-xs text-gray-500">
                  Gate {bp.gate} blocked — {bp.topBlocker}
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  {bp.unmetCount} unmet criteria
                </p>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

// ─── Small Components ─────────────────────────────────────────

function HealthDot({ score }: { score: string }) {
  const color =
    score === "green"
      ? "bg-health-on-track"
      : score === "amber"
      ? "bg-health-at-risk"
      : "bg-health-red";
  const label =
    score === "green"
      ? "On track"
      : score === "amber"
      ? "At risk"
      : "Blocked";

  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-gray-500">
      <span className={`w-2 h-2 rounded-full ${color}`} />
      {label}
    </span>
  );
}

function GateBadgeSmall({
  gate,
  status,
}: {
  gate: string;
  status: string;
}) {
  const color =
    status === "complete"
      ? "text-gate-complete"
      : status === "in_progress"
      ? "text-bronze"
      : "text-gray-400";

  return (
    <span className={`text-xs font-mono font-medium ${color}`}>
      Gate {gate}
    </span>
  );
}

function ActionTypeChip({ type }: { type: string }) {
  const styles: Record<string, string> = {
    "Overdue Approval": "bg-red-50 text-red-700 border-red-200",
    "Blocked Gate": "bg-orange-50 text-orange-700 border-orange-200",
    "Missing Info": "bg-amber-50 text-amber-700 border-amber-200",
    "Pending Invitation": "bg-blue-50 text-blue-700 border-blue-200",
    "Overdue Review": "bg-purple-50 text-purple-700 border-purple-200",
  };

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-sm border ${
        styles[type] || "bg-gray-50 text-gray-600 border-gray-200"
      }`}
    >
      {type}
    </span>
  );
}

function TaskStatusChip({ status }: { status: string }) {
  const styles: Record<string, string> = {
    not_started: "text-gray-400",
    in_progress: "text-bronze font-medium",
    complete: "text-gate-complete font-medium",
  };

  return (
    <span className={`text-xs ${styles[status] || "text-gray-400"}`}>
      {status.replace(/_/g, " ")}
    </span>
  );
}
