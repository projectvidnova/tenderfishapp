import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { db, jobs, projects, projectFacts, documents, gates } from "@tenderfish/db";
import { eq, and, inArray, asc } from "drizzle-orm";
import { processFile } from "../services/ai-pipeline";
import { ensureProjectBootstrap, syncLatestDraftSpd } from "../services/project-bootstrap";

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
      objective?: string;
      currentHoaiPhase?: number;
      buildingPermitStatus?: string;
      commissionedPhases?: number[];
    } = {};

    const buildGeneratedProjectName = (params: {
      fallbackName?: string;
      clientName?: string;
      location?: string;
      summary?: string;
    }): string => {
      const fallback = (params.fallbackName || "Untitled Project").trim();
      const client = (params.clientName || "").trim();
      const location = (params.location || "").trim();
      const summary = (params.summary || "")
        .replace(/\s+/g, " ")
        .replace(/[^\w\s\-.,]/g, "")
        .trim();

      const summaryTitle = summary
        ? summary
            .split(/[.!?]/)[0]
            .trim()
            .slice(0, 80)
        : "";

      if (client && location) return `${client} - ${location} Project`;
      if (client && summaryTitle) return `${client} - ${summaryTitle}`;
      if (location && summaryTitle) return `${location} - ${summaryTitle}`;
      if (summaryTitle) return summaryTitle;
      if (client) return `${client} Project`;
      if (location) return `${location} Project`;
      return fallback;
    };
    const performanceMetrics: {
      document_id: string;
      file_name: string;
      extraction_ms: number;
      ai_processing_ms: number;
      total_tokens_used: number;
      ai_calls_count: number;
      model_used: string[];
    }[] = [];

    const createTraceableValue = (
      payload: Record<string, unknown>,
      documentId: string
    ): string =>
      JSON.stringify({
        ...payload,
        truth_state: "inferred",
        source_document_id: documentId,
      });

    await db
      .delete(projectFacts)
      .where(
        and(
          eq(projectFacts.projectId, projectId),
          inArray(projectFacts.fieldName, [
            "project_summary",
            "cost_item",
            "schedule",
            "stakeholder",
            "standards_mapping",
            "overview_client_name",
            "overview_commissioned_phases",
            "overview_building_permit_status",
          ])
        )
      );

    for (const file of fileBuffers) {
      const [documentRecord] = await db
        .insert(documents)
        .values({
          projectId,
          name: file.name,
          type: file.mime,
          versions: [],
          sourceChannel: "intake_upload",
          confidence: 100,
        })
        .returning();

      const processed = await processFile({
        project_id: projectId,
        document_id: documentRecord.id,
        file_name: file.name,
        mime_type: file.mime,
        buffer: file.buffer,
      });

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

      const baseSourceRef = `document_id:${documentRecord.id} | ${processed.source_reference}`;
      const summaryKey = `project_summary|${processed.structured.project_summary.trim().toLowerCase()}`;
      if (
        processed.structured.project_summary.trim().length > 0 &&
        !insertedFactKeys.has(summaryKey)
      ) {
        insertedFactKeys.add(summaryKey);
        await db.insert(projectFacts).values({
          projectId,
          fieldName: "project_summary",
          value: createTraceableValue({
            summary: processed.structured.project_summary.trim(),
            source_reference: baseSourceRef,
          }, documentRecord.id),
          dataState: "DERIVED",
          sourceRef: baseSourceRef,
        });
      }

      const overview = processed.structured.project_overview;
      if (overview.client_name && !inferredProjectOverview.clientName) {
        inferredProjectOverview.clientName = overview.client_name;
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

      if (overview.client_name) {
        const clientKey = `overview_client_name|${overview.client_name.toLowerCase()}`;
        if (!insertedFactKeys.has(clientKey)) {
          insertedFactKeys.add(clientKey);
          await db.insert(projectFacts).values({
            projectId,
            fieldName: "overview_client_name",
            value: createTraceableValue(
              {
                client_name: overview.client_name,
                source_reference: baseSourceRef,
              },
              documentRecord.id
            ),
            dataState: "DERIVED",
            sourceRef: baseSourceRef,
          });
        }
      }

      if (overview.commissioned_phases.length > 0) {
        const phaseToken = overview.commissioned_phases.join(",");
        const commissionedKey = `overview_commissioned_phases|${phaseToken}`;
        if (!insertedFactKeys.has(commissionedKey)) {
          insertedFactKeys.add(commissionedKey);
          await db.insert(projectFacts).values({
            projectId,
            fieldName: "overview_commissioned_phases",
            value: createTraceableValue(
              {
                commissioned_phases: overview.commissioned_phases,
                source_reference: baseSourceRef,
              },
              documentRecord.id
            ),
            dataState: "DERIVED",
            sourceRef: baseSourceRef,
          });
        }
      }

      if (overview.building_permit_status) {
        const permitKey = `overview_building_permit_status|${overview.building_permit_status.toLowerCase()}`;
        if (!insertedFactKeys.has(permitKey)) {
          insertedFactKeys.add(permitKey);
          await db.insert(projectFacts).values({
            projectId,
            fieldName: "overview_building_permit_status",
            value: createTraceableValue(
              {
                building_permit_status: overview.building_permit_status,
                source_reference: baseSourceRef,
              },
              documentRecord.id
            ),
            dataState: "DERIVED",
            sourceRef: baseSourceRef,
          });
        }
      }

      if (processed.structured.current_hoai_phase !== null) {
        inferredProjectOverview.currentHoaiPhase ||= processed.structured.current_hoai_phase;
        const hoaiKey = `current_hoai_phase|${processed.structured.current_hoai_phase}`;
        if (!insertedFactKeys.has(hoaiKey)) {
          insertedFactKeys.add(hoaiKey);
          await db.insert(projectFacts).values({
            projectId,
            fieldName: "current_hoai_phase",
            value: createTraceableValue({
              hoai_phase: processed.structured.current_hoai_phase,
              source_reference: baseSourceRef,
            }, documentRecord.id),
            dataState: "DERIVED",
            sourceRef: baseSourceRef,
          });
        }
      } else {
        allMissingData.add("current_hoai_phase");
      }

      for (const costItem of processed.structured.cost_items) {
        const key = `cost_item|${costItem.description.toLowerCase()}|${costItem.din276_code}|${costItem.quantity ?? "null"}|${costItem.amount ?? "null"}|${costItem.unit ?? "null"}`;
        if (insertedFactKeys.has(key)) continue;
        insertedFactKeys.add(key);
        await db.insert(projectFacts).values({
          projectId,
          fieldName: "cost_item",
          value: createTraceableValue(
            {
              ...costItem,
              source_reference:
                costItem.source_reference || processed.source_reference,
            },
            documentRecord.id
          ),
          dataState: "DERIVED",
          sourceRef: `document_id:${documentRecord.id} | ${costItem.source_reference || processed.source_reference}`,
        });
      }

      for (const scheduleItem of processed.structured.schedule) {
        const key = `schedule|${scheduleItem.task.toLowerCase()}|${scheduleItem.hoai_phase}`;
        if (insertedFactKeys.has(key)) continue;
        insertedFactKeys.add(key);
        await db.insert(projectFacts).values({
          projectId,
          fieldName: "schedule",
          value: createTraceableValue(
            {
              ...scheduleItem,
              source_reference:
                scheduleItem.source_reference || processed.source_reference,
            },
            documentRecord.id
          ),
          dataState: "DERIVED",
          sourceRef: `document_id:${documentRecord.id} | ${scheduleItem.source_reference || processed.source_reference}`,
        });
      }

      for (const stakeholder of processed.structured.stakeholders) {
        const key = `stakeholder|${stakeholder.name.toLowerCase()}|${stakeholder.role.toLowerCase()}`;
        if (insertedFactKeys.has(key)) continue;
        insertedFactKeys.add(key);
        await db.insert(projectFacts).values({
          projectId,
          fieldName: "stakeholder",
          value: createTraceableValue(
            {
              ...stakeholder,
              source_reference:
                stakeholder.source_reference || processed.source_reference,
            },
            documentRecord.id
          ),
          dataState: "DERIVED",
          sourceRef: `document_id:${documentRecord.id} | ${stakeholder.source_reference || processed.source_reference}`,
        });
      }

      for (const mapping of processed.structured.standards_mapping) {
        const key = `standards_mapping|${mapping.finding.toLowerCase()}|${mapping.hoai_service_phase ?? "null"}|${mapping.din276_cost_group ?? "null"}`;
        if (insertedFactKeys.has(key)) continue;
        insertedFactKeys.add(key);
        await db.insert(projectFacts).values({
          projectId,
          fieldName: "standards_mapping",
          value: createTraceableValue(
            {
              ...mapping,
              source_reference:
                mapping.source_reference || processed.source_reference,
            },
            documentRecord.id
          ),
          dataState: "DERIVED",
          sourceRef: `document_id:${documentRecord.id} | ${mapping.source_reference || processed.source_reference}`,
        });
      }
    }

    const hasFactValue = (
      factIndex: Map<string, { value: string | null; dataState: string }[]>,
      fieldNames: string[]
    ): boolean => {
      for (const fieldName of fieldNames) {
        const entries = factIndex.get(fieldName) || [];
        if (entries.some((entry) => entry.dataState !== "MISSING" && !!entry.value && entry.value.trim().length > 0)) {
          return true;
        }
      }
      return false;
    };

    const isBuildingPermitConfirmed = (
      factIndex: Map<string, { value: string | null; dataState: string }[]>
    ): boolean => {
      const entries = [
        ...(factIndex.get("overview_building_permit_status") || []),
        ...(factIndex.get("building_permit_status") || []),
      ];
      return entries.some((entry) => entry.dataState === "CONFIRMED");
    };

    const evaluateCriterion = (
      criterionKey: string,
      factIndex: Map<string, { value: string | null; dataState: string }[]>
    ): boolean => {
      const map: Record<string, string[]> = {
        project_name: ["project_summary"],
        location: ["location"],
        client: ["overview_client_name", "client_name"],
        time_anchor: ["target_completion", "known_deadlines", "schedule"],
        scope_description: ["project_summary", "scope_description"],
        project_objective: ["project_summary", "scope_description"],
        constraints_identified: ["known_constraints"],
        risk_scan: ["mentioned_risks"],
        lph_roadmap: ["current_hoai_phase", "overview_commissioned_phases", "schedule"],
        responsibility_draft: ["stakeholder", "known_consultants"],
        kostenrahmen: ["estimated_construction_cost", "cost_item"],
        hoai_fee_zone: ["hoai_fee_zone", "standards_mapping"],
        scope_per_discipline: ["hoai_service_scope", "standards_mapping"],
        project_state_visible: ["current_hoai_phase", "project_summary"],
        outputs_defined: ["known_trade_packages", "standards_mapping"],
        input_docs_available: ["project_summary"],
        interfaces_identified: ["known_consultants", "standards_mapping"],
        internal_approval_to_invite: ["mentioned_approvals"],
        kostenschaetzung: ["cost_per_sqm_estimate", "cost_item"],
        hoai_scope_defined: ["hoai_service_scope", "standards_mapping"],
        tender_docs_approved: ["known_trade_packages", "standards_mapping"],
        consultant_inputs_complete: ["known_consultants", "stakeholder"],
        open_decisions_resolved: ["decision_authority", "mentioned_approvals"],
        pricing_model_ready: ["estimated_construction_cost", "cost_item"],
        procurement_model_confirmed: ["procurement_model", "procurement_model_vob"],
        kostenberechnung: ["cost_item", "estimated_construction_cost"],
        vob_procedure_determined: ["tendering_procedure_type", "standards_mapping"],
        trade_packages_defined: ["known_trade_packages", "standards_mapping"],
        contracts_awarded: ["contract_type_preference", "standards_mapping"],
        execution_drawings_approved: ["mentioned_approvals"],
        review_workflow_configured: ["mentioned_approvals", "project_summary"],
        site_team_onboarded: ["stakeholder", "known_consultants"],
        quality_plan_ready: ["mentioned_approvals", "project_summary"],
        kostenanschlag: ["cost_item"],
        sigeko_plan: ["sigeko_required", "standards_mapping"],
        baugenehmigung: ["building_permit_status", "overview_building_permit_status"],
        punch_list_closed: ["mentioned_approvals"],
        final_docs_submitted: ["mentioned_approvals"],
        all_reviews_closed: ["mentioned_approvals"],
        client_acceptance: ["decision_authority"],
        invoicing_complete: ["estimated_construction_cost", "cost_item"],
        kostenfeststellung: ["cost_item"],
        abnahmen_complete: ["mentioned_approvals"],
        warranty_tracking: ["mentioned_approvals"],
      };
      if (criterionKey === "bauantrag_submitted" || criterionKey === "baugenehmigung") {
        return isBuildingPermitConfirmed(factIndex);
      }
      const fields = map[criterionKey];
      if (!fields) return false;
      return hasFactValue(factIndex, fields);
    };

    const [allFactsForGates, gateRows] = await Promise.all([
      db.query.projectFacts.findMany({
        where: eq(projectFacts.projectId, projectId),
      }),
      db.query.gates.findMany({
        where: eq(gates.projectId, projectId),
        orderBy: asc(gates.gate),
      }),
    ]);
    const factIndex = new Map<string, { value: string | null; dataState: string }[]>();
    for (const fact of allFactsForGates) {
      const existing = factIndex.get(fact.fieldName) || [];
      existing.push({ value: fact.value, dataState: fact.dataState });
      factIndex.set(fact.fieldName, existing);
    }

    const gateOrder = ["A", "B", "C", "D", "E", "F"];
    let previousGatePassed = true;
    for (const gateLetter of gateOrder) {
      const gateRow = gateRows.find((item) => item.gate === gateLetter);
      if (!gateRow) continue;
      const currentCriteria = gateRow.criteria as {
        key: string;
        label: string;
        met: boolean;
        autoCheck: boolean;
      }[];
      const mergedCriteria = currentCriteria.map((existing) => {
        return {
          ...existing,
          met: evaluateCriterion(existing.key, factIndex),
          autoCheck: true,
        };
      });
      const gatePassed = mergedCriteria.every((criterion) => criterion.met);
      await db
        .update(gates)
        .set({
          criteria: mergedCriteria,
          status:
            gateRow.status === "complete" || gateRow.status === "overridden"
              ? gateRow.status
              : previousGatePassed
              ? "in_progress"
              : "locked",
        })
        .where(eq(gates.id, gateRow.id));

      previousGatePassed = previousGatePassed && gatePassed;
    }

    await updateJobStep(jobId, "extracting", "complete", "classifying");
    await updateJobStep(jobId, "classifying", "complete", "structuring");
    await updateJobStep(jobId, "structuring", "complete", "gates");
    await updateJobStep(jobId, "gates", "complete");

    const generatedProjectName = buildGeneratedProjectName({
      fallbackName: formData.projectName || "Untitled Project",
      clientName: inferredProjectOverview.clientName,
      location: formData.location || formData.projectLocation || "",
      summary: inferredProjectOverview.objective || allProjectSummaries[0] || "",
    });

    await db
      .update(projects)
      .set({
        name: generatedProjectName,
        objective: inferredProjectOverview.objective || undefined,
        clientName: inferredProjectOverview.clientName || undefined,
        lifecycleState: "parsed",
      })
      .where(eq(projects.id, projectId));

    await syncLatestDraftSpd(projectId, {
      name: generatedProjectName,
      type: "not_sure",
      location: formData.location || formData.projectLocation || null,
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
