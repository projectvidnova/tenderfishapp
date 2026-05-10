"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { clsx } from "clsx";
import {
  LayoutDashboard,
  FolderKanban,
  Inbox,
  ChevronDown,
  ChevronRight,
  Eye,
  Layers,
  CalendarDays,
  ShieldCheck,
  BookOpen,
  CheckCircle,
  FileText,
  CalendarClock,
  Euro,
  Package,
  Rocket,
  Hammer,
  ClipboardCheck,
  Clock,
  AlertTriangle,
  Users,
  HardHat,
  UserPlus,
  Settings2,
  History,
  Target,
  Scale,
  BriefcaseBusiness,
  Handshake,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useState } from "react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

// Main nav items
const mainNav = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/projects", label: "Projects", icon: FolderKanban },
  { href: "/inbox", label: "Inbox", icon: Inbox, badge: true },
];

type ProjectNavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

type ProjectNavSection = {
  id: "mission" | "planning" | "financials" | "execution" | "team";
  label: string;
  icon: LucideIcon;
  items: ProjectNavItem[];
};

const projectNavSections: ProjectNavSection[] = [
  {
    id: "mission",
    label: "Mission Control",
    icon: Target,
    items: [
      { href: "overview", label: "Overview", icon: Eye },
      { href: "gates", label: "Gate Control", icon: ShieldCheck },
      { href: "spd", label: "Project Description", icon: BookOpen },
    ],
  },
  {
    id: "planning",
    label: "Planning & Compliance",
    icon: Scale,
    items: [
      { href: "phases", label: "Phases (LPH)", icon: Layers },
      { href: "schedule", label: "Schedule", icon: CalendarDays },
      { href: "approvals", label: "Approvals", icon: CheckCircle },
      { href: "documents", label: "Documents", icon: FileText },
    ],
  },
  {
    id: "financials",
    label: "Financials & Tendering",
    icon: Euro,
    items: [
      { href: "costs", label: "Cost Estimate", icon: Euro },
      { href: "hoai", label: "HOAI Honorar", icon: Scale },
      { href: "lv", label: "Leistungsverzeichnis (GAEB)", icon: FileText },
      { href: "procurement", label: "Procurement", icon: Package },
      { href: "tender-release", label: "Tender Release", icon: Rocket },
    ],
  },
  {
    id: "execution",
    label: "Execution & Site",
    icon: Hammer,
    items: [
      { href: "execution", label: "Execution", icon: Hammer },
      { href: "contracts", label: "Contracts & Acceptance", icon: Handshake },
      { href: "reviews", label: "Reviews", icon: ClipboardCheck },
      { href: "delays", label: "Delays", icon: Clock },
      { href: "risks", label: "Risks & Blockers", icon: AlertTriangle },
    ],
  },
  {
    id: "team",
    label: "Team & Settings",
    icon: BriefcaseBusiness,
    items: [
      { href: "participants", label: "Participants", icon: Users },
      { href: "consultants", label: "Consultants", icon: HardHat },
      { href: "invitations", label: "Team & Invitations", icon: UserPlus },
      { href: "responsibilities", label: "Responsibilities", icon: CalendarClock },
      { href: "versions", label: "Versions", icon: History },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const sectionContainsActiveRoute = (section: ProjectNavSection, projectId: string) =>
    section.items.some((item) => {
      const href = `/projects/${projectId}/${item.href}`;
      return pathname === href || pathname.startsWith(`${href}/`);
    });

  const [openSections, setOpenSections] = useState<Record<ProjectNavSection["id"], boolean>>({
    mission: true,
    planning: true,
    financials: false,
    execution: false,
    team: false,
  });
  const [activeProjectName, setActiveProjectName] = useState<string>("");

  // Detect if we're inside a project
  const projectMatch = pathname.match(/^\/projects\/([^/]+)/);
  const activeProjectId = projectMatch?.[1];
  const isInProject = activeProjectId && activeProjectId !== "new";

  useEffect(() => {
    let cancelled = false;

    async function fetchProjectName(projectId: string) {
      try {
        const response = await fetch(`${API}/api/projects/${projectId}/overview`, {
          credentials: "include",
        });
        if (!response.ok) return;
        const json = await response.json();
        const name = json?.data?.project?.name;
        if (!cancelled && typeof name === "string") {
          setActiveProjectName(name);
        }
      } catch {
        // ignore sidebar project label fetch errors
      }
    }

    if (isInProject && activeProjectId) {
      fetchProjectName(activeProjectId);
      return () => {
        cancelled = true;
      };
    }

    setActiveProjectName("");
    return () => {
      cancelled = true;
    };
  }, [activeProjectId, isInProject]);

  return (
    <aside className="fixed left-0 top-0 bottom-0 w-72 bg-sidebar-bg flex flex-col z-30 border-r border-sidebar-border">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-5 py-5">
        <Link href="/dashboard" className="flex items-center gap-2.5">
          <div className="w-8 h-8 flex-shrink-0">
            <Image
              src="/tenderfish-icon.svg"
              alt="Tenderfish"
              width={32}
              height={32}
              className="w-full h-full object-contain"
            />
          </div>
          <span className="text-base font-bold text-text-primary tracking-tight">
            tender<span className="text-brand-orange">fish</span>
          </span>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-2 px-2.5">
        {/* Main nav */}
        <div className="space-y-px">
          <div className="px-3 pb-2 text-xs font-semibold uppercase tracking-widest text-text-quaternary">
            Overview
          </div>
          {mainNav.map((item) => {
            const isProjectsItem = item.href === "/projects";
            const dynamicHref =
              isProjectsItem && isInProject && activeProjectId
                ? `/projects/${activeProjectId}/overview`
                : item.href;
            const dynamicLabel =
              isProjectsItem && isInProject
                ? activeProjectName || "Current Project"
                : item.label;
            const isActive =
              pathname === dynamicHref || pathname.startsWith(dynamicHref + "/");
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={dynamicHref}
                className={clsx(
                  "flex items-center gap-2.5 px-3 py-[7px] text-sidebar-item rounded-sm transition-all duration-150 cursor-pointer mb-px",
                  isProjectsItem && isInProject && "items-start py-2",
                  isActive
                    ? "bg-sidebar-bg-active text-sidebar-text-active font-medium"
                    : "text-sidebar-text hover:bg-sidebar-bg-hover hover:text-sidebar-text-hover"
                )}
              >
                <Icon
                  size={18}
                  strokeWidth={1.5}
                  className={clsx(
                    "flex-shrink-0",
                    isActive ? "opacity-100 text-brand-orange" : "opacity-40"
                  )}
                />
                <span
                  className={clsx(
                    "min-w-0 flex-1",
                    isProjectsItem && isInProject
                      ? "whitespace-normal break-words leading-tight"
                      : "truncate"
                  )}
                >
                  {dynamicLabel}
                </span>
                {item.badge && (
                  <span className="ml-auto bg-brand-orange text-white text-[10px] font-semibold px-1.5 py-px rounded-full">
                    3
                  </span>
                )}
              </Link>
            );
          })}
        </div>

        {/* Project sub-nav with lifecycle groups */}
        {isInProject && (
          <>
            <div className="mx-3 my-4 border-t border-sidebar-border" />
            <div className="mx-3 mb-3 rounded-lg border border-sidebar-border bg-white/70 px-3 py-2">
              <div className="text-[10px] font-semibold uppercase tracking-widest text-text-quaternary">
                Current Project
              </div>
              <div className="mt-1 text-sm font-semibold text-text-primary truncate">
                {activeProjectName || "Loading project..."}
              </div>
            </div>
            <div className="space-y-1">
              {projectNavSections.map((section) => {
                const SectionIcon = section.icon;
                const isOpen =
                  openSections[section.id] || sectionContainsActiveRoute(section, activeProjectId!);

                return (
                  <div key={section.id}>
                    <button
                      onClick={() =>
                        setOpenSections((prev) => ({
                          ...prev,
                          [section.id]: !isOpen,
                        }))
                      }
                      className="flex items-center gap-2.5 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-text-quaternary hover:text-text-primary w-full transition-colors"
                    >
                      {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      <SectionIcon size={14} className="opacity-70" />
                      {section.label}
                    </button>

                    {isOpen && (
                      <div className="mt-1 space-y-px">
                        {section.items.map((item) => {
                          const href = `/projects/${activeProjectId}/${item.href}`;
                          const isActive = pathname === href || pathname.startsWith(`${href}/`);
                          const Icon = item.icon;

                          return (
                            <Link
                              key={item.href}
                              href={href}
                              className={clsx(
                                "flex items-center gap-2.5 px-3 py-[6px] text-sidebar-item rounded-sm transition-all duration-150 cursor-pointer mb-px",
                                isActive
                                  ? "bg-sidebar-bg-active text-sidebar-text-active font-medium"
                                  : "text-sidebar-text hover:bg-sidebar-bg-hover hover:text-sidebar-text-hover"
                              )}
                            >
                              <Icon
                                size={16}
                                strokeWidth={1.5}
                                className={clsx(
                                  "flex-shrink-0",
                                  isActive ? "opacity-100 text-brand-orange" : "opacity-40"
                                )}
                              />
                              <span className="text-sm">{item.label}</span>
                            </Link>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </nav>

      {/* Bottom: workspace */}
      <div className="px-4 py-4 border-t border-sidebar-border">
        <Link
          href="/settings"
          className={clsx(
            "flex items-center gap-2.5 px-2 py-2 rounded-sm cursor-pointer transition-all duration-150",
            pathname.startsWith("/settings")
              ? "bg-sidebar-bg-active"
              : "hover:bg-sidebar-bg-hover"
          )}
        >
          <div className="w-[30px] h-[30px] rounded-full bg-brand-orange-light flex items-center justify-center text-brand-orange text-xs font-semibold">
            MA
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-text-primary truncate">
              My Workspace
            </div>
            <div className="text-xs text-text-tertiary inline-flex items-center gap-1">
              <Settings2 size={12} />
              Settings
            </div>
          </div>
        </Link>
      </div>
    </aside>
  );
}
