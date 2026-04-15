"use client";

import Link from "next/link";
import { Inbox, Plus, User } from "lucide-react";

export function TopBar() {
  return (
    <header className="fixed top-0 left-sidebar right-0 h-topbar bg-white border-b border-topbar-border flex items-center justify-between px-6 z-20">
      {/* Left: workspace name */}
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium text-ink">My Workspace</span>
      </div>

      {/* Right: actions */}
      <div className="flex items-center gap-3">
        {/* New Project button */}
        <Link
          href="/projects/new"
          className="btn-primary flex items-center gap-2 text-sm"
        >
          <Plus size={16} />
          New Project
        </Link>

        {/* Inbox */}
        <Link
          href="/inbox"
          className="relative p-2 rounded-sm hover:bg-warm transition-colors"
        >
          <Inbox size={20} strokeWidth={1.5} className="text-gray-600" />
          {/* Badge - shown when there are unread messages */}
          <span className="absolute top-1 right-1 w-2 h-2 bg-health-red rounded-full" />
        </Link>

        {/* User avatar */}
        <button className="w-8 h-8 rounded-full bg-warm flex items-center justify-center hover:bg-topbar-border transition-colors">
          <User size={16} className="text-gray-600" />
        </button>
      </div>
    </header>
  );
}
