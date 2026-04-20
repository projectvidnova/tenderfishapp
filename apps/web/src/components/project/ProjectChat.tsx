"use client";

import { useState, useRef, useEffect } from "react";
import { MessageCircle, X, Send, Loader2 } from "lucide-react";
import { config } from "@/lib/config";

const API = config.apiUrl;

interface Message {
  role: "user" | "assistant";
  content: string;
}

export function ProjectChat({ projectId }: { projectId: string }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  async function send() {
    if (!input.trim() || loading) return;
    const userMsg: Message = { role: "user", content: input.trim() };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch(`${API}/api/projects/${projectId}/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ message: userMsg.content, history: messages }),
      });
      if (res.ok) {
        const json = await res.json();
        setMessages((prev) => [...prev, json.data]);
      } else {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: "Sorry, I couldn't process that request." },
        ]);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Connection error. Please try again." },
      ]);
    } finally {
      setLoading(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 w-12 h-12 rounded-full bg-brand-orange text-white shadow-lg flex items-center justify-center hover:bg-brand-orange-hover transition-colors z-50"
        title="Project Assistant"
      >
        <MessageCircle size={20} />
      </button>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 w-96 h-[500px] bg-white border border-border rounded-xl shadow-xl flex flex-col z-50">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-bg-inset rounded-t-xl">
        <div className="flex items-center gap-2">
          <MessageCircle size={16} className="text-brand-orange" />
          <span className="text-sm font-medium text-text-primary">Project Assistant</span>
        </div>
        <button onClick={() => setOpen(false)} className="text-text-quaternary hover:text-text-secondary">
          <X size={16} />
        </button>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && (
          <div className="text-center text-xs text-text-quaternary py-8">
            <p className="mb-2">Ask me about this project:</p>
            <div className="space-y-1">
              <button
                onClick={() => setInput("What's the current project status?")}
                className="block w-full text-left px-3 py-1.5 rounded bg-bg-bg-page hover:bg-bg-inset text-text-secondary transition-colors"
              >
                What&apos;s the current project status?
              </button>
              <button
                onClick={() => setInput("Which HOAI phase should I focus on next?")}
                className="block w-full text-left px-3 py-1.5 rounded bg-bg-bg-page hover:bg-bg-inset text-text-secondary transition-colors"
              >
                Which HOAI phase should I focus on next?
              </button>
              <button
                onClick={() => setInput("What documents am I missing for tender?")}
                className="block w-full text-left px-3 py-1.5 rounded bg-bg-bg-page hover:bg-bg-inset text-text-secondary transition-colors"
              >
                What documents am I missing for tender?
              </button>
            </div>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[80%] px-3 py-2 rounded-lg text-sm whitespace-pre-wrap ${
                m.role === "user"
                  ? "bg-brand-orange text-white"
                  : "bg-bg-inset text-text-primary"
              }`}
            >
              {m.content}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-bg-inset px-3 py-2 rounded-lg">
              <Loader2 size={14} className="animate-spin text-text-quaternary" />
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="border-t border-border p-3">
        <div className="flex gap-2">
          <input
            className="input flex-1 text-sm"
            placeholder="Ask about your project…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && send()}
            disabled={loading}
          />
          <button
            onClick={send}
            disabled={loading || !input.trim()}
            className="px-3 py-1.5 bg-brand-orange text-white rounded-full hover:bg-brand-orange-hover disabled:opacity-50 transition-colors"
          >
            <Send size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
