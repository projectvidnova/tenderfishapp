"use client";

import { useRouter } from "next/navigation";
import { useCallback, useRef, useState } from "react";
import {
  Loader2,
  Sparkles,
  ShieldCheck,
  ArrowRight,
  FileText,
  Upload,
  X,
} from "lucide-react";
import AppShell from "@/components/layout/AppShell";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

const INTAKE_POLL_MS = 1500;
const INTAKE_WAIT_MAX_MS = 15 * 60 * 1000;

async function waitForIntakeJobComplete(jobId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const deadline = Date.now() + INTAKE_WAIT_MAX_MS;
  while (Date.now() < deadline) {
    const res = await fetch(`${API}/api/jobs/${jobId}/status`, { credentials: "include" });
    const json = (await res.json().catch(() => ({}))) as {
      data?: { status?: string; error?: string };
      error?: string;
    };
    if (!res.ok) {
      return {
        ok: false,
        error: typeof json.error === "string" ? json.error : "Could not check intake status.",
      };
    }
    const status = json.data?.status;
    if (status === "complete") return { ok: true };
    if (status === "failed") {
      return {
        ok: false,
        error:
          typeof json.data?.error === "string"
            ? json.data.error
            : "Document analysis failed.",
      };
    }
    await new Promise((r) => setTimeout(r, INTAKE_POLL_MS));
  }
  return {
    ok: false,
    error:
      "Analysis is still running. Open the project from the dashboard in a minute to see updated gates.",
  };
}

const DOCUMENT_ACCEPT = [
  ".pdf",
  ".doc",
  ".docx",
  ".msg",
  ".eml",
  ".txt",
  ".csv",
  ".xls",
  ".xlsx",
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-outlook",
  "message/rfc822",
  "text/plain",
  "text/csv",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "image/jpeg",
  "image/png",
  "image/webp",
].join(",");

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Single-file image upload (e.g. floor plan screenshot) → IONOS vision fast-path */
function isVisionPlanImageFile(f: File): boolean {
  const t = f.type.toLowerCase();
  if (t === "image/jpeg" || t === "image/png" || t === "image/webp") return true;
  const n = f.name.toLowerCase();
  return [".jpg", ".jpeg", ".png", ".webp"].some((ext) => n.endsWith(ext));
}

