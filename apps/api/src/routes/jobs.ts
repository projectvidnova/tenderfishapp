import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { db, jobs, projects, projectFacts, documents } from "@tenderfish/db";
import { eq, and } from "drizzle-orm";
import { processFile } from "../services/ai-pipeline";
import { ensureProjectBootstrap, syncLatestDraftSpd } from "../services/project-bootstrap";
import { refreshAndAutoCompleteGates } from "../services/gate-evaluator";
import {
  deleteIntakeDerivedFactsBatch,
  insertFactsFromProcessFileOutput,
} from "../services/process-file-facts";
import { tryPersistDocumentFileToStorage } from "../services/document-version-storage";
import { resolveDeclaredMimeType } from "../services/file-parser";

const INTAKE_STEPS = [
  { key: "upload", label: "Uploading files", status: "complete" },
  { key: "parsing", label: "Parsing documents", status: "pending" },
  { key: "extracting", label: "Extracting facts", status: "pending" },
  { key: "classifying", label: "Classifying project", status: "pending" },
  { key: "structuring", label: "Generating structure", status: "pending" },
  { key: "gates", label: "Checking gates", status: "pending" },
];

function titleFromSummary(summary: string): string {
  const normalized = summary
    .replace(/\s+/g, " ")
    .replace(/[^\w\s\-.,]/g, "")
    .trim();
  if (!normalized) return "";
  const sentence = normalized.split(/[.!?]/)[0]?.trim() || "";
  if (!sentence) return "";
  const cleaned = sentence
    .replace(/^(project overview|summary|project summary)\s*[:\-]\s*/i, "")
    .replace(/\b(the project (focuses|includes|covers)\b.*)$/i, "")
    .trim();
  return cleaned.slice(0, 80);
}

