"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, FolderKanban } from "lucide-react";
import AppShell from "@/components/layout/AppShell";
import { config } from "@/lib/config";

interface Project {
  id: string;
  name: string;
  type: string;
  status: string;
  healthScore: string;
  lifecycleState: string;
  targetCompletion: string | null;
  createdAt: string;
}

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${config.apiUrl}/api/projects`, { credentials: "include" })
      .then((r) => r.json())
      .then((res) => setProjects(res.data ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <AppShell>
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-text-primary">Projects</h1>
          <p className="text-sm text-text-tertiary mt-1">All workspace projects.</p>
        </div>
        <Link href="/projects/new" className="btn-primary">
          <Plus size={16} />
          New Project
        </Link>
      </div>

      {loading ? (
        <div className="card p-12 flex items-center justify-center">
          <svg className="animate-spin h-6 w-6 text-brand-orange" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 100 16v-4l-3 3 3 3v-4a8 8 0 01-8-8z" />
          </svg>
        </div>
      ) : projects.length === 0 ? (
        <div className="card p-12 flex flex-col items-center justify-center text-center">
          <FolderKanban size={48} className="text-text-tertiary mb-4" />
          <h3 className="text-lg font-semibold text-text-primary mb-2">No projects yet</h3>
          <p className="text-sm text-text-secondary mb-6 max-w-md">
            Start with whatever you have — an email, a PDF, or a briefing.
            Tenderfish will structure it using AI.
          </p>
          <Link href="/projects/new" className="btn-primary">
            <Plus size={16} />
            Create your first project
          </Link>
        </div>
      ) : (
        <div className="grid gap-4">
          {projects.map((p) => (
            <Link
              key={p.id}
              href={`/projects/${p.id}`}
              className="card p-5 flex items-center justify-between"
            >
              <div className="flex items-center gap-4">
                <div className="p-2.5 bg-brand-orange-light rounded-xl">
                  <FolderKanban size={20} className="text-brand-orange" />
                </div>
                <div>
                  <p className="font-semibold text-text-primary">{p.name}</p>
                  <p className="text-sm text-text-secondary capitalize">
                    {p.type.replace(/_/g, " ")} · {p.status}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span
                  className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                    p.healthScore === "green"
                      ? "bg-status-success-light text-status-success"
                      : p.healthScore === "amber"
                      ? "bg-status-warning-light text-status-warning"
                      : "bg-status-danger-light text-status-danger"
                  }`}
                >
                  {p.healthScore}
                </span>
                {p.targetCompletion && (
                  <span className="text-sm text-text-tertiary">{p.targetCompletion}</span>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
    </AppShell>
  );
}
