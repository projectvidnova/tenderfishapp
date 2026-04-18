"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Inbox, Plus, Search, Bell } from "lucide-react";

function useBreadcrumb(): string {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);

  if (segments[0] === "dashboard" || segments.length === 0) return "Dashboard";
  if (segments[0] === "inbox") return "Inbox";
  if (segments[0] === "settings") return "Settings";
  if (segments[0] === "projects" && segments.length === 1) return "Projects";
  if (segments[0] === "projects" && segments[1] === "new") return "New Project";
  if (segments[0] === "projects" && segments.length >= 3) {
    const sub = segments[2]?.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    return `Project / ${sub}`;
  }
  return segments[0].replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function TopBar() {
  const breadcrumb = useBreadcrumb();

  return (
    <header
      className="fixed top-0 left-sidebar right-0 h-topbar border-b border-border flex items-center justify-between px-6 z-20"
      style={{
        background: "rgba(255,255,255,0.8)",
        backdropFilter: "saturate(180%) blur(20px)",
        WebkitBackdropFilter: "saturate(180%) blur(20px)",
      }}
    >
      {/* Left: breadcrumb */}
      <div className="flex items-center gap-4">
        <span className="text-sm font-semibold text-text-primary">
          {breadcrumb}
        </span>
      </div>

      {/* Right: search + actions */}
      <div className="flex items-center gap-3">
        {/* Search input */}
        <div className="flex items-center gap-2 bg-bg-inset border border-border rounded-full px-3.5 py-1.5 w-[200px] focus-within:border-brand-orange focus-within:bg-white transition-colors">
          <Search size={15} className="text-text-tertiary flex-shrink-0" />
          <input
            type="text"
            placeholder="Search..."
            className="bg-transparent text-sm text-text-primary outline-none w-full placeholder:text-text-quaternary"
          />
        </div>

        {/* Notifications */}
        <button className="relative w-[34px] h-[34px] flex items-center justify-center rounded-full hover:bg-bg-inset text-text-secondary hover:text-text-primary transition-all duration-150">
          <Bell size={18} strokeWidth={1.5} />
          <span className="absolute top-1.5 right-1.5 w-[7px] h-[7px] bg-brand-orange rounded-full border-[1.5px] border-white" />
        </button>

        {/* Inbox */}
        <Link
          href="/inbox"
          className="relative w-[34px] h-[34px] flex items-center justify-center rounded-full hover:bg-bg-inset text-text-secondary hover:text-text-primary transition-all duration-150"
        >
          <Inbox size={18} strokeWidth={1.5} />
        </Link>

        {/* New Project button */}
        <Link href="/projects/new" className="btn btn-primary">
          <Plus size={15} />
          New Project
        </Link>
      </div>
    </header>
  );
}
