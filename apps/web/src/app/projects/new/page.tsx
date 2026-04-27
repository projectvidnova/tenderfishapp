"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Upload, FileText, ArrowRight, X, Check, Loader2 } from "lucide-react";
import AppShell from "@/components/layout/AppShell";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

interface UploadedFile {
  file: File;
  name: string;
  size: number;
  type: string;
}

interface JobStep {
  key: string;
  label: string;
  status: string;
}

interface ExtractedFact {
  id: string;
  fieldName: string;
  value: string | null;
  dataState: string;
  sourceRef: string | null;
}

function parseFactJson(value: string | null): Record<string, unknown> | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function formatFactValueForDisplay(fact: ExtractedFact): string {
  if (!fact.value) return "";
  const parsed = parseFactJson(fact.value);
  if (!parsed) return fact.value;

  if (fact.fieldName === "cost_item") {
    const description =
      typeof parsed.description === "string" ? parsed.description : "Cost item";
    const din =
      typeof parsed.din276_code === "string" ? `DIN ${parsed.din276_code}` : "DIN n/a";
    const quantity =
      typeof parsed.quantity === "number"
        ? `${parsed.quantity}${typeof parsed.unit === "string" && parsed.unit ? ` ${parsed.unit}` : ""}`
        : null;
    const amount =
      typeof parsed.amount === "number"
        ? new Intl.NumberFormat("de-DE", {
            style: "currency",
            currency: "EUR",
            maximumFractionDigits: 0,
          }).format(parsed.amount)
        : null;
    return [description, din, quantity, amount].filter(Boolean).join(" • ");
  }

  if (fact.fieldName === "overview_commissioned_phases") {
    const phases = Array.isArray(parsed.commissioned_phases)
      ? parsed.commissioned_phases
      : [];
    return phases.length > 0
      ? phases.map((phase) => `LPH ${String(phase)}`).join(", ")
      : "";
  }

  if (
    fact.fieldName === "overview_building_permit_status" &&
    typeof parsed.building_permit_status === "string"
  ) {
    return parsed.building_permit_status;
  }

  if (
    fact.fieldName === "accessibility_requirements" &&
    typeof parsed.accessibility_requirements === "string"
  ) {
    return parsed.accessibility_requirements;
  }

  if (typeof parsed.summary === "string") return parsed.summary;
  if (typeof parsed.value === "string") return parsed.value;
  const entries = Object.entries(parsed)
    .filter(([, value]) => value !== null && value !== undefined && value !== "")
    .map(([key, value]) => {
      const label = key.replace(/_/g, " ");
      if (Array.isArray(value)) {
        if (value.length === 0) return "";
        return `${label}: ${value.map((item) => String(item)).join(", ")}`;
      }
      if (typeof value === "object") {
        const nested = Object.entries(value as Record<string, unknown>)
          .filter(([, nestedValue]) => nestedValue !== null && nestedValue !== undefined && nestedValue !== "")
          .map(([nestedKey, nestedValue]) => `${nestedKey.replace(/_/g, " ")} ${String(nestedValue)}`)
          .join(", ");
        return nested ? `${label}: ${nested}` : "";
      }
      return `${label}: ${String(value)}`;
    })
    .filter(Boolean);

  return entries.length > 0 ? entries.join(" • ") : fact.value;
}

