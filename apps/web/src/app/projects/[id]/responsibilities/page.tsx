"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import AppShell from "@/components/layout/AppShell";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

type RaciRow = {
  id: string;
  name: string;
  type: string;
  phaseLph: number | null;
  status: string;
  raciResponsible: string | null;
  raciAccountable: string | null;
  raciConsulted: string[];
  raciInformed: string[];
};

const ROLE_GROUPS = [
  { key: "client", label: "Client Team", roles: ["Client", "Client Rep"] },
  { key: "architect", label: "Architect Team", roles: ["Lead Architect", "Project Lead", "Team Member"] },
  { key: "consultant", label: "Consultants", roles: ["Structural", "MEP", "Fire Safety", "Landscape"] },
  { key: "contractor", label: "Contractors", roles: ["General Contractor", "Trade Contractor"] },
] as const;

const ALL_ROLES = ROLE_GROUPS.flatMap((g) => g.roles);

const RACI_VALUES = ["R", "A", "C", "I", "—"] as const;
type RaciValue = typeof RACI_VALUES[number];

const RACI_COLORS: Record<RaciValue, string> = {
  R: "bg-status-success-bg text-status-success-fg font-semibold",
  A: "bg-status-info-bg text-status-info-fg font-semibold",
  C: "bg-status-warning-bg text-status-warning-fg",
  I: "bg-bg-inset text-text-tertiary",
  "—": "text-text-quaternary",
};

function getRaciForRole(row: RaciRow, role: string): RaciValue {
  if (row.raciResponsible === role) return "R";
  if (row.raciAccountable === role) return "A";
  if (row.raciConsulted?.includes(role)) return "C";
  if (row.raciInformed?.includes(role)) return "I";
  return "—";
}

function buildUpdatedRaci(row: RaciRow, role: string, value: RaciValue) {
  const updates: Record<string, unknown> = {};

  // Remove role from all current positions
  if (row.raciResponsible === role) updates.raciResponsible = null;
  if (row.raciAccountable === role) updates.raciAccountable = null;
  if (row.raciConsulted?.includes(role)) updates.raciConsulted = row.raciConsulted.filter((r) => r !== role);
  if (row.raciInformed?.includes(role)) updates.raciInformed = row.raciInformed.filter((r) => r !== role);

  // Set new position
  if (value === "R") updates.raciResponsible = role;
  else if (value === "A") updates.raciAccountable = role;
  else if (value === "C") updates.raciConsulted = [...(row.raciConsulted || []).filter((r) => r !== role), role];
  else if (value === "I") updates.raciInformed = [...(row.raciInformed || []).filter((r) => r !== role), role];

  return updates;
}