function buildGeneratedProjectName(params: {
  fallbackName?: string;
  clientName?: string;
  location?: string;
  summary?: string;
  fileNameHint?: string;
}): string {
  const fallback = (params.fallbackName || "Untitled Project").trim();
  const client = (params.clientName || "").trim();
  const location = (params.location || "").trim();
  const summaryTitle = titleFromSummary(params.summary || "");
  const fileNameHint = (params.fileNameHint || "")
    .replace(/\.[a-z0-9]+$/i, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  // Prefer evidence from uploaded docs over user-entered fallback values.
  if (summaryTitle) return summaryTitle;
  if (client && location) return `${client} - ${location} Project`;
  if (client) return `${client} Project`;
  if (location) return `${location} Project`;
  if (fileNameHint) return fileNameHint.slice(0, 80);
  return fallback;
}

export async function jobRoutes(app: FastifyInstance) {
  // POST /api/projects/intake — start AI intake pipeline
  app.post(
    "/projects/intake",
    async (request: FastifyRequest, reply: FastifyReply) => {
      if (!request.auth) {
        return reply.status(401).send({ error: "Unauthorized" });
      }

      if (!["architect_admin", "project_lead"].includes(request.auth.role)) {
        return reply.status(403).send({ error: "Forbidden" });
      }

      // Parse multipart form data
      const parts = request.parts();
      const fileBuffers: { name: string; mime: string; buffer: Buffer }[] = [];
      let formData: Record<string, string> = {};

      for await (const part of parts) {
        if (part.type === "file") {
          const chunks: Buffer[] = [];
          for await (const chunk of part.file) {
            chunks.push(chunk);
          }
          fileBuffers.push({
            name: part.filename || "unknown",
            mime: part.mimetype || "application/octet-stream",
            buffer: Buffer.concat(chunks),
          });
        } else {
          formData[part.fieldname] = (part as { value: string }).value;
        }
      }

      // Create a project shell
      const [project] = await db
        .insert(projects)
        .values({
          workspaceId: request.auth.workspaceId,
          name: formData.projectName || "New Project (Processing)",
          type: "not_sure",
          status: "active",
        })
        .returning();

      await ensureProjectBootstrap(project.id, request.auth.userId, {
        name: formData.projectName || "New Project (Processing)",
        type: "not_sure",
        objective: null,
        scopeSummary: null,
        currentLph: 1,
      });

      // Create the job
      const [job] = await db
        .insert(jobs)
        .values({
          workspaceId: request.auth.workspaceId,
          projectId: project.id,
          type: "project_intake",
          status: "processing",
          currentStep: "parsing",
          steps: INTAKE_STEPS.map((s) => ({ ...s })),
        })
        .returning();

      // Run the pipeline asynchronously
      runIntakePipeline(
        job.id,
        project.id,
        request.auth.workspaceId,
        request.auth.userId ?? "",
        fileBuffers,
        formData
      ).catch(
        (err) => {
          console.error("Intake pipeline failed:", err);
        }
      );

      return reply.status(202).send({
        data: {
          jobId: job.id,
          projectId: project.id,
        },
      });
    }
  );

  // GET /api/jobs/:jobId/status — poll job status
  app.get(
    "/jobs/:jobId/status",
    async (
      request: FastifyRequest<{ Params: { jobId: string } }>,
      reply: FastifyReply
    ) => {
      if (!request.auth) {
        return reply.status(401).send({ error: "Unauthorized" });
      }

      const job = await db.query.jobs.findFirst({
        where: and(
          eq(jobs.id, request.params.jobId),
          eq(jobs.workspaceId, request.auth.workspaceId)
        ),
      });

      if (!job) {
        return reply.status(404).send({ error: "Job not found" });
      }

      return {
        data: {
          id: job.id,
          type: job.type,
          status: job.status,
          currentStep: job.currentStep,
          steps: job.steps,
          projectId: job.projectId,
          result: job.status === "complete" ? job.result : undefined,
          error: job.status === "failed" ? job.error : undefined,
        },
      };
    }
  );

  // POST /api/projects/:id/facts/confirm — bulk confirm/update facts after review
  app.post(
    "/projects/:id/facts/confirm",
    async (
      request: FastifyRequest<{ Params: { id: string } }>,
      reply: FastifyReply
    ) => {
      if (!request.auth) {
        return reply.status(401).send({ error: "Unauthorized" });
      }

      const project = await db.query.projects.findFirst({
        where: and(
          eq(projects.id, request.params.id),
          eq(projects.workspaceId, request.auth.workspaceId)
        ),
      });

      if (!project) {
        return reply.status(404).send({ error: "Project not found" });
      }

      const body = request.body as {
        facts: { id: string; value: string | null; dataState: string }[];
        projectUpdates?: {
          name?: string;
          type?: string;
          location?: string;
          clientName?: string;
          targetCompletion?: string;
          objective?: string;
          scopeSummary?: string;
        };
      };

      // Update individual facts
      for (const fact of body.facts) {
        await db
          .update(projectFacts)
          .set({
            value: fact.value,
            dataState: fact.dataState as typeof projectFacts.dataState.enumValues[number],
          })
          .where(
            and(
              eq(projectFacts.id, fact.id),
              eq(projectFacts.projectId, project.id)
            )
          );
      }

      // Update project-level fields if provided
      if (body.projectUpdates) {
        const updates: Record<string, unknown> = {};
        if (body.projectUpdates.name) updates.name = body.projectUpdates.name;
        if (body.projectUpdates.type) updates.type = body.projectUpdates.type;
        if (body.projectUpdates.location)
          updates.location = body.projectUpdates.location;
        if (body.projectUpdates.clientName)
          updates.clientName = body.projectUpdates.clientName;
        if (body.projectUpdates.targetCompletion)
          updates.targetCompletion = body.projectUpdates.targetCompletion;
        if (body.projectUpdates.objective)
          updates.objective = body.projectUpdates.objective;
        if (body.projectUpdates.scopeSummary)
          updates.scopeSummary = body.projectUpdates.scopeSummary;

        if (Object.keys(updates).length > 0) {
          const [updatedProject] = await db
            .update(projects)
            .set(updates)
            .where(eq(projects.id, project.id))
            .returning();

          await syncLatestDraftSpd(project.id, {
            name: updatedProject.name,
            type: updatedProject.type,
            location: updatedProject.location,
            objective: updatedProject.objective,
            scopeSummary: updatedProject.scopeSummary,
            currentLph: 1,
          });
        }
      }

      await refreshAndAutoCompleteGates(project.id);

      return { data: { confirmed: true } };
    }
  );
}

// ─── Background Pipeline ──────────────────────────────────────

async function updateJobStep(
  jobId: string,
  stepKey: string,
  stepStatus: string,
  currentStep?: string
) {
  const job = await db.query.jobs.findFirst({ where: eq(jobs.id, jobId) });
  if (!job) return;

  const updatedSteps = (
    job.steps as { key: string; label: string; status: string }[]
  ).map((s) => (s.key === stepKey ? { ...s, status: stepStatus } : s));

  await db
    .update(jobs)
    .set({
      steps: updatedSteps,
      currentStep: currentStep || job.currentStep,
      updatedAt: new Date(),
    })
    .where(eq(jobs.id, jobId));
}

async function failJob(jobId: string, error: string) {
  await db
    .update(jobs)
    .set({ status: "failed", error, updatedAt: new Date() })
    .where(eq(jobs.id, jobId));
}

async function runIntakePipeline(
  jobId: string,
  projectId: string,
  workspaceId: string,
  uploadedByUserId: string,
  fileBuffers: { name: string; mime: string; buffer: Buffer }[],
  formData: Record<string, string>
) {
  try {
    if (fileBuffers.length === 0) {
      await failJob(jobId, "No files uploaded");
      return;
    }

    await updateJobStep(jobId, "parsing", "processing", "parsing");
    await updateJobStep(jobId, "parsing", "complete", "extracting");
    await updateJobStep(jobId, "extracting", "processing");

    const allMissingData = new Set<string>();
    const allProjectSummaries: string[] = [];
    const presentationSections: string[] = [];
    const insertedFactKeys = new Set<string>();
    const inferredProjectOverview: {
      clientName?: string;
      location?: string;
      objective?: string;
      currentHoaiPhase?: number;
      buildingPermitStatus?: string;
      commissionedPhases?: number[];
    } = {};

    const performanceMetrics: {
      document_id: string;
      file_name: string;
      extraction_ms: number;
      ai_processing_ms: number;
      total_tokens_used: number;
      ai_calls_count: number;
      model_used: string[];
    }[] = [];

    await deleteIntakeDerivedFactsBatch(projectId);

    for (const file of fileBuffers) {
      const resolvedMime = resolveDeclaredMimeType(file.name, file.mime);

      const [documentRecord] = await db
        .insert(documents)
        .values({
          projectId,
          name: file.name,
          type: resolvedMime,
          versions: [],
          sourceChannel: "intake_upload",
          confidence: 100,
        })
        .returning();

      const persisted = await tryPersistDocumentFileToStorage({
        workspaceId,
        projectId,
        documentId: documentRecord.id,
        fileName: file.name,
        buffer: file.buffer,
        contentType: resolvedMime,
        uploadedBy: uploadedByUserId || "system",
      });

      if (persisted) {
        await db
          .update(documents)
          .set({ versions: persisted, currentVersion: 1 })
          .where(eq(documents.id, documentRecord.id));
      }

      const processed = await processFile({
        project_id: projectId,
        document_id: documentRecord.id,
        file_name: file.name,
        mime_type: resolvedMime,
        buffer: file.buffer,
      });

      await insertFactsFromProcessFileOutput(
        projectId,
        documentRecord.id,
        processed,
        insertedFactKeys
      );

      if (processed.structured.project_summary.trim()) {
        allProjectSummaries.push(processed.structured.project_summary.trim());
        inferredProjectOverview.objective ||= processed.structured.project_summary.trim();
      }
      if (processed.presentation_text.trim()) {
        presentationSections.push(processed.presentation_text.trim());
      }
      for (const item of processed.structured.missing_data) {
        allMissingData.add(item);
      }

      performanceMetrics.push({
        document_id: documentRecord.id,
        file_name: file.name,
        ...processed.performance_metrics,
      });

      const overview = processed.structured.project_overview;
      if (overview.client_name && !inferredProjectOverview.clientName) {
        inferredProjectOverview.clientName = overview.client_name;
      }
      const loc = overview.location?.trim();
      if (loc && !inferredProjectOverview.location) {
        inferredProjectOverview.location = loc;
      }
      if (
        overview.building_permit_status &&
        !inferredProjectOverview.buildingPermitStatus
      ) {
        inferredProjectOverview.buildingPermitStatus = overview.building_permit_status;
      }
      if (
        overview.commissioned_phases.length > 0 &&
        !inferredProjectOverview.commissionedPhases
      ) {
        inferredProjectOverview.commissionedPhases = overview.commissioned_phases;
      }

      if (processed.structured.current_hoai_phase !== null) {
        inferredProjectOverview.currentHoaiPhase ||= processed.structured.current_hoai_phase;
      } else {
        allMissingData.add("current_hoai_phase");
      }
    }

    const gateChecks = await refreshAndAutoCompleteGates(projectId);

    await updateJobStep(jobId, "extracting", "complete", "classifying");
    await updateJobStep(jobId, "classifying", "complete", "structuring");
    await updateJobStep(jobId, "structuring", "complete", "gates");
    await updateJobStep(jobId, "gates", "complete");

    const generatedProjectName = buildGeneratedProjectName({
      fallbackName: formData.projectName || "Untitled Project",
      clientName: inferredProjectOverview.clientName,
      location:
        inferredProjectOverview.location ||
        formData.location ||
        formData.projectLocation ||
        "",
      summary: inferredProjectOverview.objective || allProjectSummaries[0] || "",
      fileNameHint: fileBuffers[0]?.name || "",
    });

    const resolvedLocation =
      inferredProjectOverview.location ||
      formData.location ||
      formData.projectLocation ||
      null;

    await db
      .update(projects)
      .set({
        name: generatedProjectName,
        objective: inferredProjectOverview.objective || undefined,
        clientName: inferredProjectOverview.clientName || undefined,
        location: resolvedLocation || undefined,
        lifecycleState: "parsed",
      })
      .where(eq(projects.id, projectId));

    await syncLatestDraftSpd(projectId, {
      name: generatedProjectName,
      type: "not_sure",
      location: resolvedLocation,
      objective: inferredProjectOverview.objective || allProjectSummaries[0] || null,
      scopeSummary: inferredProjectOverview.objective || allProjectSummaries[0] || null,
      currentLph: inferredProjectOverview.currentHoaiPhase || 1,
    });

    await db
      .update(jobs)
      .set({
        status: "complete",
        currentStep: undefined,
        result: {
          project_summary: allProjectSummaries[0] || "",
          gateChecks,
          missing_data: Array.from(allMissingData),
          presentation_text: presentationSections.join("\n\n---\n\n"),
          review_burden_metrics: {
            auto_captured_facts: insertedFactKeys.size,
            manual_entry_baseline: 25,
            burden_reduction_percent: Math.max(
              0,
              Math.round((1 - insertedFactKeys.size / 25) * 100)
            ),
          },
          performance_metrics: performanceMetrics,
        },
        updatedAt: new Date(),
      })
      .where(eq(jobs.id, jobId));

    console.info("v5_intake_performance", {
      project_id: projectId,
      extraction_ms: performanceMetrics.reduce((sum, item) => sum + item.extraction_ms, 0),
      ai_latency_ms: performanceMetrics.reduce((sum, item) => sum + item.ai_processing_ms, 0),
      files_processed: performanceMetrics.length,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown pipeline error";
    await failJob(jobId, message);
    throw err;
  }
}
