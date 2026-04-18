"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import AppShell from "@/components/layout/AppShell";
import { ProjectTopBar } from "@/components/project/ProjectTopBar";
import {
  Pencil,
  Check,
  X,
  ArrowRight,
  ExternalLink,
} from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

interface Project {
  id: string;
  name: string;
  type: string;
  status: string;
  healthScore: string;
  procurementModel: string;
  targetCompletion: string | null;
  objective: string | null;
  scopeSummary: string | null;
  location: string | null;
  clientName: string | null;
  clientRepresentative: string | null;
}

interface Gate {
  id: string;
  gate: string;
  status: string;
  criteria: { key: string; label: string; met: boolean; autoCheck: boolean }[];
}

interface Phase {
  id: string;
  lph: number;
  status: string;
  objective: string;
  startDate: string | null;
  endDate: string | null;
}

interface Fact {
  id: string;
  fieldName: string;
  value: string | null;
  dataState: string;
}

interface Readiness {
  planning: number;
  consultant: number;
  tender: number;
  execution: number;
  closeout: number;
}

interface ActionItem {
  category: string;
  description: string;
  due: string | null;
  link: string;
}

interface OverviewData {
  project: Project;
  currentLph: number;
  gates: Gate[];
  phases: Phase[];
  facts: Fact[];
  readiness: Readiness;
  actionItems: ActionItem[];
}

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("tf_token");
}