export default function ResponsibilitiesPage() {
  const { id } = useParams() as { id: string };
  const [rows, setRows] = useState<RaciRow[]>([]);
  const [unassignedCount, setUnassignedCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [lphFilter, setLphFilter] = useState("all");
  const [showUnassigned, setShowUnassigned] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (lphFilter !== "all") params.set("lph", lphFilter);
      if (showUnassigned) params.set("unassigned", "true");
      const res = await fetch(`${API}/api/projects/${id}/responsibilities?${params}`);
      if (res.ok) {
        const json = await res.json();
        setRows(json.data.rows);
        setUnassignedCount(json.data.unassignedCount);
      }
    } catch { /* ignore */ }
    setLoading(false);
  }, [id, lphFilter, showUnassigned]);

  useEffect(() => { fetchData(); }, [fetchData]);

  async function updateRaci(row: RaciRow, role: string, value: RaciValue) {
    const updates = buildUpdatedRaci(row, role, value);
    // Optimistic update
    setRows((prev) => prev.map((r) =>
      r.id === row.id ? { ...r, ...updates } as RaciRow : r
    ));

    await fetch(`${API}/api/projects/${id}/tasks/${row.id}/raci`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });
  }

  function exportCsv() {
    const headers = ["Task", "Type", "LPH", "Status", ...ALL_ROLES];
    const csvRows = [headers.join(",")];
    rows.forEach((row) => {
      const values = [
        `"${row.name}"`,
        row.type,
        row.phaseLph || "",
        row.status,
        ...ALL_ROLES.map((role) => getRaciForRole(row, role)),
      ];
      csvRows.push(values.join(","));
    });
    const blob = new Blob([csvRows.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "responsibility-matrix.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  if (loading) {
    return (
      <AppShell>
        <div className="flex items-center justify-center h-64 text-text-quaternary text-sm">Loading responsibilities…</div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-semibold text-text-primary">Responsibility Matrix</h1>
          <p className="text-sm text-text-tertiary mt-1">Auto-generated from project structure. Update assignments as the project develops.</p>
        </div>

        {/* Unassigned warning */}
        {unassignedCount > 0 && (
          <div className="bg-status-danger-light border border-status-danger-border rounded-xl px-4 py-3 text-sm text-status-danger-fg">
            {unassignedCount} task{unassignedCount !== 1 ? "s have" : " has"} no responsible owner assigned.
          </div>
        )}

        {/* Filter bar */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <select
              className="input w-auto text-xs"
              value={lphFilter}
              onChange={(e) => setLphFilter(e.target.value)}
            >
              <option value="all">All Phases</option>
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
                <option key={n} value={n}>LPH {n}</option>
              ))}
            </select>
            <label className="flex items-center gap-2 text-xs text-text-tertiary">
              <input
                type="checkbox"
                checked={showUnassigned}
                onChange={(e) => setShowUnassigned(e.target.checked)}
                className="accent-bronze"
              />
              Unassigned only
            </label>
          </div>
          <button className="btn-secondary text-xs" onClick={exportCsv}>Export as CSV</button>
        </div>

        {/* RACI Matrix Table */}
        <div className="card overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left px-3 py-2 font-medium text-text-tertiary uppercase tracking-wide sticky left-0 bg-white z-10 min-w-[200px]">Task</th>
                <th className="px-2 py-2 font-medium text-text-tertiary uppercase tracking-wide w-12">LPH</th>
                {ROLE_GROUPS.map((group) => (
                  <th
                    key={group.key}
                    colSpan={group.roles.length}
                    className="text-center px-1 py-1 font-medium text-text-tertiary uppercase tracking-wider border-l border-border bg-bg-inset/30"
                  >
                    {group.label}
                  </th>
                ))}
              </tr>
              <tr className="border-b border-border bg-bg-inset/20">
                <th className="sticky left-0 bg-bg-inset/20 z-10" />
                <th />
                {ROLE_GROUPS.map((group) =>
                  group.roles.map((role, i) => (
                    <th
                      key={role}
                      className={`text-center px-1 py-1.5 font-normal text-text-quaternary text-[10px] ${i === 0 ? "border-l border-border" : ""}`}
                    >
                      {role}
                    </th>
                  ))
                )}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={2 + ALL_ROLES.length} className="px-4 py-8 text-center text-text-quaternary text-sm">
                    No tasks found. Add work packages in the Phases view.
                  </td>
                </tr>
              ) : rows.map((row) => {
                const hasNoR = !row.raciResponsible;
                return (
                  <tr
                    key={row.id}
                    className={`border-b border-border/50 hover:bg-bg-inset/20 ${hasNoR ? "bg-status-danger-light/30" : ""}`}
                  >
                    <td className="px-3 py-2 font-medium text-text-primary sticky left-0 bg-white z-10">
                      <div className="flex items-center gap-2">
                        <span>{row.name}</span>
                        {hasNoR && <span className="text-status-danger text-[10px]">⚠ No R</span>}
                      </div>
                    </td>
                    <td className="text-center font-mono text-text-quaternary">{row.phaseLph || "—"}</td>
                    {ROLE_GROUPS.map((group) =>
                      group.roles.map((role, i) => {
                        const val = getRaciForRole(row, role);
                        return (
                          <td
                            key={role}
                            className={`text-center px-0 py-1 ${i === 0 ? "border-l border-border" : ""} ${
                              hasNoR && val === "—" ? "bg-status-danger-light/20" : ""
                            }`}
                          >
                            <select
                              value={val}
                              onChange={(e) => updateRaci(row, role, e.target.value as RaciValue)}
                              className={`w-10 text-center text-[10px] border-0 bg-transparent cursor-pointer p-0.5 rounded-sm ${RACI_COLORS[val]}`}
                            >
                              {RACI_VALUES.map((v) => (
                                <option key={v} value={v}>{v}</option>
                              ))}
                            </select>
                          </td>
                        );
                      })
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </AppShell>
  );
}
