"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import AppShell from "@/components/layout/AppShell";
import { ProjectTopBar } from "@/components/project/ProjectTopBar";
import { DataStateChip } from "@/components/ui/DataStateChip";
import {
  Pencil,
  Check,
  X,
  ArrowRight,
  ArrowLeft,
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
  sourceRef?: string | null;
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
  inferredOverview: {
    clientName: string | null;
    commissionedPhases: number[];
    buildingPermitStatus: string | null;
  };
  actionItems: ActionItem[];
}

export default function ProjectOverviewPage() {
  const params = useParams();
  const projectId = params.id as string;
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirmingFactId, setConfirmingFactId] = useState<string | null>(null);
  const [editingRowKey, setEditingRowKey] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<string>("");
  const [gapInputs, setGapInputs] = useState<Record<string, string>>({});
  const [savingGapKey, setSavingGapKey] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/projects/${projectId}/overview`, {
        credentials: "include",
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

  async function confirmFact(factId: string) {
    try {
      setConfirmingFactId(factId);
      await fetch(`${API}/api/projects/${projectId}/facts/${factId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ dataState: "CONFIRMED" }),
      });
      await fetchData();
    } catch {
      // ignore
    } finally {
      setConfirmingFactId(null);
    }
  }

  async function confirmFactsBatch(factIds: string[]) {
    if (factIds.length === 0) return;
    const key = factIds.join("|");
    try {
      setConfirmingFactId(key);
      await Promise.all(
        factIds.map((factId) =>
          fetch(`${API}/api/projects/${projectId}/facts/${factId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ dataState: "CONFIRMED" }),
          })
        )
      );
      await fetchData();
    } catch {
      // ignore
    } finally {
      setConfirmingFactId(null);
    }
  }

  async function createFact(
    fieldName: string,
    value: string,
    sourceRef = "manual_entry"
  ): Promise<boolean> {
    try {
      const res = await fetch(`${API}/api/projects/${projectId}/facts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          fieldName,
          value,
          dataState: "DERIVED",
          sourceRef,
        }),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  async function updateFact(
    factId: string,
    value: string,
    sourceRef?: string
  ): Promise<boolean> {
    try {
      const res = await fetch(`${API}/api/projects/${projectId}/facts/${factId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          value,
          dataState: "DERIVED",
          sourceRef: sourceRef || "manual_update",
        }),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  async function deleteFact(factId: string): Promise<boolean> {
    try {
      const res = await fetch(`${API}/api/projects/${projectId}/facts/${factId}`, {
        method: "DELETE",
        credentials: "include",
      });
      return res.ok;
    } catch {
      return false;
    }
  }

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

  const {
    project,
    currentLph,
    gates,
    phases,
    facts,
    readiness,
    inferredOverview,
    actionItems,
  } =
    data;
  const parseFactValue = (value: string | null): Record<string, unknown> | null => {
    if (!value) return null;
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : null;
    } catch {
      return null;
    }
  };
  const costFacts = facts.filter((f) => f.fieldName === "cost_item");
  const dinGroups: Record<"300" | "400" | "500" | "700", Fact[]> = {
    "300": [],
    "400": [],
    "500": [],
    "700": [],
  };
  for (const fact of costFacts) {
    const parsed = parseFactValue(fact.value);
    const code = String(parsed?.din276_code || "");
    if (code.startsWith("3")) dinGroups["300"].push(fact);
    if (code.startsWith("4")) dinGroups["400"].push(fact);
    if (code.startsWith("5")) dinGroups["500"].push(fact);
    if (code.startsWith("7")) dinGroups["700"].push(fact);
  }
  const factByField = new Map<string, Fact[]>();
  for (const fact of facts) {
    const existing = factByField.get(fact.fieldName) || [];
    existing.push(fact);
    factByField.set(fact.fieldName, existing);
  }

  const resolveState = (items: Fact[]): "CONFIRMED" | "DERIVED" | "UNCLEAR" | "MISSING" => {
    if (items.length === 0) return "MISSING";
    if (items.some((item) => item.dataState === "CONFIRMED")) return "CONFIRMED";
    if (items.some((item) => item.dataState === "DERIVED")) return "DERIVED";
    if (items.some((item) => item.dataState === "UNCLEAR")) return "UNCLEAR";
    return "MISSING";
  };
  const renderValue = (value: string | null, mono = false) => {
    if (!value) {
      return <span className="text-text-quaternary">—</span>;
    }
    return <span className={mono ? "font-mono tabular-nums text-text-primary" : "text-text-primary"}>{value}</span>;
  };
  const getFactRow = (fieldNames: string[]) => {
    const items = fieldNames.flatMap((name) => factByField.get(name) || []);
    return {
      items,
      first: items[0] || null,
      state: resolveState(items),
    };
  };
  const accessibilityRow = getFactRow(["accessibility_requirements"]);
  const buildingPermitRow = getFactRow([
    "overview_building_permit_status",
    "building_permit_status",
  ]);
  const commissionedPhasesRow = getFactRow([
    "overview_commissioned_phases",
    "commissioned_phases",
  ]);

  const getCommissionedPhasesValue = () => {
    if (inferredOverview.commissionedPhases.length > 0) {
      return inferredOverview.commissionedPhases.map((phase) => `LPH ${phase}`).join(", ");
    }
    const parsed = parseFactValue(commissionedPhasesRow.first?.value || null);
    const list = Array.isArray(parsed?.commissioned_phases)
      ? parsed.commissioned_phases
      : Array.isArray(parsed?.phases)
      ? parsed.phases
      : [];
    if (list.length === 0) return null;
    return list.map((phase) => `LPH ${String(phase)}`).join(", ");
  };
  const getBuildingPermitValue = () => {
    if (inferredOverview.buildingPermitStatus) return inferredOverview.buildingPermitStatus;
    const parsed = parseFactValue(buildingPermitRow.first?.value || null);
    if (typeof parsed?.building_permit_status === "string") return parsed.building_permit_status;
    if (typeof parsed?.value === "string") return parsed.value;
    return null;
  };
  const getAccessibilityValue = () => {
    const parsed = parseFactValue(accessibilityRow.first?.value || null);
    if (typeof parsed?.value === "string") return parsed.value;
    if (typeof parsed?.accessibility_requirements === "string") return parsed.accessibility_requirements;
    return accessibilityRow.first?.value || null;
  };
  const getCurrentHoaiPhaseValue = () => {
    const currentPhaseFacts = factByField.get("current_hoai_phase") || [];
    if (currentPhaseFacts.length > 0) {
      const parsed = parseFactValue(currentPhaseFacts[0].value);
      const phase =
        typeof parsed?.hoai_phase === "number"
          ? parsed.hoai_phase
          : typeof parsed?.current_hoai_phase === "number"
          ? parsed.current_hoai_phase
          : null;
      if (phase) return `LPH ${phase}`;
    }
    return `LPH ${currentLph}`;
  };
  const hoaiMilestonesRow = getFactRow(["hoai_phase_milestones"]);
  const getHoaiMilestonesValue = () => {
    const parsed = parseFactValue(hoaiMilestonesRow.first?.value || null);
    if (Array.isArray(parsed?.milestones) && parsed.milestones.length > 0) {
      return parsed.milestones.join(", ");
    }
    return hoaiMilestonesRow.first?.value || null;
  };
  const formatDinAmount = (groupCode: "300" | "400" | "500" | "700"): string | null => {
    const rows = dinGroups[groupCode];
    if (rows.length === 0) return null;
    const total = rows.reduce((sum, fact) => {
      const parsed = parseFactValue(fact.value);
      const amount = typeof parsed?.amount === "number" ? parsed.amount : 0;
      return sum + amount;
    }, 0);
    if (total <= 0) return null;
    return new Intl.NumberFormat("de-DE", {
      style: "currency",
      currency: "EUR",
      maximumFractionDigits: 0,
    }).format(total);
  };

  const extractedRows = [
    {
      key: "accessibility_requirements",
      field: "Accessibility Requirements",
      value: getAccessibilityValue(),
      state: accessibilityRow.state,
      factIds: accessibilityRow.items.map((item) => item.id),
      primaryFactId: accessibilityRow.first?.id || null,
      fieldName: "accessibility_requirements",
      editable: true,
      numeric: false,
    },
    {
      key: "overview_building_permit_status",
      field: "Building Permit Status",
      value: getBuildingPermitValue(),
      state: buildingPermitRow.state,
      factIds: buildingPermitRow.items.map((item) => item.id),
      primaryFactId: buildingPermitRow.first?.id || null,
      fieldName: "overview_building_permit_status",
      editable: true,
      numeric: false,
    },
    {
      key: "overview_commissioned_phases",
      field: "Commissioned Phases (HOAI)",
      value: getCommissionedPhasesValue(),
      state: commissionedPhasesRow.state,
      factIds: commissionedPhasesRow.items.map((item) => item.id),
      primaryFactId: commissionedPhasesRow.first?.id || null,
      fieldName: "overview_commissioned_phases",
      editable: true,
      numeric: false,
    },
    {
      key: "din_300",
      field: "Cost Group Estimate (DIN 276: 300 Bauwerk)",
      value: formatDinAmount("300"),
      state: resolveState(dinGroups["300"]),
      factIds: dinGroups["300"].map((item) => item.id),
      primaryFactId: dinGroups["300"][0]?.id || null,
      fieldName: "cost_item",
      editable: false,
      numeric: true,
    },
    {
      key: "din_400",
      field: "Cost Group Estimate (DIN 276: 400 Technik)",
      value: formatDinAmount("400"),
      state: resolveState(dinGroups["400"]),
      factIds: dinGroups["400"].map((item) => item.id),
      primaryFactId: dinGroups["400"][0]?.id || null,
      fieldName: "cost_item",
      editable: false,
      numeric: true,
    },
    {
      key: "din_500",
      field: "Cost Group Estimate (DIN 276: 500 Außenanlagen)",
      value: formatDinAmount("500"),
      state: resolveState(dinGroups["500"]),
      factIds: dinGroups["500"].map((item) => item.id),
      primaryFactId: dinGroups["500"][0]?.id || null,
      fieldName: "cost_item",
      editable: false,
      numeric: true,
    },
    {
      key: "din_700",
      field: "Cost Group Estimate (DIN 276: 700 Baunebenkosten)",
      value: formatDinAmount("700"),
      state: resolveState(dinGroups["700"]),
      factIds: dinGroups["700"].map((item) => item.id),
      primaryFactId: dinGroups["700"][0]?.id || null,
      fieldName: "cost_item",
      editable: false,
      numeric: true,
    },
  ];
  const structuralRows = extractedRows.filter((row) => row.key.startsWith("din_"));
  const structuralConfirmed = structuralRows.filter((row) => row.state === "CONFIRMED").length;
  const structuralProgress =
    structuralRows.length > 0
      ? Math.round((structuralConfirmed / structuralRows.length) * 100)
      : 0;

  const gapTasks: Array<{
    key: string;
    fieldLabel: string;
    fieldName: string;
    value: string | null;
    factId: string | null;
    sourceRef: string;
  }> = [
    {
      key: "building_permit_status_gap",
      fieldLabel: "Building Permit Status",
      fieldName: "overview_building_permit_status",
      value: getBuildingPermitValue(),
      factId: buildingPermitRow.first?.id || null,
      sourceRef: buildingPermitRow.first?.sourceRef || "manual_gap_resolution",
    },
    {
      key: "client_representative_gap",
      fieldLabel: "Client Representative",
      fieldName: "client_representative",
      value: project.clientRepresentative,
      factId: null,
      sourceRef: "manual_gap_resolution",
    },
    {
      key: "accessibility_gap",
      fieldLabel: "Accessibility Requirements",
      fieldName: "accessibility_requirements",
      value: getAccessibilityValue(),
      factId: accessibilityRow.first?.id || null,
      sourceRef: accessibilityRow.first?.sourceRef || "manual_gap_resolution",
    },
  ].filter((task) => !task.value || task.value.trim().length === 0 || task.value === "—");

  const nextStepDocs: Record<number, string[]> = {
    1: ["Client brief", "Site baseline survey", "Initial DIN 276 cost assumptions (KG 300-700)"],
    2: ["HOAI phase objectives", "Milestone draft for current phase", "Authority requirement list"],
    3: ["Permit status evidence", "Consultant inputs", "Validated cost and scope confirmations"],
    4: ["Bauantrag package", "Regulatory submission checklist", "Updated timeline and risk controls"],
    5: ["Execution planning documents", "Trade package definitions", "Coordinated discipline deliverables"],
    6: ["Tender strategy", "Bid package approvals", "Evaluation criteria"],
    7: ["Award recommendation", "Contract documentation", "Updated cost snapshot"],
    8: ["Execution logs", "Quality assurance evidence", "Change documentation"],
    9: ["Closeout package", "Final cost determination", "Handover and warranty records"],
  };
  const nextPhase = Math.min(9, currentLph + 1);

  const serializeEditedValue = (fieldName: string, value: string): string => {
    const cleaned = value.trim();
    if (fieldName === "overview_commissioned_phases") {
      const phases = Array.from(
        new Set(
          cleaned
            .split(/[,\s]+/)
            .map((part) => Number(part.replace(/[^\d]/g, "")))
            .filter((n) => Number.isInteger(n) && n >= 1 && n <= 9)
        )
      ).sort((a, b) => a - b);
      return JSON.stringify({ commissioned_phases: phases });
    }
    if (fieldName === "overview_building_permit_status") {
      return JSON.stringify({ building_permit_status: cleaned });
    }
    if (fieldName === "accessibility_requirements") {
      return JSON.stringify({ accessibility_requirements: cleaned });
    }
    return cleaned;
  };

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
              value={project.clientName || inferredOverview.clientName || ""}
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
              <span className="text-xs text-text-quaternary block mb-0.5">
                Project overview (auto-inferred)
              </span>
              <div className="space-y-1.5 text-sm">
                <div className="flex items-center gap-2">
                  <span className="text-text-secondary">Client Name:</span>
                  <span className="text-text-primary">{inferredOverview.clientName || "—"}</span>
                  <DataStateChip state="DERIVED" />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-text-secondary">Commissioned Phases:</span>
                  <span className="text-text-primary">
                    {inferredOverview.commissionedPhases.length
                      ? inferredOverview.commissionedPhases
                          .map((phase) => `LPH ${phase}`)
                          .join(", ")
                      : "—"}
                  </span>
                  <DataStateChip state="DERIVED" />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-text-secondary">Building Permit Status:</span>
                  <span className="text-text-primary">{inferredOverview.buildingPermitStatus || "—"}</span>
                  <DataStateChip state="DERIVED" />
                </div>
              </div>
            </div>
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

        <div className="card overflow-hidden border-2 border-border">
          <div className="px-5 py-3 border-b border-border bg-bg-inset/40">
            <h3 className="text-xs font-semibold text-text-tertiary uppercase tracking-[0.08em]">
              Project Success Roadmap
            </h3>
          </div>
          <div className="px-5 py-3 border-b border-border bg-white">
            <div className="flex flex-wrap items-center gap-2">
              <Link
                href={`/projects/${projectId}`}
                className="inline-flex items-center gap-2 px-3 py-1.5 border border-border rounded-md text-sm text-text-secondary hover:bg-bg-inset transition-colors"
              >
                <ArrowLeft size={14} />
                Back to edit
              </Link>
              <Link
                href="/projects/new"
                className="inline-flex items-center gap-2 px-3 py-1.5 border border-brand-orange text-brand-orange rounded-md text-sm font-medium hover:bg-orange-50 transition-colors"
              >
                Create project
              </Link>
            </div>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-0">
            <div className="border-r border-border">
              <div className="px-5 py-4 border-b border-border bg-white">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-text-primary">
                    Step 1: Structural Audit (DIN 276)
                  </h4>
                  <span className="text-xs font-mono text-text-tertiary">
                    {structuralProgress}% complete
                  </span>
                </div>
              </div>
              <table className="w-full text-sm table-fixed">
                <thead>
                  <tr className="border-b border-border bg-bg-inset/20">
                    <th className="w-[42%] text-left px-4 py-3 font-semibold text-text-tertiary text-xs uppercase tracking-[0.08em]">FIELD</th>
                    <th className="w-[23%] text-left px-4 py-3 font-semibold text-text-tertiary text-xs uppercase tracking-[0.08em]">VALUE</th>
                    <th className="w-[15%] text-left px-4 py-3 font-semibold text-text-tertiary text-xs uppercase tracking-[0.08em]">STATE</th>
                    <th className="w-[20%] text-left px-4 py-3 font-semibold text-text-tertiary text-xs uppercase tracking-[0.08em]">ACTION</th>
                  </tr>
                </thead>
                <tbody>
                  {structuralRows.map((row) => {
                    const isBatch = row.factIds.length > 1;
                    const confirmKey = isBatch ? row.factIds.join("|") : row.factIds[0] || "";
                    const isConfirming = confirmingFactId === confirmKey;
                    return (
                      <tr key={row.key} className="border-b border-border">
                        <td className="px-4 py-3 text-text-secondary">{row.field}</td>
                        <td className="px-4 py-3 font-mono tabular-nums">{renderValue(row.value, true)}</td>
                        <td className="px-4 py-3"><DataStateChip state={row.state} /></td>
                        <td className="px-4 py-3">
                          {row.state !== "CONFIRMED" && row.factIds.length > 0 ? (
                            <button
                              onClick={() =>
                                isBatch ? confirmFactsBatch(row.factIds) : confirmFact(row.factIds[0])
                              }
                              disabled={isConfirming}
                              className="text-xs font-medium text-brand-orange hover:text-brand-orange-strong disabled:opacity-50"
                            >
                              Confirm
                            </button>
                          ) : (
                            <span className="text-text-quaternary">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              <div className="px-5 py-4 border-b border-border bg-white">
                <h4 className="text-sm font-semibold text-text-primary mb-3">
                  Step 2: HOAI Phase Alignment
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-center">
                  <div className="text-xs text-text-tertiary uppercase tracking-wide">Detected service phase</div>
                  <div className="md:col-span-1 text-sm text-text-primary font-mono">{getCurrentHoaiPhaseValue()}</div>
                  <div className="md:col-span-1">
                    <DataStateChip state={resolveState(factByField.get("current_hoai_phase") || [])} />
                  </div>
                  <div className="md:col-span-1">
                    {resolveState(factByField.get("current_hoai_phase") || []) !== "CONFIRMED" &&
                    (factByField.get("current_hoai_phase") || []).length > 0 ? (
                      <button
                        onClick={() => confirmFact((factByField.get("current_hoai_phase") || [])[0].id)}
                        className="text-xs font-medium text-brand-orange hover:text-brand-orange-strong"
                      >
                        Confirm
                      </button>
                    ) : (
                      <span className="text-text-quaternary text-xs">—</span>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-center mt-3">
                  <div className="text-xs text-text-tertiary uppercase tracking-wide">Target milestones</div>
                  <div className="md:col-span-2">
                    {editingRowKey === "hoai_phase_milestones" ? (
                      <input
                        className="input text-sm h-9 w-full"
                        value={editDraft}
                        onChange={(event) => setEditDraft(event.target.value)}
                        placeholder="e.g. Genehmigungsplanung freeze, permit submission"
                      />
                    ) : (
                      renderValue(getHoaiMilestonesValue(), false)
                    )}
                  </div>
                  <div className="md:col-span-1 flex items-center gap-2">
                    <DataStateChip state={hoaiMilestonesRow.state} />
                    {editingRowKey === "hoai_phase_milestones" ? (
                      <>
                        <button
                          className="text-xs font-medium text-brand-orange hover:text-brand-orange-strong"
                          onClick={async () => {
                            const payload = JSON.stringify({
                              milestones: editDraft
                                .split(",")
                                .map((item) => item.trim())
                                .filter(Boolean),
                            });
                            const ok = hoaiMilestonesRow.first
                              ? await updateFact(
                                  hoaiMilestonesRow.first.id,
                                  payload,
                                  hoaiMilestonesRow.first.sourceRef || "manual_milestone_update"
                                )
                              : await createFact("hoai_phase_milestones", payload, "manual_milestone_update");
                            if (ok) {
                              setEditingRowKey(null);
                              setEditDraft("");
                              await fetchData();
                            }
                          }}
                        >
                          Save
                        </button>
                        <button
                          className="text-xs text-text-tertiary hover:text-text-secondary"
                          onClick={() => {
                            setEditingRowKey(null);
                            setEditDraft("");
                          }}
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <button
                        className="text-xs font-medium text-brand-orange hover:text-brand-orange-strong"
                        onClick={() => {
                          setEditingRowKey("hoai_phase_milestones");
                          setEditDraft(getHoaiMilestonesValue() || "");
                        }}
                      >
                        {hoaiMilestonesRow.first ? "Edit" : "Add"}
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <div className="px-5 py-4 bg-white">
                <h4 className="text-sm font-semibold text-text-primary mb-3">
                  Step 3: Gap Resolution
                </h4>
                <div className="space-y-3">
                  {gapTasks.length === 0 ? (
                    <div className="text-sm text-gate-complete">All critical HOAI readiness gaps are currently resolved.</div>
                  ) : (
                    gapTasks.map((task) => (
                      <div key={task.key} className="grid grid-cols-1 md:grid-cols-[1.2fr_1.4fr_auto] gap-3 items-center border border-border rounded-md p-3">
                        <div>
                          <div className="text-sm text-text-primary">{task.fieldLabel}</div>
                          <DataStateChip state="MISSING" />
                        </div>
                        <input
                          className="input text-sm h-9"
                          placeholder={`Add ${task.fieldLabel.toLowerCase()}...`}
                          value={gapInputs[task.key] || ""}
                          onChange={(event) =>
                            setGapInputs((prev) => ({ ...prev, [task.key]: event.target.value }))
                          }
                        />
                        <button
                          className="btn-primary text-sm"
                          disabled={!gapInputs[task.key]?.trim() || savingGapKey === task.key}
                          onClick={async () => {
                            setSavingGapKey(task.key);
                            const payload = serializeEditedValue(task.fieldName, gapInputs[task.key] || "");
                            const ok = task.factId
                              ? await updateFact(task.factId, payload, task.sourceRef)
                              : await createFact(task.fieldName, payload, task.sourceRef);
                            if (ok) {
                              setGapInputs((prev) => ({ ...prev, [task.key]: "" }));
                              await fetchData();
                            }
                            setSavingGapKey(null);
                          }}
                        >
                          Add Missing Data
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            <div className="bg-bg-inset/20 p-5">
              <h4 className="text-sm font-semibold text-text-primary">Next Steps</h4>
              <p className="text-xs text-text-tertiary mt-1">
                Documentation required to advance from {`LPH ${currentLph}`} to {`LPH ${nextPhase}`}.
              </p>
              <div className="mt-4 space-y-2">
                {(nextStepDocs[currentLph] || nextStepDocs[nextPhase] || []).map((doc) => (
                  <div key={doc} className="text-sm text-text-secondary border border-border rounded-md px-3 py-2 bg-white">
                    {doc}
                  </div>
                ))}
              </div>
              <div className="mt-5">
                <div className="text-xs uppercase tracking-wide text-text-tertiary mb-2">Regulatory health</div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span>Red (Missing)</span>
                    <span className="font-mono">
                      {extractedRows.filter((row) => row.state === "MISSING").length}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span>Orange (Inferred)</span>
                    <span className="font-mono">
                      {extractedRows.filter((row) => row.state === "DERIVED").length}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span>Green (Confirmed)</span>
                    <span className="font-mono">
                      {extractedRows.filter((row) => row.state === "CONFIRMED").length}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="px-5 py-3 border-t border-border bg-white">
            <div className="flex flex-wrap items-center gap-2">
              <Link
                href={`/projects/${projectId}`}
                className="inline-flex items-center gap-2 px-3 py-1.5 border border-border rounded-md text-sm text-text-secondary hover:bg-bg-inset transition-colors"
              >
                <ArrowLeft size={14} />
                Back to edit
              </Link>
              <Link
                href="/projects/new"
                className="inline-flex items-center gap-2 px-3 py-1.5 border border-brand-orange text-brand-orange rounded-md text-sm font-medium hover:bg-orange-50 transition-colors"
              >
                Create project
              </Link>
            </div>
          </div>
        </div>
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
    try {
      await fetch(
        `${API}/api/projects/${projectId}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
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

