"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
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
  { href: "phases", label: "Phases (LPH)", icon: Layers },
  { href: "schedule", label: "Schedule", icon: CalendarDays },
  { href: "responsibilities", label: "Responsibilities", icon: Users },
  { href: "approvals", label: "Approvals", icon: CheckCircle },
  { href: "consultants", label: "Consultants", icon: HardHat },
  { href: "procurement", label: "Procurement", icon: Package },
  { href: "documents", label: "Documents", icon: FileText },
  { href: "risks", label: "Risks & Blockers", icon: AlertTriangle },
  { href: "delays", label: "Delays", icon: Clock },
  { href: "reviews", label: "Reviews", icon: ClipboardCheck },
  { href: "execution", label: "Execution", icon: Hammer },
  { href: "gates", label: "Gate Control", icon: ShieldCheck },
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
    <aside className="fixed left-0 top-0 bottom-0 w-sidebar bg-sidebar-bg flex flex-col z-30">
      {/* Logo */}
      <div className="h-topbar flex items-center px-5 border-b border-white/10">
        <Link href="/dashboard" className="flex items-center gap-2">
          <span className="text-white text-lg font-semibold tracking-tight">
            Tenderfish
          </span>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4">
        {/* Main nav */}
        <div className="space-y-0.5 px-3">
          {mainNav.map((item) => {
            const isActive =
              pathname === item.href || pathname.startsWith(item.href + "/");
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={clsx(
                  "flex items-center gap-3 px-3 py-2 text-sidebar-item rounded-sm transition-colors duration-150",
                  isActive
                    ? "text-sidebar-active bg-white/5 border-l-2 border-sidebar-border -ml-[2px] pl-[14px]"
                    : "text-sidebar-text hover:text-sidebar-active"
                )}
              >
                <Icon size={18} strokeWidth={1.5} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>

        {/* Project sub-nav */}
        {isInProject && (
          <>
            <div className="mx-3 my-4 border-t border-white/10" />
            <div className="px-3">
              <button
                onClick={() => setProjectNavOpen(!projectNavOpen)}
                className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium uppercase tracking-wider text-sidebar-text hover:text-sidebar-active w-full transition-colors"
              >
                {projectNavOpen ? (
                  <ChevronDown size={14} />
                ) : (
                  <ChevronRight size={14} />
                )}
                Active Project
              </button>

              {projectNavOpen && (
                <div className="mt-1 space-y-0.5">
                  {projectSubNav.map((item) => {
                    const href = `/projects/${activeProjectId}/${item.href}`;
                    const isActive = pathname === href;
                    const Icon = item.icon;

                    return (
                      <Link
                        key={item.href}
                        href={href}
                        className={clsx(
                          "flex items-center gap-3 px-3 py-1.5 text-sidebar-item rounded-sm transition-colors duration-150",
                          isActive
                            ? "text-sidebar-active bg-white/5 border-l-2 border-sidebar-border -ml-[2px] pl-[14px]"
                            : "text-sidebar-text hover:text-sidebar-active"
                        )}
                      >
                        <Icon size={16} strokeWidth={1.5} />
                        <span className="text-[13px]">{item.label}</span>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </nav>

      {/* Bottom nav */}
      <div className="px-3 py-4 border-t border-white/10">
        <Link
          href="/settings"
          className={clsx(
            "flex items-center gap-3 px-3 py-2 text-sidebar-item rounded-sm transition-colors duration-150",
            pathname.startsWith("/settings")
              ? "text-sidebar-active bg-white/5 border-l-2 border-sidebar-border -ml-[2px] pl-[14px]"
              : "text-sidebar-text hover:text-sidebar-active"
          )}
        >
          <Settings size={18} strokeWidth={1.5} />
          <span>Settings</span>
        </Link>
      </div>
    </aside>
  );
}
