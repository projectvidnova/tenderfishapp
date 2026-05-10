"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  MoreVertical,
  Pencil,
  Archive,
  Download,
  ArrowRightCircle,
} from "lucide-react";
import { HealthDot } from "@/components/ui/HealthDot";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

interface ProjectData {
  id: string;
  name: string;
  type: string;
  status: string;
  healthScore: string;
  lifecycleState?: string | null;
}

interface GateData {
  gate: string;
  status: string;
}

export function ProjectTopBar({ projectId }: { projectId: string }) {
  const pathname = usePathname();
  const [project, setProject] = useState<ProjectData | null>(null);
  const [currentLph, setCurrentLph] = useState(1);
  const [currentGate, setCurrentGate] = useState<GateData | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");

  const fetchProject = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/projects/${projectId}/overview`, {
        credentials: "include",
      });
      if (res.ok) {
        const { data } = await res.json();
        setProject(data.project);
        setCurrentLph(data.currentLph);

        // Find current gate (first non-complete)
        const gates = data.gates || [];
        const active = gates.find(
          (g: GateData) => g.status !== "complete"
        );
        setCurrentGate(active || (gates.length > 0 ? gates[gates.length - 1] : null));
      }
    } catch {
      // ignore
    }
  }, [projectId]);

  useEffect(() => {
    fetchProject();
  }, [fetchProject]);

  async function saveName() {
    if (!editName.trim() || !project) return;
    try {
      await fetch(`${API}/api/projects/${projectId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ name: editName.trim() }),
      });
      setProject({ ...project, name: editName.trim() });
    } catch {
      // ignore
    }
    setEditing(false);
  }

  if (!project) {
    return (
      <div className="h-14 border-b border-border bg-white flex items-center px-6">
        <div className="h-4 w-48 bg-bg-inset rounded animate-pulse" />
      </div>
    );
  }

  const healthColor =
    project.healthScore === "green"
      ? "bg-health-on-track"
      : project.healthScore === "amber"
      ? "bg-health-at-risk"
      : "bg-health-red";

  const healthLabel =
    project.healthScore === "green"
      ? "On track"
      : project.healthScore === "amber"
      ? "At risk"
      : "Blocked";

  const healthStatusForDot =
    project.healthScore === "green"
      ? "on_track"
      : project.healthScore === "amber"
      ? "at_risk"
      : "blocked";

  const gateStatusColor =
    currentGate?.status === "complete"
      ? "text-gate-complete"
      : currentGate?.status === "in_progress"
      ? "text-brand-orange"
      : "text-text-quaternary";

  const gateStatusLabel =
    currentGate?.status === "complete"
      ? "Complete"
      : currentGate?.status === "in_progress"
      ? "In Progress"
      : currentGate?.status === "overridden"
      ? "Overridden"
      : "Locked";

  const lifecycleLabel = (() => {
    const state = project.lifecycleState || "parsed";
    if (state === "released_for_tender") return `Tendering · LPH ${currentLph}`;
    if (state === "tender_ready") return `Tender Ready · LPH ${currentLph}`;
    if (state === "detail_ready") return `Detail Planning · LPH ${currentLph}`;
    if (state === "cost_ready") return `Cost Planning · LPH ${currentLph}`;
    if (state === "structure_approved") return `Structure Approved · LPH ${currentLph}`;
    if (state === "confirmed") return `Confirmed · LPH ${currentLph}`;
    if (state === "needs_review") return `Needs Review · LPH ${currentLph}`;
    return `Planning · LPH ${currentLph}`;
  })();

  const nextMilestone = (() => {
    if (!currentGate) return "Next: Continue project setup";
    if (currentGate.status === "complete") return "Next: Keep progressing through remaining gates";
    if (currentGate.status === "locked") return `Next: Unlock Gate ${currentGate.gate}`;
    if (currentGate.status === "in_progress") return `Next: Complete Gate ${currentGate.gate}`;
    return `Next: Review Gate ${currentGate.gate}`;
  })();
  const nextActionHref = `/projects/${projectId}/overview#next-action`;

  return (
    <div className="sticky top-topbar z-20 border-b border-border bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/85 flex items-center justify-between px-6 py-3">
      <div className="flex items-center gap-4 min-w-0">
        {/* Project name — inline editable */}
        {editing ? (
          <input
            className="text-lg font-semibold text-text-primary border-b-2 border-brand-orange bg-transparent focus:outline-none px-0"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            onBlur={saveName}
            onKeyDown={(e) => {
              if (e.key === "Enter") saveName();
              if (e.key === "Escape") setEditing(false);
            }}
            autoFocus
          />
        ) : (
          <h1
            className="text-lg font-semibold text-text-primary cursor-pointer hover:text-brand-orange transition-colors group flex items-center gap-1.5 truncate"
            onClick={() => {
              setEditName(project.name);
              setEditing(true);
            }}
          >
            {project.name}
            <Pencil
              size={14}
              className="text-text-quaternary opacity-0 group-hover:opacity-100 transition-opacity"
            />
          </h1>
        )}

        {/* Lifecycle HUD Pill */}
        <span className="text-xs font-mono font-semibold text-brand-orange bg-brand-orange/10 border border-brand-orange/20 px-2.5 py-1 rounded-full whitespace-nowrap">
          {lifecycleLabel}
        </span>

        {/* Health Score */}
        <span className="inline-flex items-center gap-1.5 text-xs text-text-tertiary" title={healthLabel}>
          <HealthDot status={healthStatusForDot} showLabel={false} />
          <span className="font-medium">{healthLabel}</span>
        </span>

        {/* Next milestone */}
        <span className="text-xs text-text-secondary hidden md:inline-flex">
          {nextMilestone}
        </span>
      </div>

      <div className="flex items-center gap-2">
        <Link
          href={nextActionHref}
          onClick={(event) => {
            if (pathname === `/projects/${projectId}/overview`) {
              event.preventDefault();
              const nextActionSection = document.getElementById("next-action");
              nextActionSection?.scrollIntoView({ behavior: "smooth", block: "start" });
            }
          }}
          className="relative inline-flex items-center gap-2 px-3.5 py-2 rounded-full bg-brand-orange text-white text-sm font-semibold shadow-sm hover:bg-brand-orange-hover transition-colors"
        >
          <span className="absolute inset-0 rounded-full animate-pulse bg-brand-orange/30 pointer-events-none" />
          <span className="relative">View Next Action</span>
          <ArrowRightCircle size={16} className="relative" />
        </Link>

        <div className="relative">
          {/* Menu */}
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="p-1.5 hover:bg-bg-inset rounded-sm transition-colors"
          >
            <MoreVertical size={18} className="text-text-tertiary" />
          </button>
          {menuOpen && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setMenuOpen(false)}
              />
              <div className="absolute right-0 top-full mt-1 bg-white border border-border rounded-xl shadow-lg z-50 w-48 py-1">
                <button
                  onClick={() => {
                    setEditName(project.name);
                    setEditing(true);
                    setMenuOpen(false);
                  }}
                  className="w-full text-left px-4 py-2 text-sm hover:bg-bg-inset flex items-center gap-2"
                >
                  <Pencil size={14} className="text-text-quaternary" />
                  Edit project details
                </button>
                <button
                  onClick={() => setMenuOpen(false)}
                  className="w-full text-left px-4 py-2 text-sm hover:bg-bg-inset flex items-center gap-2"
                >
                  <Archive size={14} className="text-text-quaternary" />
                  Archive
                </button>
                <button
                  onClick={() => setMenuOpen(false)}
                  className="w-full text-left px-4 py-2 text-sm hover:bg-bg-inset flex items-center gap-2"
                >
                  <Download size={14} className="text-text-quaternary" />
                  Export audit pack
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