export default function ProjectOverviewPage() {
  const params = useParams();
  const projectId = params.id as string;
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    const token = getToken();
    try {
      const res = await fetch(`${API}/api/projects/${projectId}/overview`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) {
        const json = await res.json();
        setData(json.data);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <AppShell>
        <div className="animate-pulse space-y-6">
          <div className="h-14 bg-bg-inset rounded" />
          <div className="h-64 bg-bg-inset rounded" />
        </div>
      </AppShell>
    );
  }

  if (!data) {
    return (
      <AppShell>
        <div className="text-center py-20 text-text-quaternary">
          Project not found
        </div>
      </AppShell>
    );
  }

  const { project, currentLph, gates, phases, facts, readiness, actionItems } =
    data;

  const GATE_NAMES: Record<string, string> = {
    A: "Project Intake Complete",
    B: "Planning Ready",
    C: "Consultant Invitation Ready",
    D: "Tender Ready",
    E: "Execution Ready",
    F: "Closeout Ready",
  };

  return (
    <AppShell>
      <ProjectTopBar projectId={projectId} />

      <div className="space-y-6 mt-6">
        {/* 3-column layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Column 1: Project Core */}
          <div className="card p-5 space-y-4">
            <h3 className="text-xs font-medium text-text-tertiary uppercase tracking-wide">
              Project Core
            </h3>

            <EditableField
              label="Project name"
              value={project.name}
              projectId={projectId}
              field="name"
              onSave={fetchData}
            />
            <div>
              <span className="text-xs text-text-quaternary block mb-0.5">Type</span>
              <span className="text-sm text-text-primary capitalize">
                {project.type?.replace(/_/g, " ") || "—"}
              </span>
            </div>
            <EditableField
              label="Location"
              value={project.location || ""}
              projectId={projectId}
              field="location"
              onSave={fetchData}
            />
            <EditableField
              label="Client"
              value={project.clientName || ""}
              projectId={projectId}
              field="clientName"
              onSave={fetchData}
            />
            <EditableField
              label="Client representative"
              value={project.clientRepresentative || ""}
              projectId={projectId}
              field="clientRepresentative"
              onSave={fetchData}
            />
            <div>
              <span className="text-xs text-text-quaternary block mb-0.5">
                Procurement model
              </span>
              <span className="text-sm text-text-primary capitalize">
                {project.procurementModel?.replace(/_/g, " ") || "—"}
              </span>
            </div>
            <EditableField
              label="Project objective"
              value={project.objective || ""}
              projectId={projectId}
              field="objective"
              multiline
              onSave={fetchData}
            />
            <EditableField
              label="Scope summary"
              value={project.scopeSummary || ""}
              projectId={projectId}
              field="scopeSummary"
              multiline
              onSave={fetchData}
            />
            <div>
              <span className="text-xs text-text-quaternary block mb-0.5">Status</span>
              <span
                className={`text-sm font-medium capitalize ${
                  project.status === "active"
                    ? "text-gate-complete"
                    : project.status === "on_hold"
                    ? "text-brand-orange"
                    : "text-text-quaternary"
                }`}
              >
                {project.status?.replace(/_/g, " ")}
              </span>
            </div>
          </div>

          {/* Column 2: Readiness Overview */}
          <div className="card p-5 space-y-5">
            <h3 className="text-xs font-medium text-text-tertiary uppercase tracking-wide">
              Readiness Overview
            </h3>

            <ReadinessBar
              label="Planning Readiness"
              value={readiness.planning}
              href={`/projects/${projectId}/phases`}
            />
            <ReadinessBar
              label="Consultant Readiness"
              value={readiness.consultant}
              href={`/projects/${projectId}/consultants`}
            />
            <ReadinessBar
              label="Tender Readiness"
              value={readiness.tender}
              href={`/projects/${projectId}/procurement`}
            />
            <ReadinessBar
              label="Execution Readiness"
              value={readiness.execution}
              href={`/projects/${projectId}/execution`}
            />
            <ReadinessBar
              label="Closeout Readiness"
              value={readiness.closeout}
              href={`/projects/${projectId}/execution`}
            />
          </div>

          {/* Column 3: Gate Status */}
          <div className="card p-5 space-y-3">
            <h3 className="text-xs font-medium text-text-tertiary uppercase tracking-wide">
              Gate Status
            </h3>

            {gates.map((g) => {
              const icon =
                g.status === "complete"
                  ? "●"
                  : g.status === "in_progress"
                  ? "◐"
                  : "○";
              const color =
                g.status === "complete"
                  ? "text-gate-complete"
                  : g.status === "in_progress"
                  ? "text-brand-orange"
                  : g.status === "overridden"
                  ? "text-orange-500"
                  : "text-text-quaternary";
              const statusLabel =
                g.status === "complete"
                  ? "Complete"
                  : g.status === "in_progress"
                  ? "In Progress"
                  : g.status === "overridden"
                  ? "Overridden*"
                  : "Locked";

              return (
                <Link
                  key={g.gate}
                  href={`/projects/${projectId}/gates`}
                  className="flex items-center gap-3 py-2 px-2 rounded-sm hover:bg-bg-inset transition-colors group"
                >
                  <span className={`text-lg ${color}`}>{icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-mono font-medium text-text-primary">
                        Gate {g.gate}
                      </span>
                      <span className={`text-xs font-medium ${color}`}>
                        {statusLabel}
                      </span>
                    </div>
                    <p className="text-xs text-text-quaternary truncate">
                      {GATE_NAMES[g.gate]}
                    </p>
                  </div>
                  <ExternalLink
                    size={12}
                    className="text-text-quaternary opacity-0 group-hover:opacity-100 transition-opacity"
                  />
                </Link>
              );
            })}
          </div>
        </div>

        {/* Action Strip */}
        {actionItems.length > 0 && (
          <div>
            <h3 className="text-xs font-medium text-text-tertiary uppercase tracking-wide mb-3">
              Action Required
            </h3>
            <div className="flex gap-3 overflow-x-auto pb-2">
              {actionItems.map((item, i) => (
                <Link
                  key={i}
                  href={item.link}
                  className="card p-4 min-w-[260px] shrink-0 hover:border-brand-orange/50 transition-colors"
                >
                  <span className="text-xs font-medium text-brand-orange">
                    {item.category}
                  </span>
                  <p className="text-sm text-text-primary mt-1">{item.description}</p>
                  {item.due && (
                    <p
                      className={`text-xs mt-2 ${
                        item.due < new Date().toISOString().slice(0, 10)
                          ? "text-health-red font-medium"
                          : "text-text-quaternary"
                      }`}
                    >
                      Due {item.due}
                    </p>
                  )}
                  <span className="text-xs text-brand-orange font-medium mt-2 inline-flex items-center gap-1">
                    Resolve
                    <ArrowRight size={12} />
                  </span>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Project Facts Table */}
        {facts.length > 0 && (
          <div className="card overflow-hidden">
            <div className="px-5 py-3 border-b border-border">
              <h3 className="text-xs font-medium text-text-tertiary uppercase tracking-wide">
                Extracted Facts
              </h3>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-bg-inset/50">
                  <th className="text-left px-4 py-2.5 font-medium text-text-tertiary text-xs uppercase tracking-wide">
                    Field
                  </th>
                  <th className="text-left px-4 py-2.5 font-medium text-text-tertiary text-xs uppercase tracking-wide">
                    Value
                  </th>
                  <th className="text-left px-4 py-2.5 font-medium text-text-tertiary text-xs uppercase tracking-wide">
                    State
                  </th>
                </tr>
              </thead>
              <tbody>
                {facts.map((f) => (
                  <tr
                    key={f.id}
                    className="border-b border-border last:border-0"
                  >
                    <td className="px-4 py-2.5 text-text-secondary capitalize">
                      {f.fieldName.replace(/_/g, " ")}
                    </td>
                    <td className="px-4 py-2.5 text-text-primary font-medium">
                      {f.value || "—"}
                    </td>
                    <td className="px-4 py-2.5">
                      <DataStateChip state={f.dataState} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AppShell>
  );
}

// ─── Editable field component ─────────────────────────────────

function EditableField({
  label,
  value,
  projectId,
  field,
  multiline,
  onSave,
}: {
  label: string;
  value: string;
  projectId: string;
  field: string;
  multiline?: boolean;
  onSave: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);

  async function save() {
    const token =
      typeof window !== "undefined"
        ? localStorage.getItem("tf_token")
        : null;
    try {
      await fetch(
        `${API}/api/projects/${projectId}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ [field]: editValue }),
        }
      );
      onSave();
    } catch {
      // ignore
    }
    setEditing(false);
  }

  if (editing) {
    return (
      <div>
        <span className="text-xs text-text-quaternary block mb-0.5">{label}</span>
        {multiline ? (
          <textarea
            className="input text-sm min-h-[60px] resize-y"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            autoFocus
          />
        ) : (
          <input
            className="input text-sm"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter") save();
              if (e.key === "Escape") setEditing(false);
            }}
          />
        )}
        <div className="flex gap-1 mt-1">
          <button
            onClick={save}
            className="p-1 hover:bg-bg-inset rounded-sm"
          >
            <Check size={14} className="text-gate-complete" />
          </button>
          <button
            onClick={() => setEditing(false)}
            className="p-1 hover:bg-bg-inset rounded-sm"
          >
            <X size={14} className="text-text-quaternary" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="group cursor-pointer"
      onClick={() => {
        setEditValue(value);
        setEditing(true);
      }}
    >
      <span className="text-xs text-text-quaternary block mb-0.5">{label}</span>
      <span className="text-sm text-text-primary inline-flex items-center gap-1.5">
        {value || "—"}
        <Pencil
          size={12}
          className="text-text-quaternary opacity-0 group-hover:opacity-100 transition-opacity"
        />
      </span>
    </div>
  );
}

// ─── Readiness bar ────────────────────────────────────────────

function ReadinessBar({
  label,
  value,
  href,
}: {
  label: string;
  value: number;
  href: string;
}) {
  return (
    <Link href={href} className="block group">
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm text-text-secondary group-hover:text-brand-orange transition-colors">
          {label}
        </span>
        <span className="text-xs font-mono font-medium text-text-tertiary">
          {value}%
        </span>
      </div>
      <div className="w-full h-1 bg-bg-inset rounded-full overflow-hidden">
        <div
          className="h-full bg-brand-orange rounded-full transition-all duration-500"
          style={{ width: `${Math.min(value, 100)}%` }}
        />
      </div>
    </Link>
  );
}

// ─── Data state chip ──────────────────────────────────────────

function DataStateChip({ state }: { state: string }) {
  const styles: Record<string, string> = {
    CONFIRMED:
      "bg-state-confirmed-bg text-state-confirmed-text border-state-confirmed-text",
    DERIVED:
      "bg-state-derived-bg text-state-derived-text border-state-derived-text",
    UNCLEAR:
      "bg-state-unclear-bg text-state-unclear-text border-state-unclear-text",
    MISSING:
      "bg-state-missing-bg text-state-missing-text border-state-missing-text",
  };

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 text-xs font-mono font-medium rounded-sm border ${
        styles[state] || styles.MISSING
      }`}
    >
      {state}
    </span>
  );
}
