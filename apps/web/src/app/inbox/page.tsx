"use client";

import { useEffect, useState, useCallback } from "react";
import AppShell from "@/components/layout/AppShell";
import { Modal } from "@/components/ui/Modal";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

const STATUS_TABS = [
  { key: "all", label: "All" },
  { key: "unreviewed", label: "Unreviewed" },
  { key: "assigned", label: "Assigned" },
  { key: "archived", label: "Archived" },
];

const SIGNAL_LABELS: Record<string, string> = {
  offer_received: "Offer Received?",
  approval_indicated: "Approval Indicated?",
  award_indicated: "Award Indicated?",
  deadline_mentioned: "Deadline Mentioned?",
};

interface InboxMessage {
  id: string;
  fromEmail: string;
  subject: string;
  body: string;
  attachmentCount: number;
  projectId: string | null;
  projectName: string | null;
  status: string;
  aiSuggestions: {
    suggestedProjectId?: string;
    suggestedProjectName?: string;
    confidence?: number;
    documentType?: string;
    signals: string[];
  } | null;
  createdAt: string;
}

export default function InboxPage() {
  const [messages, setMessages] = useState<InboxMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<InboxMessage | null>(null);

  const fetchMessages = useCallback(async () => {
    const params = new URLSearchParams();
    if (tab !== "all") params.set("status", tab);
    if (search) params.set("search", search);
    const res = await fetch(`${API}/api/inbox?${params}`);
    const json = await res.json();
    setMessages(json.data || []);
    setLoading(false);
  }, [tab, search]);

  useEffect(() => { fetchMessages(); }, [fetchMessages]);

  async function updateMessage(msgId: string, updates: { status?: string; projectId?: string }) {
    await fetch(`${API}/api/inbox/${msgId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });
    fetchMessages();
    if (selected?.id === msgId) {
      setSelected((prev) => prev ? { ...prev, ...updates } : null);
    }
  }

  const unreviewed = messages.filter((m) => m.status === "unreviewed").length;

  if (loading) return <AppShell><div className="p-8 text-text-quaternary">Loading…</div></AppShell>;

  return (
    <AppShell>
      <div className="flex gap-0 h-[calc(100vh-80px)]">
        {/* Left: List panel */}
        <div className="w-[360px] flex-shrink-0 border-r border-border flex flex-col">
          {/* Header */}
          <div className="p-4 border-b border-border">
            <h1 className="text-lg font-semibold text-text-primary">
              Inbox {unreviewed > 0 && <span className="text-xs bg-brand-orange text-white rounded-full px-2 py-0.5 ml-1">{unreviewed}</span>}
            </h1>
          </div>

          {/* Tabs */}
          <div className="flex gap-0 border-b border-border">
            {STATUS_TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`flex-1 px-2 py-2 text-xs font-medium transition-colors ${tab === t.key ? "text-brand-orange border-b-2 border-brand-orange" : "text-text-quaternary hover:text-text-secondary"}`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="p-2">
            <input
              className="input w-full text-xs"
              placeholder="Search messages…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto">
            {messages.length === 0 ? (
              <p className="text-sm text-text-quaternary text-center py-8">No messages.</p>
            ) : (
              messages.map((m) => (
                <button
                  key={m.id}
                  onClick={() => setSelected(m)}
                  className={`w-full text-left px-4 py-3 border-b border-border/40 hover:bg-bg-inset/30 transition-colors ${selected?.id === m.id ? "bg-bg-inset/50" : ""}`}
                >
                  <div className="flex items-start justify-between">
                    <span className="text-xs font-medium text-text-primary truncate max-w-[200px]">{m.fromEmail}</span>
                    <span className="text-[10px] text-text-quaternary flex-shrink-0">{new Date(m.createdAt).toLocaleDateString()}</span>
                  </div>
                  <p className="text-xs text-text-secondary truncate mt-0.5">{m.subject}</p>
                  <div className="flex items-center gap-1.5 mt-1">
                    {m.attachmentCount > 0 && (
                      <span className="text-[10px] text-text-quaternary">📎{m.attachmentCount}</span>
                    )}
                    {m.projectName && (
                      <span className="text-[10px] bg-status-info-light text-status-info-fg px-1.5 py-0.5 rounded">{m.projectName}</span>
                    )}
                    {m.status === "unreviewed" && (
                      <span className="w-2 h-2 rounded-full bg-brand-orange flex-shrink-0" />
                    )}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Right: Detail panel */}
        <div className="flex-1 overflow-y-auto">
          {!selected ? (
            <div className="flex items-center justify-center h-full text-text-quaternary text-sm">
              Select a message to view details
            </div>
          ) : (
            <div className="p-6 space-y-4">
              {/* Header */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-text-primary">{selected.subject}</h2>
                  <div className="flex gap-1">
                    {selected.status !== "archived" && (
                      <button
                        onClick={() => updateMessage(selected.id, { status: "archived" })}
                        className="text-xs border border-border rounded px-2 py-1 hover:bg-bg-inset/50"
                      >
                        Archive
                      </button>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3 text-xs text-text-tertiary">
                  <span>From: {selected.fromEmail}</span>
                  <span>{new Date(selected.createdAt).toLocaleString()}</span>
                </div>
              </div>

              {/* Body */}
              <div className="card p-4">
                <pre className="text-sm text-text-secondary whitespace-pre-wrap font-sans">{selected.body}</pre>
              </div>

              {/* Attachments placeholder */}
              {selected.attachmentCount > 0 && (
                <div className="text-xs text-text-quaternary">
                  {selected.attachmentCount} attachment(s) — download/preview available when file storage is configured.
                </div>
              )}

              {/* AI Analysis */}
              {selected.aiSuggestions && (
                <div className="card p-4 space-y-3">
                  <h3 className="text-xs font-semibold text-text-tertiary uppercase tracking-wide">AI Analysis</h3>

                  {selected.aiSuggestions.suggestedProjectName && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-text-secondary">
                        Suggested match: <strong>{selected.aiSuggestions.suggestedProjectName}</strong>
                        {selected.aiSuggestions.confidence && (
                          <span className="text-text-quaternary ml-1">— {Math.round(selected.aiSuggestions.confidence * 100)}%</span>
                        )}
                      </span>
                      {selected.aiSuggestions.suggestedProjectId && !selected.projectId && (
                        <button
                          onClick={() => updateMessage(selected.id, { projectId: selected.aiSuggestions!.suggestedProjectId })}
                          className="btn-primary text-[10px] px-2 py-0.5"
                        >
                          Assign
                        </button>
                      )}
                    </div>
                  )}

                  {selected.aiSuggestions.documentType && (
                    <div className="text-xs text-text-secondary">
                      Document type: <span className="font-medium">{selected.aiSuggestions.documentType}</span>
                    </div>
                  )}

                  {selected.aiSuggestions.signals.length > 0 && (
                    <div className="flex gap-1 flex-wrap">
                      {selected.aiSuggestions.signals.map((s, i) => (
                        <span key={i} className="text-[10px] bg-status-warning-light text-status-warning-fg border border-status-warning-border rounded px-2 py-0.5">
                          {SIGNAL_LABELS[s] || s + "?"}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2 flex-wrap">
                {selected.status === "unreviewed" && (
                  <button
                    onClick={() => updateMessage(selected.id, { status: "assigned" })}
                    className="text-xs border border-border rounded px-3 py-1.5 hover:bg-bg-inset/50"
                  >
                    Mark Reviewed
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