export default function NewProjectPage() {
  const [step, setStep] = useState(1);
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [briefingText, setBriefingText] = useState("");
  const [isDragOver, setIsDragOver] = useState(false);

  // Step 2 form state
  const [formData, setFormData] = useState({
    name: "",
    type: "",
    location: "",
    clientName: "",
    procurementModel: "",
    targetCompletion: "",
    constraints: "",
  });

  // Step 3: job tracking
  const [jobId, setJobId] = useState<string | null>(null);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [jobSteps, setJobSteps] = useState<JobStep[]>([]);
  const [jobError, setJobError] = useState<string | null>(null);

  // Step 4: facts from API
  const [facts, setFacts] = useState<ExtractedFact[]>([]);
  const [editedFacts, setEditedFacts] = useState<Record<string, string>>({});
  const [gateChecks, setGateChecks] = useState<
    { gate: string; pass: boolean; criteria: { key: string; label: string; met: boolean }[] }[]
  >([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const canProceedStep1 = files.length > 0 || briefingText.trim().length > 0;

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragOver(false);
    const dropped = Array.from(e.dataTransfer.files).map((f) => ({
      file: f,
      name: f.name,
      size: f.size,
      type: f.type,
    }));
    setFiles((prev) => [...prev, ...dropped]);
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    if (!e.target.files) return;
    const selected = Array.from(e.target.files).map((f) => ({
      file: f,
      name: f.name,
      size: f.size,
      type: f.type,
    }));
    setFiles((prev) => [...prev, ...selected]);
  }

  function removeFile(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }

  function formatFileSize(bytes: number): string {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  }

  // ─── Submit to AI Pipeline ───────────────────────────────────

  const startIntake = useCallback(async () => {
    setStep(3);
    setJobError(null);

    const form = new FormData();

    // Attach files
    for (const f of files) {
      form.append("files", f.file, f.name);
    }

    // Attach form context
    form.append("projectName", formData.name || "");
    form.append("pastedText", briefingText);
    Object.entries(formData).forEach(([k, v]) => {
      if (v) form.append(k, v);
    });

    try {
      const res = await fetch(`${API}/api/projects/intake`, {
        method: "POST",
        credentials: "include",
        body: form,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Failed to start analysis" }));
        setJobError(err.error || "Failed to start analysis");
        return;
      }

      const { data } = await res.json();
      setJobId(data.jobId);
      setProjectId(data.projectId);

      // Start polling
      pollRef.current = setInterval(() => pollJobStatus(data.jobId), 1500);
    } catch {
      setJobError("Network error — is the API server running?");
    }
  }, [files, formData, briefingText]);

  async function pollJobStatus(jId: string) {
    try {
      const res = await fetch(`${API}/api/jobs/${jId}/status`, {
        credentials: "include",
      });
      if (!res.ok) return;

      const { data } = await res.json();
      setJobSteps(data.steps || []);

      if (data.status === "complete") {
        if (pollRef.current) clearInterval(pollRef.current);
        setGateChecks(data.result?.gateChecks || []);
        // Load facts from API
        await loadProjectFacts(data.projectId);
        setStep(4);
      } else if (data.status === "failed") {
        if (pollRef.current) clearInterval(pollRef.current);
        setJobError(data.error || "Pipeline failed");
      }
    } catch {
      // Ignore transient network errors during polling
    }
  }

  async function loadProjectFacts(pId: string) {
    try {
      const res = await fetch(`${API}/api/projects/${pId}/facts`, {
        credentials: "include",
      });
      if (res.ok) {
        const { data } = await res.json();
        setFacts(data);
      }
    } catch {
      // Non-critical
    }
  }

  // Clean up polling on unmount
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  // ─── Confirm facts and finalize project ──────────────────────

  async function confirmAndCreate() {
    if (!projectId) return;
    setIsSubmitting(true);

    const factsPayload = facts.map((f) => ({
      id: f.id,
      value: editedFacts[f.id] !== undefined ? editedFacts[f.id] : f.value,
      dataState: editedFacts[f.id] !== undefined ? "CONFIRMED" : f.dataState,
    }));

    try {
      await fetch(`${API}/api/projects/${projectId}/facts/confirm`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ facts: factsPayload }),
      });

      window.location.href = `/projects/${projectId}/overview`;
    } catch {
      window.location.href = `/projects/${projectId}/overview`;
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AppShell>
      <div className="max-w-3xl mx-auto space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-semibold text-text-primary">New project</h1>
          <p className="text-sm text-text-tertiary mt-1">
            Start with whatever you have. Tenderfish will structure it.
          </p>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-2 text-sm">
          {[1, 2, 3, 4].map((s) => (
            <div key={s} className="flex items-center gap-2">
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium ${
                  s === step
                    ? "bg-brand-orange text-white"
                    : s < step
                    ? "bg-gate-complete text-white"
                    : "bg-bg-inset text-text-quaternary"
                }`}
              >
                {s}
              </div>
              {s < 4 && (
                <div
                  className={`w-8 h-px ${
                    s < step ? "bg-gate-complete" : "bg-bg-inset"
                  }`}
                />
              )}
            </div>
          ))}
        </div>

        {/* Step 1: Upload */}
        {step === 1 && (
          <div className="space-y-6">
            {/* Drop zone */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragOver(true);
              }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-xl p-12 text-center transition-colors ${
                isDragOver
                  ? "border-brand-orange bg-brand-orange/5"
                  : "border-border bg-white"
              }`}
            >
              <Upload
                size={40}
                className="mx-auto mb-3 text-text-quaternary"
              />
              <p className="text-sm font-medium text-text-secondary">
                Drop files here, or click to browse
              </p>
              <p className="text-xs text-text-quaternary mt-1">
                PDF · DOCX · MSG · EML · TXT · XLSX · JPG · PNG
              </p>
              <input
                type="file"
                multiple
                accept=".pdf,.docx,.msg,.eml,.txt,.xlsx,.jpg,.jpeg,.png"
                onChange={handleFileSelect}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                style={{ position: "relative" }}
              />
            </div>

            {/* File list */}
            {files.length > 0 && (
              <div className="space-y-2">
                {files.map((file, i) => (
                  <div
                    key={i}
                    className="card flex items-center justify-between px-4 py-3"
                  >
                    <div className="flex items-center gap-3">
                      <FileText size={18} className="text-text-quaternary" />
                      <div>
                        <p className="text-sm font-medium text-text-primary">
                          {file.name}
                        </p>
                        <p className="text-xs text-text-quaternary">
                          {formatFileSize(file.size)}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => removeFile(i)}
                      className="p-1 hover:bg-bg-inset rounded-sm transition-colors"
                    >
                      <X size={16} className="text-text-quaternary" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Text alternative */}
            <div>
              <p className="text-sm text-text-tertiary mb-2">
                Or paste a project briefing here
              </p>
              <textarea
                value={briefingText}
                onChange={(e) => setBriefingText(e.target.value)}
                placeholder="Paste any briefing text, email content, or project notes..."
                className="input min-h-[120px] resize-y"
              />
            </div>

            {/* Next */}
            <div className="flex justify-end">
              <button
                onClick={() => setStep(2)}
                disabled={!canProceedStep1}
                className="btn-primary flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Next
                <ArrowRight size={16} />
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Quick Form */}
        {step === 2 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-medium">
                Add context{" "}
                <span className="text-text-quaternary font-normal">
                  (optional but helpful)
                </span>
              </h2>
              <p className="text-sm text-text-tertiary mt-1">
                The more context you provide, the more accurate the initial
                structure.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Project name</label>
                <input
                  className="input"
                  placeholder="e.g. Bürohaus Mitte"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                />
              </div>
              <div>
                <label className="label">Project type</label>
                <select
                  className="input"
                  value={formData.type}
                  onChange={(e) =>
                    setFormData({ ...formData, type: e.target.value })
                  }
                >
                  <option value="">Select type...</option>
                  <option value="new_build">New Build</option>
                  <option value="refurbishment">Refurbishment</option>
                  <option value="conversion">Conversion</option>
                  <option value="interior_fit_out">Interior Fit-Out</option>
                  <option value="mixed_use">Mixed Use</option>
                  <option value="not_sure">Not sure</option>
                </select>
              </div>
              <div>
                <label className="label">City / Location</label>
                <input
                  className="input"
                  placeholder="e.g. Berlin"
                  value={formData.location}
                  onChange={(e) =>
                    setFormData({ ...formData, location: e.target.value })
                  }
                />
              </div>
              <div>
                <label className="label">Client name</label>
                <input
                  className="input"
                  value={formData.clientName}
                  onChange={(e) =>
                    setFormData({ ...formData, clientName: e.target.value })
                  }
                />
              </div>
              <div>
                <label className="label">Procurement model</label>
                <select
                  className="input"
                  value={formData.procurementModel}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      procurementModel: e.target.value,
                    })
                  }
                >
                  <option value="">Select model...</option>
                  <option value="general_contractor">General Contractor</option>
                  <option value="single_trades">Single Trades</option>
                  <option value="unclear">Unclear</option>
                </select>
              </div>
              <div>
                <label className="label">Target completion</label>
                <input
                  type="date"
                  className="input"
                  value={formData.targetCompletion}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      targetCompletion: e.target.value,
                    })
                  }
                />
              </div>
            </div>

            <div>
              <label className="label">Known constraints</label>
              <textarea
                className="input min-h-[80px] resize-y"
                placeholder="Any known planning restrictions, fixed deadlines, authority requirements..."
                value={formData.constraints}
                onChange={(e) =>
                  setFormData({ ...formData, constraints: e.target.value })
                }
              />
            </div>

            <div className="flex justify-between">
              <button
                onClick={() => setStep(1)}
                className="btn-secondary"
              >
                ← Back
              </button>
              <button
                onClick={startIntake}
                className="btn-primary flex items-center gap-2"
              >
                Analyse project
                <ArrowRight size={16} />
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Processing */}
        {step === 3 && (
          <div className="card p-12 text-center space-y-8">
            <div>
              <h2 className="text-lg font-medium mb-2">
                Analysing your project material...
              </h2>
              {jobError && (
                <p className="text-sm text-status-danger mt-2">{jobError}</p>
              )}
            </div>

            <div className="max-w-md mx-auto text-left space-y-3">
              {(jobSteps.length > 0
                ? jobSteps
                : [
                    { key: "upload", label: "Uploading files", status: "complete" },
                    { key: "parsing", label: "Parsing documents", status: "pending" },
                    { key: "extracting", label: "Extracting facts", status: "pending" },
                    { key: "classifying", label: "Classifying project", status: "pending" },
                    { key: "structuring", label: "Generating structure", status: "pending" },
                    { key: "gates", label: "Checking gates", status: "pending" },
                  ]
              ).map((s, i) => (
                <div key={i} className="flex items-center gap-3 text-sm">
                  <span className="w-5 text-center">
                    {s.status === "complete" ? (
                      <Check size={16} className="text-gate-complete" />
                    ) : s.status === "processing" ? (
                      <Loader2 size={16} className="text-brand-orange animate-spin" />
                    ) : (
                      <span className="text-text-quaternary">○</span>
                    )}
                  </span>
                  <span
                    className={
                      s.status === "complete"
                        ? "text-gate-complete"
                        : s.status === "processing"
                        ? "text-text-primary font-medium"
                        : "text-text-quaternary"
                    }
                  >
                    {s.label}
                  </span>
                </div>
              ))}
            </div>

            {jobError && (
              <button
                onClick={() => { setStep(2); setJobError(null); }}
                className="btn-secondary mt-4"
              >
                ← Go back and retry
              </button>
            )}
          </div>
        )}

        {/* Step 4: Review */}
        {step === 4 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-medium">Review what we found</h2>
              <p className="text-sm text-text-tertiary mt-1">
                Confirm, correct, or add to the extracted information before
                creating the project.
              </p>
            </div>

            <div className="grid grid-cols-[280px_1fr] gap-6">
              {/* Left: source files */}
              <div className="space-y-3">
                <h3 className="text-sm font-medium text-text-tertiary uppercase tracking-wide">
                  Source Files
                </h3>
                {files.length > 0 ? (
                  files.map((f, i) => (
                    <div key={i} className="card p-3 flex items-center gap-2">
                      <FileText size={16} className="text-text-quaternary" />
                      <span className="text-sm truncate">{f.name}</span>
                    </div>
                  ))
                ) : (
                  <div className="card p-3 text-sm text-text-quaternary">
                    Briefing text provided
                  </div>
                )}
              </div>

              {/* Right: extracted facts from AI */}
              <div className="card overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-bg-inset/50">
                      <th className="text-left px-4 py-3 font-medium text-text-tertiary text-xs uppercase tracking-wide">
                        Field
                      </th>
                      <th className="text-left px-4 py-3 font-medium text-text-tertiary text-xs uppercase tracking-wide">
                        Value
                      </th>
                      <th className="text-left px-4 py-3 font-medium text-text-tertiary text-xs uppercase tracking-wide">
                        State
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {facts.map((fact) => (
                      <tr key={fact.id} className="border-b border-border last:border-0">
                        <td className="px-4 py-3 text-text-secondary">
                          {fact.fieldName.replace(/_/g, " ")}
                        </td>
                        <td className="px-4 py-3">
                          <input
                            className="w-full bg-transparent text-text-primary font-medium border-b border-transparent hover:border-border focus:border-brand-orange focus:outline-none px-0 py-1"
                            value={
                              editedFacts[fact.id] !== undefined
                                ? editedFacts[fact.id]
                                : formatFactValueForDisplay(fact)
                            }
                            onChange={(e) =>
                              setEditedFacts({ ...editedFacts, [fact.id]: e.target.value })
                            }
                            placeholder="—"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <DataStateChip
                            state={editedFacts[fact.id] !== undefined ? "CONFIRMED" : fact.dataState}
                          />
                        </td>
                      </tr>
                    ))}
                    {facts.length === 0 && (
                      <tr>
                        <td colSpan={3} className="px-4 py-8 text-center text-text-quaternary">
                          No facts extracted yet
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Gate checks */}
            {gateChecks.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-sm font-medium text-text-tertiary uppercase tracking-wide">
                  Gate Eligibility
                </h3>
                <div className="flex gap-3 flex-wrap">
                  {gateChecks.map((gc) => (
                    <div
                      key={gc.gate}
                      className="card p-3 flex items-center gap-2 min-w-[140px]"
                    >
                      <div
                        className={`w-2 h-2 rounded-full ${
                          gc.pass ? "bg-gate-complete" : "bg-border"
                        }`}
                      />
                      <span className="text-sm font-medium">Gate {gc.gate}:</span>
                      <span
                        className={`text-sm font-medium ${
                          gc.pass ? "text-gate-complete" : "text-text-quaternary"
                        }`}
                      >
                        {gc.pass ? "PASS" : "LOCKED"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-between">
              <button
                onClick={() => setStep(2)}
                className="btn-secondary"
              >
                ← Back to edit
              </button>
              <button
                onClick={confirmAndCreate}
                disabled={isSubmitting}
                className="btn-primary flex items-center gap-2 disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Creating...
                  </>
                ) : (
                  "Create project"
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}

function DataStateChip({ state }: { state: string }) {
  const styles: Record<string, string> = {
    CONFIRMED: "bg-state-confirmed-bg text-state-confirmed-text border-state-confirmed-text",
    DERIVED: "bg-state-derived-bg text-state-derived-text border-state-derived-text",
    UNCLEAR: "bg-state-unclear-bg text-state-unclear-text border-state-unclear-text",
    MISSING: "bg-state-missing-bg text-state-missing-text border-state-missing-text",
  };

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 text-xs font-mono font-medium rounded-sm border ${
        styles[state] || styles.MISSING
      }`}
    >
      {state}
    </span>
  );
}
