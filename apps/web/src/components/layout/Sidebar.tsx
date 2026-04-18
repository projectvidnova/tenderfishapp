"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { clsx } from "clsx";
import {
  LayoutDashboard,
  FolderKanban,
  Inbox,
  Settings,
  ChevronDown,
  ChevronRight,
  Eye,
  Layers,
  CalendarDays,
  Users,
  CheckCircle,
  HardHat,
  Package,
  FileText,
  AlertTriangle,
  Clock,
  ClipboardCheck,
  Hammer,
  ShieldCheck,
  UserPlus,
  BookOpen,
  Rocket,
  Euro,
  History,
} from "lucide-react";
import { useState } from "react";

// Main nav items
const mainNav = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/projects", label: "Projects", icon: FolderKanban },
  { href: "/inbox", label: "Inbox", icon: Inbox, badge: true },
];

// Project sub-nav items
const projectSubNav = [
  { href: "overview", label: "Overview", icon: Eye },
  { href: "spd", label: "Project Description", icon: BookOpen },
  { href: "phases", label: "Phases (LPH)", icon: Layers },
  { href: "schedule", label: "Schedule", icon: CalendarDays },
  { href: "responsibilities", label: "Responsibilities", icon: Users },
  { href: "approvals", label: "Approvals", icon: CheckCircle },
  { href: "consultants", label: "Consultants", icon: HardHat },
  { href: "procurement", label: "Procurement", icon: Package },
  { href: "costs", label: "Cost Estimate", icon: Euro },
  { href: "documents", label: "Documents", icon: FileText },
  { href: "risks", label: "Risks & Blockers", icon: AlertTriangle },
  { href: "delays", label: "Delays", icon: Clock },
  { href: "reviews", label: "Reviews", icon: ClipboardCheck },
  { href: "execution", label: "Execution", icon: Hammer },
  { href: "gates", label: "Gate Control", icon: ShieldCheck },
  { href: "tender-release", label: "Tender Release", icon: Rocket },
  { href: "participants", label: "Participants", icon: Users },
  { href: "versions", label: "Versions", icon: History },
  { href: "invitations", label: "Team & Invitations", icon: UserPlus },
];

export function Sidebar() {
  const pathname = usePathname();
  const [projectNavOpen, setProjectNavOpen] = useState(true);

  // Detect if we're inside a project
  const projectMatch = pathname.match(/^\/projects\/([^/]+)/);
  const activeProjectId = projectMatch?.[1];
  const isInProject = activeProjectId && activeProjectId !== "new";

  return (
    <aside className="fixed left-0 top-0 bottom-0 w-sidebar bg-sidebar-bg flex flex-col z-30 border-r border-sidebar-border">
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
            const isActive =
              pathname === item.href || pathname.startsWith(item.href + "/");
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={clsx(
                  "flex items-center gap-2.5 px-3 py-[7px] text-sidebar-item rounded-sm transition-all duration-150 cursor-pointer mb-px",
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
                <span>{item.label}</span>
                {item.badge && (
                  <span className="ml-auto bg-brand-orange text-white text-[10px] font-semibold px-1.5 py-px rounded-full">
                    3
                  </span>
                )}
              </Link>
            );
          })}
        </div>

        {/* Project sub-nav */}
        {isInProject && (
          <>
            <div className="mx-3 my-4 border-t border-sidebar-border" />
            <div>
              <button
                onClick={() => setProjectNavOpen(!projectNavOpen)}
                className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold uppercase tracking-widest text-text-quaternary hover:text-text-primary w-full transition-colors"
              >
                {projectNavOpen ? (
                  <ChevronDown size={14} />
                ) : (
                  <ChevronRight size={14} />
                )}
                Active Project
              </button>

              {projectNavOpen && (
                <div className="mt-1 space-y-px">
                  {projectSubNav.map((item) => {
                    const href = `/projects/${activeProjectId}/${item.href}`;
                    const isActive = pathname === href;
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
                            isActive
                              ? "opacity-100 text-brand-orange"
                              : "opacity-40"
                          )}
                        />
                        <span className="text-sm">
                          {item.label}
                        </span>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </nav>

      {/* Bottom: user */}
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
            <div className="text-xs text-text-tertiary">Settings</div>
          </div>
        </Link>
      </div>
    </aside>
  );
}
