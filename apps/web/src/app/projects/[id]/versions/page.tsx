"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import AppShell from "@/components/layout/AppShell";
import { ProjectTopBar } from "@/components/project/ProjectTopBar";
import { History, Plus, Check } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { config } from "@/lib/config";

const API = config.apiUrl;

interface ProjectVersion {
  id: string;
  versionNumber: number;
  label: string;
  isCurrent: boolean;
  snapshotData: {
    project?: { name: string; lifecycleState: string | null };
    documentsCount?: number;
    costSnapshotsCount?: number;
    participantsCount?: number;
    snapshotAt?: string;
  };
  createdAt: string;
}

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("tf_token");
}

export default function VersionsPage() {
  const params = useParams();
  const projectId = params.id as string;
  const [versions, setVersions] = useState<ProjectVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [label, setLabel] = useState("");

  const fetchVersions = useCallback(async () => {
    const token = getToken();
    try {
      const res = await fetch(`${API}/api/projects/${projectId}/versions`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) {
        const json = await res.json();
        setVersions(json.data);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => { fetchVersions(); }, [fetchVersions]);

  async function createVersion() {
    if (!label.trim()) return;
    const token = getToken();
    try {
      await fetch(`${API}/api/projects/${projectId}/versions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ label }),
      });
      setLabel("");
      setShowCreate(false);
      fetchVersions();
    } catch {
      // ignore
    }
  }

  if (loading) {
    return (
      <AppShell>
        <div className="animate-pulse space-y-6">
          <div className="h-14 bg-bg-inset rounded" />
          <div className="h-64 bg-bg-inset rounded" />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <ProjectTopBar projectId={projectId} />

      <div className="space-y-6 mt-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-text-primary flex items-center gap-2">
              <History size={20} />
              Project Versions
            </h2>
            <p className="text-sm text-text-tertiary">{versions.length} snapshots</p>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-brand-orange bg-brand-orange/10 rounded-full hover:bg-brand-orange/20 transition-colors"
          >
            <Plus size={14} />
            Create Snapshot
          </button>
        </div>

        {versions.length === 0 ? (
          <div className="card p-12 text-center">
            <History size={48} className="mx-auto text-text-quaternary mb-4" />
            <h3 className="text-lg font-medium text-text-primary mb-2">No Snapshots Yet</h3>
            <p className="text-sm text-text-tertiary mb-6 max-w-md mx-auto">
              Create a project snapshot to save the current state. Useful for tracking progress at key milestones.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {versions.map((v) => (
              <div key={v.id} className="card p-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-8 h-8 rounded-full bg-brand-orange/10 flex items-center justify-center text-xs font-bold text-brand-orange">
                    v{v.versionNumber}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-text-primary">{v.label}</span>
                      {v.isCurrent && (
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-xs font-medium bg-status-emerald-bg text-status-emerald-fg rounded-sm">
                          <Check size={10} /> Current
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 text-xs text-text-quaternary">
                      <span>{new Date(v.createdAt).toLocaleString("de-DE")}</span>
                      {v.snapshotData.documentsCount != null && (
                        <span>{v.snapshotData.documentsCount} docs</span>
                      )}
                      {v.snapshotData.costSnapshotsCount != null && (
                        <span>{v.snapshotData.costSnapshotsCount} cost snapshots</span>
                      )}
                      {v.snapshotData.participantsCount != null && (
                        <span>{v.snapshotData.participantsCount} participants</span>
                      )}
                    </div>
                  </div>
                </div>
                {v.snapshotData.project?.lifecycleState && (
                  <span className="text-xs font-medium px-2 py-0.5 rounded-sm bg-bg-inset text-text-secondary capitalize">
                    {v.snapshotData.project.lifecycleState.replace(/_/g, " ")}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Create Version Snapshot">
        <div className="space-y-4">
          <div>
            <label className="label">Label *</label>
            <input
              className="input"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. Gate B Milestone"
            />
          </div>
          <p className="text-xs text-text-tertiary">
            This will capture the current state of the project including all documents, costs, and participants.
          </p>
          <div className="flex justify-end gap-3 pt-2">
            <button className="btn-secondary" onClick={() => setShowCreate(false)}>Cancel</button>
            <button className="btn-primary" onClick={createVersion} disabled={!label.trim()}>Create</button>
          </div>
        </div>
      </Modal>
    </AppShell>
  );
}
