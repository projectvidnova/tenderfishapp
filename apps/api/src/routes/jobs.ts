import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { db, jobs, projects, projectFacts, phases, gates, documents } from "@tenderfish/db";
import { eq, and } from "drizzle-orm";
import { LPH_PHASES, GATE_DEFINITIONS } from "@tenderfish/shared";
import type { GateLetter, LphNumber } from "@tenderfish/shared";
import { parseAllFiles } from "../services/file-parser";
import {
  extractFacts,
  classifyProject,
  checkGateEligibility,
  generateProjectStructure,
  extractTextFromImage,
} from "../services/ai-pipeline";

const INTAKE_STEPS = [
  { key: "upload", label: "Uploading files", status: "complete" },
  { key: "parsing", label: "Parsing documents", status: "pending" },
  { key: "extracting", label: "Extracting facts", status: "pending" },
  { key: "classifying", label: "Classifying project", status: "pending" },
  { key: "structuring", label: "Generating structure", status: "pending" },
  { key: "gates", label: "Checking gates", status: "pending" },
];

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
      runIntakePipeline(job.id, project.id, fileBuffers, formData).catch(
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
          await db
            .update(projects)
            .set(updates)
            .where(eq(projects.id, project.id));
        }
      }

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
  fileBuffers: { name: string; mime: string; buffer: Buffer }[],
  formData: Record<string, string>
) {
  try {
    // Step 1: Parse files
    await updateJobStep(jobId, "parsing", "processing", "parsing");

    const parsedFiles = fileBuffers.map((f) => ({
      fileName: f.name,
      mimeType: f.mime,
      buffer: f.buffer,
    }));
    const { combinedText: documentText, imageBuffers } = await parseAllFiles(parsedFiles);

    // Handle images with Claude Vision
    let fullText = documentText;
    for (const img of imageBuffers) {
      const imageText = await extractTextFromImage(img.buffer, img.fileName);
      if (imageText) {
        fullText += `\n\n--- Image: ${img.fileName} ---\n${imageText}`;
      }
    }

    // Add pasted text if present
    if (formData.pastedText?.trim()) {
      fullText += `\n\n--- Pasted Text ---\n${formData.pastedText}`;
    }

    await updateJobStep(jobId, "parsing", "complete", "extracting");

    if (!fullText.trim()) {
      await failJob(jobId, "No text content could be extracted from the uploaded files");
      return;
    }

    // Step 2: Extract facts
    await updateJobStep(jobId, "extracting", "processing");
    const factResult = await extractFacts(fullText, formData);
    await updateJobStep(jobId, "extracting", "complete", "classifying");

    // Step 3: Classify project
    await updateJobStep(jobId, "classifying", "processing");
    const classification = await classifyProject(fullText, factResult.facts);
    await updateJobStep(jobId, "classifying", "complete", "structuring");

    // Step 4: Generate project structure
    await updateJobStep(jobId, "structuring", "processing");
    const structure = await generateProjectStructure(
      fullText,
      factResult.facts,
      classification
    );
    await updateJobStep(jobId, "structuring", "complete", "gates");

    // Step 5: Gate check (deterministic)
    await updateJobStep(jobId, "gates", "processing");
    const gateChecks = checkGateEligibility(factResult.facts);
    await updateJobStep(jobId, "gates", "complete");

    // ─── Persist to database ─────────────────────────────────

    // Update project with classification info
    await db
      .update(projects)
      .set({
        name: factResult.facts.find((f) => f.field === "project_name")?.value || formData.projectName || "Untitled Project",
        type: classification.type as typeof projects.type.enumValues[number],
        procurementModel: classification.delivery_model as typeof projects.procurementModel.enumValues[number],
        location: factResult.facts.find((f) => f.field === "location")?.value || undefined,
        clientName: factResult.facts.find((f) => f.field === "client_name")?.value || undefined,
        clientRepresentative: factResult.facts.find((f) => f.field === "client_representative")?.value || undefined,
        objective: factResult.facts.find((f) => f.field === "scope_description")?.value || undefined,
        targetCompletion: factResult.facts.find((f) => f.field === "target_completion")?.value || undefined,
      })
      .where(eq(projects.id, projectId));

    // Insert extracted facts
    for (const fact of factResult.facts) {
      await db.insert(projectFacts).values({
        projectId,
        fieldName: fact.field,
        value: fact.value,
        dataState: fact.data_state as typeof projectFacts.dataState.enumValues[number],
        sourceRef: fact.source_quote,
      });
    }

    // Insert LPH phases from AI structure
    for (const lph of structure.lph_roadmap) {
      await db.insert(phases).values({
        projectId,
        lph: lph.lph,
        status: lph.lph <= classification.lph_current ? "active" : "not_started",
        startDate: lph.estimated_start || undefined,
        endDate: lph.estimated_end || undefined,
        objective: `${lph.name}: ${lph.work_packages.join(", ")}`,
      });
    }

    // Insert gates with criteria from AI analysis
    for (const gc of gateChecks) {
      await db.insert(gates).values({
        projectId,
        gate: gc.gate as typeof gates.gate.enumValues[number],
        status: gc.pass ? "complete" : "locked",
        criteria: gc.criteria.map((c) => ({
          key: c.key,
          label: c.label,
          met: c.met,
          autoCheck: true,
        })),
      });
    }

    // Complete the job with full result data
    await db
      .update(jobs)
      .set({
        status: "complete",
        currentStep: undefined,
        result: {
          classification,
          gateChecks,
          structure: {
            responsibilityStructure: structure.responsibility_structure,
            approvalStructure: structure.approval_structure,
            consultantRequirements: structure.consultant_requirements,
            riskRegister: structure.risk_register,
            missingInformation: structure.missing_information,
          },
          factCount: factResult.facts.length,
          phaseCount: structure.lph_roadmap.length,
        },
        updatedAt: new Date(),
      })
      .where(eq(jobs.id, jobId));
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown pipeline error";
    await failJob(jobId, message);
    throw err;
  }
}
