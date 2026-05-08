"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Inbox, Plus, Search, Bell, CheckCheck } from "lucide-react";
import { useState, useEffect, useCallback, useRef } from "react";
import { config } from "@/lib/config";
import { formatDateTime } from "@/lib/formatters";

interface Notification {
  id: string;
  type: string;
  title: string;
  body: string | null;
  projectId: string | null;
  read: boolean;
  createdAt: string;
}

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

  const [notifOpen, setNotifOpen] = useState(false);
  const [notifs, setNotifs] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const panelRef = useRef<HTMLDivElement>(null);

  const fetchNotifs = useCallback(async () => {
    try {
      const res = await fetch(`${config.apiUrl}/api/notifications`, { credentials: "include" });
      if (!res.ok) return;
      const json = await res.json();
      setNotifs(json.data ?? []);
      setUnreadCount(json.unreadCount ?? 0);
    } catch {}
  }, []);

  useEffect(() => {
    fetchNotifs();
    const id = setInterval(fetchNotifs, 30_000);
    return () => clearInterval(id);
  }, [fetchNotifs]);

  useEffect(() => {
    if (!notifOpen) return;
    function onClickOutside(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [notifOpen]);

  async function markRead(notifId: string) {
    await fetch(`${config.apiUrl}/api/notifications/${notifId}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ read: true }),
    });
    setNotifs((prev) => prev.map((n) => (n.id === notifId ? { ...n, read: true } : n)));
    setUnreadCount((prev) => Math.max(0, prev - 1));
  }

  async function markAllRead() {
    await fetch(`${config.apiUrl}/api/notifications/mark-all-read`, {
      method: "POST",
      credentials: "include",
    });
    setNotifs((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);
  }

  return (
    <header
      className="fixed top-0 left-72 right-0 h-topbar border-b border-border flex items-center justify-between px-6 z-20"
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
        <div className="relative" ref={panelRef}>
          <button
            onClick={() => setNotifOpen((o) => !o)}
            className="relative w-[34px] h-[34px] flex items-center justify-center rounded-full hover:bg-bg-inset text-text-secondary hover:text-text-primary transition-all duration-150"
          >
            <Bell size={18} strokeWidth={1.5} />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 min-w-[14px] h-[14px] bg-brand-orange text-white text-[9px] font-bold rounded-full flex items-center justify-center px-0.5 border border-white">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </button>

          {notifOpen && (
            <div className="absolute right-0 top-full mt-2 w-[340px] rounded-2xl border border-border bg-white shadow-lg overflow-hidden z-50">
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                <span className="text-sm font-semibold text-text-primary">Notifications</span>
                {unreadCount > 0 && (
                  <button
                    onClick={markAllRead}
                    className="flex items-center gap-1 text-xs text-brand-orange hover:text-brand-orange/80 transition-colors"
                  >
                    <CheckCheck size={13} />
                    Mark all read
                  </button>
                )}
              </div>

              {/* List */}
              <div className="max-h-[360px] overflow-y-auto divide-y divide-border/50">
                {notifs.length === 0 ? (
                  <div className="px-4 py-8 text-center text-sm text-text-tertiary">
                    No notifications yet.
                  </div>
                ) : (
                  notifs.map((n) => (
                    <button
                      key={n.id}
                      onClick={() => !n.read && markRead(n.id)}
                      className={`w-full text-left px-4 py-3 hover:bg-bg-inset/40 transition-colors flex items-start gap-3 ${n.read ? "opacity-60" : ""}`}
                    >
                      <span className={`mt-1.5 w-2 h-2 rounded-full flex-shrink-0 ${n.read ? "bg-transparent" : "bg-brand-orange"}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-text-primary leading-snug">{n.title}</p>
                        {n.body && <p className="text-xs text-text-tertiary mt-0.5 truncate">{n.body}</p>}
                        <p className="text-[10px] text-text-quaternary mt-1">
                          {formatDateTime(n.createdAt)}
                        </p>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

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