export default function NewProjectPage() {
  const router = useRouter();
  const documentsInputRef = useRef<HTMLInputElement>(null);

  const [isDraggingDocs, setIsDraggingDocs] = useState(false);
  const [intakeSubmitting, setIntakeSubmitting] = useState(false);
  const [intakeError, setIntakeError] = useState<string | null>(null);

  const [documentFiles, setDocumentFiles] = useState<File[]>([]);
  const [briefingText, setBriefingText] = useState("");
  const [projectNameHint, setProjectNameHint] = useState("");

  const submitDocumentIntake = useCallback(async () => {
    const hasFiles = documentFiles.length > 0;
    const hasBriefing = briefingText.trim().length > 0;
    if (!hasFiles && !hasBriefing) {
      setIntakeError(
        "Add at least one file, or paste a briefing (text is sent as a note for analysis)."
      );
      return;
    }

    setIntakeError(null);
    setIntakeSubmitting(true);

    try {
      const onlyPlanImage =
        documentFiles.length === 1 &&
        !briefingText.trim() &&
        isVisionPlanImageFile(documentFiles[0]);

      if (onlyPlanImage) {
        const form = new FormData();
        form.append("file", documentFiles[0], documentFiles[0].name);
        if (projectNameHint.trim()) {
          form.append("projectName", projectNameHint.trim());
        }

        const res = await fetch(`${API}/api/projects/create-from-image`, {
          method: "POST",
          credentials: "include",
          body: form,
        });

        const json = (await res.json().catch(() => ({}))) as {
          data?: { projectId?: string };
          error?: string;
          message?: string;
        };

        if (!res.ok) {
          setIntakeError(
            typeof json.error === "string"
              ? json.error
              : typeof json.message === "string"
                ? json.message
                : "Could not create project from image."
          );
          setIntakeSubmitting(false);
          return;
        }

        const projectId = json.data?.projectId;
        if (!projectId) {
          setIntakeError("Unexpected response from server.");
          setIntakeSubmitting(false);
          return;
        }

        router.push(`/projects/${projectId}/overview`);
        return;
      }

      const form = new FormData();
      for (const f of documentFiles) {
        form.append("files", f, f.name);
      }
      if (!hasFiles && hasBriefing) {
        form.append(
          "files",
          new File([briefingText.trim()], "pasted-briefing.txt", { type: "text/plain" }),
          "pasted-briefing.txt"
        );
      }
      form.append("projectName", projectNameHint.trim());
      form.append("pastedText", briefingText);
      if (projectNameHint.trim()) form.append("name", projectNameHint.trim());

      const res = await fetch(`${API}/api/projects/intake`, {
        method: "POST",
        credentials: "include",
        body: form,
      });

      const json = (await res.json().catch(() => ({}))) as {
        data?: { projectId?: string; jobId?: string };
        error?: string;
      };

      if (!res.ok) {
        setIntakeError(
          typeof json.error === "string" ? json.error : "Could not start document analysis."
        );
        setIntakeSubmitting(false);
        return;
      }

      const projectId = json.data?.projectId;
      const jobId = json.data?.jobId;
      if (!projectId) {
        setIntakeError("Unexpected response from server.");
        setIntakeSubmitting(false);
        return;
      }

      if (jobId) {
        const done = await waitForIntakeJobComplete(jobId);
        if (!done.ok) {
          setIntakeError(done.error);
          setIntakeSubmitting(false);
          return;
        }
      }

      router.push(`/projects/${projectId}/overview`);
    } catch {
      setIntakeError("Network error — check your connection or API server.");
      setIntakeSubmitting(false);
    }
  }, [documentFiles, briefingText, projectNameHint, router]);

  const onDocsDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingDocs(true);
  }, []);

  const onDocsDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingDocs(false);
  }, []);

  const onDocsDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDraggingDocs(false);
      if (intakeSubmitting) return;
      const dropped = Array.from(e.dataTransfer.files || []);
      if (dropped.length === 0) return;
      setDocumentFiles((prev) => [...prev, ...dropped]);
      setIntakeError(null);
    },
    [intakeSubmitting]
  );

  const onDocsFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target;
    const list = input.files;
    if (!list?.length) return;
    // Copy before clearing: `FileList` is live — resetting `value` empties it immediately.
    const picked = Array.from(list);
    input.value = "";
    setDocumentFiles((prev) => [...prev, ...picked]);
    setIntakeError(null);
  }, []);

  const removeDocFile = useCallback((index: number) => {
    setDocumentFiles((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const openDocsPicker = useCallback(() => {
    if (intakeSubmitting) return;
    documentsInputRef.current?.click();
  }, [intakeSubmitting]);

  const canSubmitIntake =
    documentFiles.length > 0 || briefingText.trim().length > 0;

  return (
    <AppShell>
      <div className="min-h-[calc(100vh-8rem)] flex flex-col lg:flex-row gap-8 lg:gap-12 max-w-6xl mx-auto px-4 py-6 lg:py-10">
        <section className="lg:w-[42%] flex flex-col justify-center space-y-6 lg:pr-4">
          <div className="inline-flex items-center gap-2 rounded-full bg-brand-orange/10 text-brand-orange px-3 py-1 text-xs font-semibold uppercase tracking-wide">
            <Sparkles className="w-3.5 h-3.5" aria-hidden />
            New project
          </div>
          <div>
            <h1 className="text-3xl sm:text-4xl font-semibold text-text-primary tracking-tight">
              Upload your project material
            </h1>
            <p className="mt-3 text-base text-text-secondary leading-relaxed">
              Add PDFs, Office files, emails, images, and more. Tenderfish runs the AI intake
              pipeline and prepares your workspace.
            </p>
          </div>

          <ul className="space-y-3 text-sm text-text-secondary">
            <li className="flex gap-3">
              <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-bg-inset text-brand-orange">
                <FileText className="w-4 h-4" aria-hidden />
              </span>
              <span>
                <span className="font-medium text-text-primary">Project documents</span> — PDF,
                DOCX, MSG, EML, TXT, XLSX, images, and other intake formats (multiple files).
              </span>
            </li>
            <li className="flex gap-3">
              <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-bg-inset text-gate-complete">
                <ShieldCheck className="w-4 h-4" aria-hidden />
              </span>
              <span>Same workspace auth · files stay under your project.</span>
            </li>
          </ul>
        </section>

        <section className="lg:flex-1 flex flex-col justify-start min-h-[320px]">
          <div className="rounded-2xl border border-border bg-white shadow-sm p-5 sm:p-6 space-y-4">
            <input
              ref={documentsInputRef}
              type="file"
              multiple
              accept={DOCUMENT_ACCEPT}
              className="sr-only"
              onChange={onDocsFileSelect}
              disabled={intakeSubmitting}
              aria-hidden
            />

            <div>
              <h2 className="text-base font-semibold text-text-primary">Project documents</h2>
              <p className="text-sm text-text-tertiary mt-1">
                PDF, DOCX, MSG, EML, TXT, XLSX, images — multiple files supported. Upload{" "}
                <span className="font-medium text-text-secondary">one image alone</span> (e.g. a
                floor plan or screenshot) to create the project immediately via vision extraction
                (IONOS multimodal API when configured).
              </p>
            </div>

            <button
              type="button"
              onClick={openDocsPicker}
              onDragOver={onDocsDragOver}
              onDragLeave={onDocsDragLeave}
              onDrop={onDocsDrop}
              disabled={intakeSubmitting}
              className={[
                "w-full rounded-xl border-2 border-dashed px-4 py-8 text-center transition-colors outline-none focus-visible:ring-2 focus-visible:ring-brand-orange focus-visible:ring-offset-2",
                intakeSubmitting ? "cursor-not-allowed opacity-60" : "cursor-pointer",
                isDraggingDocs
                  ? "border-brand-orange bg-brand-orange/5"
                  : "border-border bg-bg-inset/40 hover:border-brand-orange/50 hover:bg-bg-inset/60",
              ].join(" ")}
            >
              <Upload className="h-8 w-8 mx-auto text-text-quaternary mb-2" aria-hidden />
              <p className="text-sm font-medium text-text-primary">
                Drop files here or click to browse
              </p>
              <p className="text-xs text-text-quaternary mt-1">
                Same formats as the intake pipeline — not limited to images.
              </p>
            </button>

            {documentFiles.length > 0 && (
              <ul className="space-y-2">
                {documentFiles.map((file, i) => (
                  <li
                    key={`${file.name}-${i}-${file.size}`}
                    className="flex items-center justify-between gap-3 rounded-lg border border-border bg-bg-inset/50 px-3 py-2"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <FileText className="h-4 w-4 shrink-0 text-text-quaternary" aria-hidden />
                      <span className="text-sm text-text-primary truncate">{file.name}</span>
                      <span className="text-xs text-text-quaternary shrink-0">
                        {formatFileSize(file.size)}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeDocFile(i)}
                      disabled={intakeSubmitting}
                      className="p-1 rounded-md hover:bg-bg-inset text-text-quaternary hover:text-text-primary disabled:opacity-40"
                      aria-label={`Remove ${file.name}`}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <div>
              <label htmlFor="project-name-hint" className="label">
                Project name <span className="text-text-quaternary font-normal">(optional)</span>
              </label>
              <input
                id="project-name-hint"
                className="input"
                placeholder="e.g. Bürohaus Mitte"
                value={projectNameHint}
                onChange={(e) => setProjectNameHint(e.target.value)}
                disabled={intakeSubmitting}
              />
            </div>

            <div>
              <label htmlFor="briefing" className="label">
                Briefing / notes <span className="text-text-quaternary font-normal">(optional)</span>
              </label>
              <textarea
                id="briefing"
                className="input min-h-[100px] resize-y"
                placeholder="Paste email content, constraints, or context…"
                value={briefingText}
                onChange={(e) => setBriefingText(e.target.value)}
                disabled={intakeSubmitting}
              />
            </div>

            {intakeSubmitting && (
              <div className="flex items-center gap-2 text-sm text-text-secondary">
                <Loader2 className="h-4 w-4 animate-spin text-brand-orange shrink-0" aria-hidden />
                Analyzing documents and updating compliance gates…
              </div>
            )}

            {intakeError && (
              <div
                className="rounded-xl border border-status-danger/30 bg-status-danger/5 px-4 py-3 text-sm text-status-danger"
                role="alert"
              >
                {intakeError}
              </div>
            )}

            <button
              type="button"
              onClick={() => void submitDocumentIntake()}
              disabled={intakeSubmitting || !canSubmitIntake}
              className="btn-primary w-full justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {intakeSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  Starting…
                </>
              ) : (
                <>
                  Analyze documents & create project
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </>
              )}
            </button>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
