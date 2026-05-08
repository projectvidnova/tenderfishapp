import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { db, projects, projectFacts, phases, gates, documents } from "@tenderfish/db";
import { eq, and } from "drizzle-orm";
import { ensureProjectBootstrap, syncLatestDraftSpd } from "../services/project-bootstrap";
import { createProjectSchema, validateBody } from "../lib/validation";
import { extractProjectDetailsFromImage } from "../services/ai-pipeline";
import { isVisionSupportedImageMime, processImageForVision } from "../services/file-parser";
import { refreshAndAutoCompleteGates } from "../services/gate-evaluator";
import { tryPersistDocumentFileToStorage } from "../services/document-version-storage";

function visionMimeForUpload(file: { mimetype: string; filename: string }): string {
  const raw = (file.mimetype || "application/octet-stream").toLowerCase().trim();
  if (isVisionSupportedImageMime(raw)) return raw;
  const lower = file.filename.toLowerCase();
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  return raw;
}

export async function projectRoutes(app: FastifyInstance) {
  // GET /api/projects — list workspace projects
  app.get("/projects", async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.auth) {
      return reply.status(401).send({ error: "Unauthorized" });
    }

    const projectList = await db.query.projects.findMany({
      where: eq(projects.workspaceId, request.auth.workspaceId),
      orderBy: (projects, { desc }) => [desc(projects.createdAt)],
    });

    return { data: projectList };
  });

  // POST /api/projects — create project
  app.post("/projects", async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.auth) {
      return reply.status(401).send({ error: "Unauthorized" });
    }

    if (!["architect_admin", "project_lead"].includes(request.auth.role)) {
      return reply.status(403).send({ error: "Forbidden" });
    }

    const parsed = validateBody(createProjectSchema, request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error });
    }
    const body = parsed.data;

    // Create project
    const [project] = await db
      .insert(projects)
      .values({
        workspaceId: request.auth.workspaceId,
        name: body.name,
        type: body.type,
        location: body.location,
        clientName: body.clientName,
        procurementModel: body.procurementModel,
        targetCompletion: body.targetCompletion,
        objective: body.objective,
        scopeSummary: body.scopeSummary,
      })
      .returning();

    await ensureProjectBootstrap(project.id, request.auth.userId, {
      name: body.name,
      type: body.type,
      location: body.location,
      objective: body.objective,
      scopeSummary: body.scopeSummary,
      currentLph: 1,
    });

    return reply.status(201).send({ data: project });
  });

  function buildProjectNameFromVision(
    details: Awaited<ReturnType<typeof extractProjectDetailsFromImage>>,
    fileName: string
  ): string {
    const fromVision = details.projectName?.trim();
    if (fromVision) return fromVision.slice(0, 500);
    const hint = fileName
      .replace(/\.[a-z0-9]+$/i, "")
      .replace(/[_-]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (details.clientName?.trim() && details.location?.trim()) {
      return `${details.clientName.trim()} — ${details.location.trim()}`.slice(0, 500);
    }
    if (details.clientName?.trim()) return `${details.clientName.trim()} Project`.slice(0, 500);
    if (details.location?.trim()) return `${details.location.trim()} Project`.slice(0, 500);
    if (hint) return hint.slice(0, 500);
    return "New project from image";
  }

  // POST /api/projects/create-from-image — create project from a single image via vision extraction
  app.post(
    "/projects/create-from-image",
    async (request: FastifyRequest, reply: FastifyReply) => {
      if (!request.auth) {
        return reply.status(401).send({ error: "Unauthorized" });
      }

      if (!["architect_admin", "project_lead"].includes(request.auth.role)) {
        return reply.status(403).send({ error: "Forbidden" });
      }

      const parts = request.parts();
      let filePart: { buffer: Buffer; filename: string; mimetype: string } | null = null;
      let nameHintFromForm = "";

      for await (const part of parts) {
        if (part.type === "file") {
          if (filePart) {
            return reply.status(400).send({ error: "Only one image file is allowed" });
          }
          const chunks: Buffer[] = [];
          for await (const chunk of part.file) {
            chunks.push(chunk);
          }
          filePart = {
            buffer: Buffer.concat(chunks),
            filename: part.filename || "upload",
            mimetype: part.mimetype || "application/octet-stream",
          };
        } else {
          const field = part.fieldname;
          if (field === "projectName" || field === "name") {
            nameHintFromForm = String((part as { value?: string }).value ?? "").trim();
          }
        }
      }

      if (!filePart) {
        return reply.status(400).send({ error: "Image file is required (multipart/form-data)" });
      }

      const visionMime = visionMimeForUpload(filePart);
      if (!isVisionSupportedImageMime(visionMime)) {
        return reply.status(400).send({
          error: "Unsupported image type. Use image/jpeg, image/png, or image/webp.",
        });
      }

      const base64 = processImageForVision(filePart.buffer, visionMime);

      let details: Awaited<ReturnType<typeof extractProjectDetailsFromImage>>;
      try {
        details = await extractProjectDetailsFromImage(base64, visionMime);
      } catch (err) {
        request.log.error({ err }, "extractProjectDetailsFromImage failed");
        return reply.status(502).send({
          error: "Vision extraction failed",
          message: err instanceof Error ? err.message : "Unknown error",
        });
      }

      const projectName = nameHintFromForm
        ? nameHintFromForm.slice(0, 500)
        : buildProjectNameFromVision(details, filePart.filename);

      const objectiveParts = [details.projectName, details.location, details.clientName]
        .filter((s): s is string => typeof s === "string" && s.trim().length > 0)
        .map((s) => s.trim());
      const objective =
        objectiveParts.length > 0
          ? `Captured from image: ${objectiveParts.join(" · ")}`
          : "Project created from image intake.";

      const scopeSummary =
        details.estimatedTrades.length > 0
          ? `Trades noted from image: ${details.estimatedTrades.join(", ")}`
          : null;

      const [project] = await db
        .insert(projects)
        .values({
          workspaceId: request.auth.workspaceId,
          name: projectName,
          type: "not_sure",
          location: details.location?.trim() || undefined,
          clientName: details.clientName?.trim() || undefined,
          targetCompletion: details.targetCompletionDate?.trim() || undefined,
          procurementModel: "unclear",
          objective,
          scopeSummary: scopeSummary ?? undefined,
          lifecycleState: "parsed",
        })
        .returning();

      await ensureProjectBootstrap(project.id, request.auth.userId, {
        name: projectName,
        type: "not_sure",
        location: details.location?.trim() || null,
        objective,
        scopeSummary: scopeSummary ?? null,
        currentLph: 1,
      });

      await syncLatestDraftSpd(project.id, {
        name: projectName,
        type: "not_sure",
        location: details.location?.trim() || null,
        objective,
        scopeSummary: scopeSummary ?? null,
        currentLph: 1,
      });

      const [planDoc] = await db
        .insert(documents)
        .values({
          projectId: project.id,
          name: filePart.filename,
          type: visionMime,
          versions: [],
          sourceChannel: "create_from_image",
          confidence: 100,
          createdBy: request.auth.userId ?? undefined,
        })
        .returning();

      const persistedPlan = await tryPersistDocumentFileToStorage({
        workspaceId: request.auth.workspaceId,
        projectId: project.id,
        documentId: planDoc.id,
        fileName: filePart.filename,
        buffer: filePart.buffer,
        contentType: visionMime,
        uploadedBy: request.auth.userId ?? "system",
      });

      if (persistedPlan) {
        await db
          .update(documents)
          .set({ versions: persistedPlan, currentVersion: 1 })
          .where(eq(documents.id, planDoc.id));
      }

      const sourceRef = `document_id:${planDoc.id} | create-from-image|${filePart.filename}|${visionMime}`;
      const summaryLine =
        [details.projectName, details.location, details.clientName]
          .filter((s): s is string => typeof s === "string" && s.trim().length > 0)
          .map((s) => s.trim())
          .join(" · ") || projectName;

      type FactInsert = {
        projectId: string;
        fieldName: string;
        value: string;
        dataState: "DERIVED";
        sourceRef: string;
      };

      const factRows: FactInsert[] = [
        {
          projectId: project.id,
          fieldName: "project_summary",
          value: JSON.stringify({
            summary: summaryLine,
            source_reference: sourceRef,
            truth_state: "inferred",
          }),
          dataState: "DERIVED",
          sourceRef,
        },
      ];

      if (details.location?.trim()) {
        factRows.push({
          projectId: project.id,
          fieldName: "location",
          value: JSON.stringify({
            location: details.location.trim(),
            source_reference: sourceRef,
            truth_state: "inferred",
          }),
          dataState: "DERIVED",
          sourceRef,
        });
      }

      if (details.clientName?.trim()) {
        const clientPayload = {
          client_name: details.clientName.trim(),
          source_reference: sourceRef,
          truth_state: "inferred" as const,
        };
        factRows.push({
          projectId: project.id,
          fieldName: "client_name",
          value: JSON.stringify(clientPayload),
          dataState: "DERIVED",
          sourceRef,
        });
        factRows.push({
          projectId: project.id,
          fieldName: "overview_client_name",
          value: JSON.stringify(clientPayload),
          dataState: "DERIVED",
          sourceRef,
        });
      }

      if (details.targetCompletionDate?.trim()) {
        factRows.push({
          projectId: project.id,
          fieldName: "target_completion",
          value: JSON.stringify({
            target_completion: details.targetCompletionDate.trim(),
            source_reference: sourceRef,
            truth_state: "inferred",
          }),
          dataState: "DERIVED",
          sourceRef,
        });
      }

      if (details.estimatedTrades.length > 0) {
        factRows.push({
          projectId: project.id,
          fieldName: "known_trade_packages",
          value: JSON.stringify({
            trades: details.estimatedTrades,
            source_reference: sourceRef,
            truth_state: "inferred",
          }),
          dataState: "DERIVED",
          sourceRef,
        });
      }

      await db.insert(projectFacts).values(factRows);
      await refreshAndAutoCompleteGates(project.id);

      return reply.status(201).send({
        success: true,
        data: { projectId: project.id },
      });
    }
  );

  // GET /api/projects/:id — project detail
  app.get("/projects/:id", async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.auth) {
      return reply.status(401).send({ error: "Unauthorized" });
    }

    const { id } = request.params as { id: string };

    const project = await db.query.projects.findFirst({
      where: and(eq(projects.id, id), eq(projects.workspaceId, request.auth.workspaceId)),
    });

    if (!project) {
      return reply.status(404).send({ error: "Project not found" });
    }

    return { data: project };
  });

  // PATCH /api/projects/:id — update project
  app.patch("/projects/:id", async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.auth) {
      return reply.status(401).send({ error: "Unauthorized" });
    }

    const { id } = request.params as { id: string };
    const body = request.body as Record<string, unknown>;

    // Verify project belongs to workspace
    const existing = await db.query.projects.findFirst({
      where: and(eq(projects.id, id), eq(projects.workspaceId, request.auth.workspaceId)),
    });

    if (!existing) {
      return reply.status(404).send({ error: "Project not found" });
    }

    const allowedFields = [
      "name",
      "type",
      "status",
      "procurementModel",
      "targetCompletion",
      "objective",
      "scopeSummary",
      "location",
      "clientName",
      "clientRepresentative",
    ];

    const updates: Record<string, unknown> = {};
    for (const field of allowedFields) {
      if (field in body) {
        updates[field] = body[field];
      }
    }

    if (Object.keys(updates).length === 0) {
      return reply.status(400).send({ error: "No valid fields to update" });
    }

    const [updated] = await db.update(projects).set(updates).where(eq(projects.id, id)).returning();

    await syncLatestDraftSpd(id, {
      name: typeof updated.name === "string" ? updated.name : null,
      type: typeof updated.type === "string" ? updated.type : null,
      location: typeof updated.location === "string" ? updated.location : null,
      objective: typeof updated.objective === "string" ? updated.objective : null,
      scopeSummary: typeof updated.scopeSummary === "string" ? updated.scopeSummary : null,
      currentLph: 1,
    });

    return { data: updated };
  });

  // GET /api/projects/:id/facts — extracted facts
  app.get("/projects/:id/facts", async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.auth) {
      return reply.status(401).send({ error: "Unauthorized" });
    }

    const { id } = request.params as { id: string };

    // Verify project belongs to workspace
    const project = await db.query.projects.findFirst({
      where: and(eq(projects.id, id), eq(projects.workspaceId, request.auth.workspaceId)),
    });

    if (!project) {
      return reply.status(404).send({ error: "Project not found" });
    }

    const facts = await db.query.projectFacts.findMany({
      where: eq(projectFacts.projectId, id),
      orderBy: (pf, { asc }) => [asc(pf.fieldName)],
    });

    return { data: facts };
  });

  type ExtractedFact = {
    id: string;
    fieldName: string;
    value: string | null;
    dataState: string;
    sourceRef: string | null;
  };

  type GateCriterion = {
    key: string;
    label: string;
    met: boolean;
    autoCheck?: boolean;
  };

  type GateCriterionUnlock = {
    gate: string;
    criterionKey: string;
    criterionLabel: string;
    met: boolean;
    // Facts that contributed to this criterion being met (based on the same field mapping
    // used by the gate auto-evaluation).
    supportingFacts: ExtractedFact[];
  };

  // Mirrors the field->criterion mapping used by the gate eligibility evaluator.
  const CRITERION_TO_FACT_FIELDS: Record<string, string[]> = {
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
    // Special case: Bauantrag submission criterion is treated like baugenehmigung in auto-evaluation.
    bauantrag_submitted: ["building_permit_status", "overview_building_permit_status"],
  };

  function factIsMetGeneral(fact: ExtractedFact): boolean {
    if (fact.dataState === "MISSING") return false;
    if (!fact.value) return false;
    return fact.value.trim().length > 0;
  }

  function criterionSupportingFacts(
    criterionKey: string,
    factsByField: Map<string, ExtractedFact[]>
  ): ExtractedFact[] {
    const fieldNames = CRITERION_TO_FACT_FIELDS[criterionKey];
    if (!fieldNames) return [];

    // Mirrors gate-evaluator building permit logic: criterion met only from CONFIRMED facts.
    if (criterionKey === "bauantrag_submitted" || criterionKey === "baugenehmigung") {
      const permitFacts = fieldNames.flatMap((field) => factsByField.get(field) || []);
      return permitFacts.filter((f) => f.dataState === "CONFIRMED" && !!f.value?.trim());
    }

    const supporting = fieldNames.flatMap((field) => factsByField.get(field) || []);
    return supporting.filter(factIsMetGeneral);
  }

  // GET /api/projects/:id/extracted-facts — facts + mapping to gate criteria they fulfilled
  app.get(
    "/projects/:id/extracted-facts",
    async (request: FastifyRequest, reply: FastifyReply) => {
      if (!request.auth) {
        return reply.status(401).send({ error: "Unauthorized" });
      }

      const { id } = request.params as { id: string };

      // Verify project belongs to workspace
      const project = await db.query.projects.findFirst({
        where: and(eq(projects.id, id), eq(projects.workspaceId, request.auth.workspaceId)),
      });

      if (!project) {
        return reply.status(404).send({ error: "Project not found" });
      }

      const [facts, projectGates] = await Promise.all([
        db.query.projectFacts.findMany({
          where: eq(projectFacts.projectId, id),
          orderBy: (pf, { asc }) => [asc(pf.fieldName)],
        }),
        db.query.gates.findMany({
          where: eq(gates.projectId, id),
          orderBy: (g, { asc }) => [asc(g.gate)],
        }),
      ]);

      const normalizedFacts: ExtractedFact[] = facts.map((f) => ({
        id: f.id,
        fieldName: f.fieldName,
        value: f.value,
        dataState: f.dataState,
        sourceRef: f.sourceRef,
      }));

      const factsByField = new Map<string, ExtractedFact[]>();
      for (const f of normalizedFacts) {
        const existing = factsByField.get(f.fieldName) || [];
        existing.push(f);
        factsByField.set(f.fieldName, existing);
      }

      const gateOrder = ["A", "B", "C", "D", "E", "F"] as const;
      const gateCriterionUnlocks: GateCriterionUnlock[] = [];

      for (const letter of gateOrder) {
        const gate = projectGates.find((g) => g.gate === letter);
        if (!gate) continue;

        const criteria = gate.criteria as GateCriterion[];
        for (const c of criteria) {
          if (!c.met) continue; // only explain what unlocked (met=true)
          const supportingFacts = criterionSupportingFacts(c.key, factsByField);
          gateCriterionUnlocks.push({
            gate: gate.gate,
            criterionKey: c.key,
            criterionLabel: c.label,
            met: c.met,
            supportingFacts,
          });
        }
      }

      return reply.status(200).send({
        data: {
          facts: normalizedFacts,
          gateCriterionUnlocks,
        },
      });
    }
  );

  // POST /api/projects/:id/facts — create fact
  app.post("/projects/:id/facts", async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.auth) {
      return reply.status(401).send({ error: "Unauthorized" });
    }

    const { id } = request.params as { id: string };
    const body = request.body as {
      fieldName?: string;
      value?: string | null;
      dataState?: string;
      sourceRef?: string | null;
    };

    const project = await db.query.projects.findFirst({
      where: and(eq(projects.id, id), eq(projects.workspaceId, request.auth.workspaceId)),
    });
    if (!project) {
      return reply.status(404).send({ error: "Project not found" });
    }

    if (!body.fieldName || typeof body.fieldName !== "string") {
      return reply.status(400).send({ error: "fieldName is required" });
    }

    const [created] = await db
      .insert(projectFacts)
      .values({
        projectId: id,
        fieldName: body.fieldName,
        value: body.value ?? null,
        dataState:
          (body.dataState as typeof projectFacts.dataState.enumValues[number]) ||
          "DERIVED",
        sourceRef: body.sourceRef ?? "manual_entry",
      })
      .returning();

    return reply.status(201).send({ data: created });
  });

  // PATCH /api/projects/:id/facts/:factId — update fact
  app.patch("/projects/:id/facts/:factId", async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.auth) {
      return reply.status(401).send({ error: "Unauthorized" });
    }

    const { id, factId } = request.params as { id: string; factId: string };
    const body = request.body as { value?: string; dataState?: string; sourceRef?: string | null };

    // Verify project belongs to workspace
    const project = await db.query.projects.findFirst({
      where: and(eq(projects.id, id), eq(projects.workspaceId, request.auth.workspaceId)),
    });

    if (!project) {
      return reply.status(404).send({ error: "Project not found" });
    }

    const currentFact = await db.query.projectFacts.findFirst({
      where: and(eq(projectFacts.id, factId), eq(projectFacts.projectId, id)),
    });
    if (!currentFact) {
      return reply.status(404).send({ error: "Fact not found" });
    }

    const updates: Record<string, unknown> = {};
    if ("value" in body) updates.value = body.value;
    if ("dataState" in body) updates.dataState = body.dataState;
    if ("sourceRef" in body) updates.sourceRef = body.sourceRef;

    if (body.dataState === "CONFIRMED" && currentFact.value) {
      try {
        const parsed = JSON.parse(currentFact.value) as Record<string, unknown>;
        if (parsed && typeof parsed === "object") {
          updates.value = JSON.stringify({
            ...parsed,
            truth_state: "confirmed",
          });
        }
      } catch {
        // keep original non-JSON value
      }
    }

    const [updated] = await db
      .update(projectFacts)
      .set(updates)
      .where(and(eq(projectFacts.id, factId), eq(projectFacts.projectId, id)))
      .returning();

    return { data: updated };
  });

  // DELETE /api/projects/:id/facts/:factId — delete fact
  app.delete("/projects/:id/facts/:factId", async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.auth) {
      return reply.status(401).send({ error: "Unauthorized" });
    }

    const { id, factId } = request.params as { id: string; factId: string };

    const project = await db.query.projects.findFirst({
      where: and(eq(projects.id, id), eq(projects.workspaceId, request.auth.workspaceId)),
    });
    if (!project) {
      return reply.status(404).send({ error: "Project not found" });
    }

    const [deleted] = await db
      .delete(projectFacts)
      .where(and(eq(projectFacts.id, factId), eq(projectFacts.projectId, id)))
      .returning();

    if (!deleted) {
      return reply.status(404).send({ error: "Fact not found" });
    }

    return { data: deleted };
  });

  // GET /api/projects/:id/gates — all gates
  app.get("/projects/:id/gates", async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.auth) {
      return reply.status(401).send({ error: "Unauthorized" });
    }

    const { id } = request.params as { id: string };

    const project = await db.query.projects.findFirst({
      where: and(eq(projects.id, id), eq(projects.workspaceId, request.auth.workspaceId)),
    });

    if (!project) {
      return reply.status(404).send({ error: "Project not found" });
    }

    const gateList = await db.query.gates.findMany({
      where: eq(gates.projectId, id),
    });

    return { data: gateList };
  });

  // GET /api/projects/:id/phases — all phases
  app.get("/projects/:id/phases", async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.auth) {
      return reply.status(401).send({ error: "Unauthorized" });
    }

    const { id } = request.params as { id: string };

    const project = await db.query.projects.findFirst({
      where: and(eq(projects.id, id), eq(projects.workspaceId, request.auth.workspaceId)),
    });

    if (!project) {
      return reply.status(404).send({ error: "Project not found" });
    }

    const phaseList = await db.query.phases.findMany({
      where: eq(phases.projectId, id),
      orderBy: (p, { asc }) => [asc(p.lph)],
    });

    return { data: phaseList };
  });
}
