import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { db, projects, gates, approvals, users, projectFacts, documents } from "@tenderfish/db";
import { eq, and, asc, inArray } from "drizzle-orm";
import { requireAccess } from "../middleware/rbac";
import { logAudit } from "../utils/audit";
import { broadcastNotification, createNotification } from "../utils/notify";
import { gateOverrideSchema, validateBody } from "../lib/validation";
import { processFile } from "../services/ai-pipeline";

async function verifyProject(projectId: string, workspaceId: string) {
  return db.query.projects.findFirst({
    where: and(eq(projects.id, projectId), eq(projects.workspaceId, workspaceId)),
  });
}

function hasFactValue(
  factIndex: Map<string, { value: string | null; dataState: string }[]>,
  fieldNames: string[]
): boolean {
  for (const fieldName of fieldNames) {
    const entries = factIndex.get(fieldName) || [];
    if (entries.some((entry) => entry.dataState !== "MISSING" && !!entry.value && entry.value.trim().length > 0)) {
      return true;
    }
  }
  return false;
}

function isBuildingPermitConfirmed(
  factIndex: Map<string, { value: string | null; dataState: string }[]>
): boolean {
  const entries = [
    ...(factIndex.get("overview_building_permit_status") || []),
    ...(factIndex.get("building_permit_status") || []),
  ];
  return entries.some((entry) => entry.dataState === "CONFIRMED");
}

function evaluateCriterion(
  criterionKey: string,
  factIndex: Map<string, { value: string | null; dataState: string }[]>
): boolean {
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
}

async function refreshGateCriteriaFromFacts(projectId: string) {
  const [facts, gateRows] = await Promise.all([
    db.query.projectFacts.findMany({
      where: eq(projectFacts.projectId, projectId),
    }),
    db.query.gates.findMany({
      where: eq(gates.projectId, projectId),
      orderBy: asc(gates.gate),
    }),
  ]);

  const factIndex = new Map<string, { value: string | null; dataState: string }[]>();
  for (const fact of facts) {
    const existing = factIndex.get(fact.fieldName) || [];
    existing.push({ value: fact.value, dataState: fact.dataState });
    factIndex.set(fact.fieldName, existing);
  }

  for (const gateRow of gateRows) {
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

    let nextStatus = gateRow.status;
    if (nextStatus !== "complete" && nextStatus !== "overridden") {
      nextStatus = "in_progress";
    }

    await db
      .update(gates)
      .set({
        criteria: mergedCriteria,
        status: nextStatus,
      })
      .where(eq(gates.id, gateRow.id));
  }
}

export async function gateRoutes(app: FastifyInstance) {
  // ─── GATES ──────────────────────────────────────────────────

  // GET /api/projects/:id/gates/detail — all gates with readiness %
  app.get("/projects/:id/gates/detail", async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.auth) return reply.status(401).send({ error: "Unauthorized" });
    const { id } = request.params as { id: string };

    const project = await verifyProject(id, request.auth.workspaceId);
    if (!project) return reply.status(404).send({ error: "Project not found" });

    const gateList = await db.query.gates.findMany({
      where: eq(gates.projectId, id),
    });

    // Enrich with readiness percentage
    const enriched = gateList.map((g) => {
      const criteria = g.criteria as { key: string; label: string; met: boolean; autoCheck: boolean }[];
      const total = criteria.length;
      const met = criteria.filter((c) => c.met).length;
      return {
        ...g,
        readinessPercent: total > 0 ? Math.round((met / total) * 100) : 0,
        criteriaCount: total,
        criteriaMet: met,
      };
    });

    // Sort by gate letter
    enriched.sort((a, b) => a.gate.localeCompare(b.gate));

    return { data: enriched };
  });

  // POST /api/projects/:id/gates/:gate/complete — mark gate complete
  app.post("/projects/:id/gates/:gate/complete", async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.auth) return reply.status(401).send({ error: "Unauthorized" });
    const { id, gate: gateParam } = request.params as { id: string; gate: string };

    const project = await verifyProject(id, request.auth.workspaceId);
    if (!project) return reply.status(404).send({ error: "Project not found" });

    const gateRecord = await db.query.gates.findFirst({
      where: and(eq(gates.projectId, id), eq(gates.gate, gateParam as typeof gates.gate.enumValues[number])),
    });
    if (!gateRecord) return reply.status(404).send({ error: "Gate not found" });

    if (gateRecord.status === "complete") {
      return reply.status(400).send({ error: "Gate is already complete" });
    }
    if (gateRecord.status === "locked") {
      return reply.status(400).send({ error: "Gate is locked. Previous gates must be completed first." });
    }

    // Check all criteria are met
    const criteria = gateRecord.criteria as { key: string; label: string; met: boolean; autoCheck: boolean }[];
    const unmet = criteria.filter((c) => !c.met);
    if (unmet.length > 0) {
      return reply.status(400).send({
        error: "Cannot complete gate",
        message: `${unmet.length} criterion/criteria not met`,
        unmet: unmet.map((c) => ({ key: c.key, label: c.label })),
      });
    }

    // Mark complete
    const [updated] = await db
      .update(gates)
      .set({ status: "complete" })
      .where(eq(gates.id, gateRecord.id))
      .returning();

    await logAudit({
      workspaceId: request.auth.workspaceId,
      projectId: id,
      userId: request.auth.userId,
      action: "gate.complete",
      entityType: "gate",
      entityId: gateRecord.id,
      beforeState: { status: gateRecord.status, gate: gateParam },
      afterState: { status: "complete" },
    });

    // Unlock next gate
    const gateOrder = ["A", "B", "C", "D", "E", "F"];
    const currentIndex = gateOrder.indexOf(gateParam);
    if (currentIndex < gateOrder.length - 1) {
      const nextGateLetter = gateOrder[currentIndex + 1];
      const nextGate = await db.query.gates.findFirst({
        where: and(
          eq(gates.projectId, id),
          eq(gates.gate, nextGateLetter as typeof gates.gate.enumValues[number]),
        ),
      });
      if (nextGate && nextGate.status === "locked") {
        await db.update(gates).set({ status: "in_progress" }).where(eq(gates.id, nextGate.id));
      }
    }

    return { data: updated };
  });

  // POST /api/projects/:id/gates/:gate/override — override gate (admin only)
  app.post("/projects/:id/gates/:gate/override", async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.auth) return reply.status(401).send({ error: "Unauthorized" });
    if (request.auth.role !== "architect_admin") {
      return reply.status(403).send({ error: "Only Architect Admins can override gates" });
    }

    const { id, gate: gateParam } = request.params as { id: string; gate: string };

    const parsed = validateBody(gateOverrideSchema, request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error });
    }

    const project = await verifyProject(id, request.auth.workspaceId);
    if (!project) return reply.status(404).send({ error: "Project not found" });

    const gateRecord = await db.query.gates.findFirst({
      where: and(eq(gates.projectId, id), eq(gates.gate, gateParam as typeof gates.gate.enumValues[number])),
    });
    if (!gateRecord) return reply.status(404).send({ error: "Gate not found" });

    const [updated] = await db
      .update(gates)
      .set({
        status: "overridden",
        overrideActive: true,
        overrideReason: parsed.data.reason,
        overrideBy: request.auth.userId,
        overrideAt: new Date(),
      })
      .where(eq(gates.id, gateRecord.id))
      .returning();

    // Audit log
    await logAudit({
      workspaceId: request.auth.workspaceId,
      projectId: id,
      userId: request.auth.userId,
      action: "gate.override",
      entityType: "gate",
      entityId: gateRecord.id,
      beforeState: { status: gateRecord.status, gate: gateParam },
      afterState: { status: "overridden", reason: parsed.data.reason },
    });

    await broadcastNotification({
      workspaceId: request.auth.workspaceId,
      projectId: id,
      actorId: request.auth.userId,
      type: "gate_override",
      title: `Gate ${gateParam} overridden on "${project.name}"`,
      body: parsed.data.reason,
      entityType: "gate",
      entityId: gateRecord.id,
    });

    // Unlock next gate
    const gateOrder = ["A", "B", "C", "D", "E", "F"];
    const currentIndex = gateOrder.indexOf(gateParam);
    if (currentIndex < gateOrder.length - 1) {
      const nextGateLetter = gateOrder[currentIndex + 1];
      const nextGate = await db.query.gates.findFirst({
        where: and(
          eq(gates.projectId, id),
          eq(gates.gate, nextGateLetter as typeof gates.gate.enumValues[number]),
        ),
      });
      if (nextGate && nextGate.status === "locked") {
        await db.update(gates).set({ status: "in_progress" }).where(eq(gates.id, nextGate.id));
      }
    }

    return { data: updated };
  });

  // PATCH /api/projects/:id/gates/:gate/criteria/:key — toggle criterion
  app.patch("/projects/:id/gates/:gate/criteria/:key", async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.auth) return reply.status(401).send({ error: "Unauthorized" });
    const { id, gate: gateParam, key } = request.params as { id: string; gate: string; key: string };
    const body = request.body as { met: boolean };

    const project = await verifyProject(id, request.auth.workspaceId);
    if (!project) return reply.status(404).send({ error: "Project not found" });

    const gateRecord = await db.query.gates.findFirst({
      where: and(eq(gates.projectId, id), eq(gates.gate, gateParam as typeof gates.gate.enumValues[number])),
    });
    if (!gateRecord) return reply.status(404).send({ error: "Gate not found" });

    const criteria = gateRecord.criteria as { key: string; label: string; met: boolean; autoCheck: boolean }[];
    const updated = criteria.map((c) =>
      c.key === key ? { ...c, met: body.met } : c
    );

    const [result] = await db
      .update(gates)
      .set({ criteria: updated })
      .where(eq(gates.id, gateRecord.id))
      .returning();

    return { data: result };
  });

  // POST /api/projects/:id/gates/:gate/reverify — upload additional evidence and re-check gate criteria
  app.post("/projects/:id/gates/:gate/reverify", async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.auth) return reply.status(401).send({ error: "Unauthorized" });
    const { id, gate: gateParam } = request.params as { id: string; gate: string };

    const project = await verifyProject(id, request.auth.workspaceId);
    if (!project) return reply.status(404).send({ error: "Project not found" });

    const gateRecord = await db.query.gates.findFirst({
      where: and(eq(gates.projectId, id), eq(gates.gate, gateParam as typeof gates.gate.enumValues[number])),
    });
    if (!gateRecord) return reply.status(404).send({ error: "Gate not found" });

    const parts = request.parts();
    const fileBuffers: { name: string; mime: string; buffer: Buffer }[] = [];
    const textEvidence: string[] = [];

    for await (const part of parts) {
      if (part.type === "file") {
        const chunks: Buffer[] = [];
        for await (const chunk of part.file) {
          chunks.push(chunk);
        }
        fileBuffers.push({
          name: part.filename || "evidence",
          mime: part.mimetype || "application/octet-stream",
          buffer: Buffer.concat(chunks),
        });
      } else {
        const value = (part as { value?: string }).value;
        if (typeof value === "string" && value.trim().length > 0) {
          textEvidence.push(value.trim());
        }
      }
    }

    if (fileBuffers.length === 0 && textEvidence.length === 0) {
      return reply.status(400).send({ error: "Attach at least one evidence file or evidence text" });
    }

    if (textEvidence.length > 0) {
      const textBlob = textEvidence.join("\n\n");
      fileBuffers.push({
        name: "gate-supporting-evidence.txt",
        mime: "text/plain",
        buffer: Buffer.from(textBlob, "utf-8"),
      });
    }

    for (const file of fileBuffers) {
      const [documentRecord] = await db
        .insert(documents)
        .values({
          projectId: id,
          name: file.name,
          type: file.mime,
          versions: [],
          sourceChannel: "gate_reverify_upload",
          confidence: 100,
        })
        .returning();

      const processed = await processFile({
        project_id: id,
        document_id: documentRecord.id,
        file_name: file.name,
        mime_type: file.mime,
        buffer: file.buffer,
      });

      for (const scheduleItem of processed.structured.schedule) {
        await db.insert(projectFacts).values({
          projectId: id,
          fieldName: "schedule",
          value: JSON.stringify({
            ...scheduleItem,
            truth_state: "inferred",
            source_document_id: documentRecord.id,
          }),
          dataState: "DERIVED",
          sourceRef: `document_id:${documentRecord.id} | ${scheduleItem.source_reference || processed.source_reference}`,
        });
      }

      for (const costItem of processed.structured.cost_items) {
        await db.insert(projectFacts).values({
          projectId: id,
          fieldName: "cost_item",
          value: JSON.stringify({
            ...costItem,
            truth_state: "inferred",
            source_document_id: documentRecord.id,
          }),
          dataState: "DERIVED",
          sourceRef: `document_id:${documentRecord.id} | ${costItem.source_reference || processed.source_reference}`,
        });
      }

      for (const mapping of processed.structured.standards_mapping) {
        await db.insert(projectFacts).values({
          projectId: id,
          fieldName: "standards_mapping",
          value: JSON.stringify({
            ...mapping,
            truth_state: "inferred",
            source_document_id: documentRecord.id,
          }),
          dataState: "DERIVED",
          sourceRef: `document_id:${documentRecord.id} | ${mapping.source_reference || processed.source_reference}`,
        });
      }
    }

    await refreshGateCriteriaFromFacts(id);

    const refreshedGate = await db.query.gates.findFirst({
      where: and(eq(gates.projectId, id), eq(gates.gate, gateParam as typeof gates.gate.enumValues[number])),
    });

    return {
      data: {
        gate: refreshedGate,
        filesProcessed: fileBuffers.length,
      },
    };
  });

  // ─── APPROVALS ──────────────────────────────────────────────

  // GET /api/projects/:id/approvals
  app.get("/projects/:id/approvals", async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.auth) return reply.status(401).send({ error: "Unauthorized" });
    const { id } = request.params as { id: string };
    const query = request.query as { type?: string };

    const project = await verifyProject(id, request.auth.workspaceId);
    if (!project) return reply.status(404).send({ error: "Project not found" });

    let approvalList = await db.query.approvals.findMany({
      where: eq(approvals.projectId, id),
      orderBy: (a, { desc }) => [desc(a.createdAt)],
    });

    if (query.type) {
      approvalList = approvalList.filter((a) => a.type === query.type);
    }

    // Enrich with user names
    const userIds = new Set<string>();
    approvalList.forEach((a) => {
      if (a.requestedBy) userIds.add(a.requestedBy);
      if (a.approverUserId) userIds.add(a.approverUserId);
    });

    const userMap: Record<string, string> = {};
    if (userIds.size > 0) {
      const userList = await db.query.users.findMany({
        where: inArray(users.id, Array.from(userIds)),
      });
      userList.forEach((u) => { userMap[u.id] = u.name; });
    }

    const enriched = approvalList.map((a) => ({
      ...a,
      requestedByName: a.requestedBy ? userMap[a.requestedBy] || null : null,
      approverName: a.approverUserId ? userMap[a.approverUserId] || null : null,
    }));

    return { data: enriched };
  });

  // POST /api/projects/:id/approvals
  app.post("/projects/:id/approvals", async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.auth) return reply.status(401).send({ error: "Unauthorized" });
    const { id } = request.params as { id: string };
    const body = request.body as {
      name: string;
      type: string;
      approverUserId?: string;
      dueDate?: string;
      notes?: string;
      relatedGate?: string;
      relatedPhaseId?: string;
    };

    const project = await verifyProject(id, request.auth.workspaceId);
    if (!project) return reply.status(404).send({ error: "Project not found" });

    if (!body.name?.trim() || !body.type) {
      return reply.status(400).send({ error: "name and type are required" });
    }

    const [approval] = await db
      .insert(approvals)
      .values({
        projectId: id,
        name: body.name.trim(),
        type: body.type as typeof approvals.type.enumValues[number],
        requestedBy: request.auth.userId,
        approverUserId: body.approverUserId,
        dueDate: body.dueDate,
        notes: body.notes,
        relatedGate: body.relatedGate,
        relatedPhaseId: body.relatedPhaseId,
        status: body.approverUserId ? "in_review" : "pending",
      })
      .returning();

    if (body.approverUserId && body.approverUserId !== request.auth.userId) {
      await createNotification({
        workspaceId: request.auth.workspaceId,
        userId: body.approverUserId,
        projectId: id,
        type: "approval_requested",
        title: `Approval requested: "${body.name.trim()}"`,
        body: `On project "${project.name}"`,
        entityType: "approval",
        entityId: approval.id,
      });
    }

    return reply.status(201).send({ data: approval });
  });

  // PATCH /api/projects/:id/approvals/:approvalId — approve/reject/update
  app.patch("/projects/:id/approvals/:approvalId", async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.auth) return reply.status(401).send({ error: "Unauthorized" });
    const { id, approvalId } = request.params as { id: string; approvalId: string };
    const body = request.body as {
      status?: string;
      notes?: string;
      approverUserId?: string;
    };

    const project = await verifyProject(id, request.auth.workspaceId);
    if (!project) return reply.status(404).send({ error: "Project not found" });

    const existing = await db.query.approvals.findFirst({
      where: and(eq(approvals.id, approvalId), eq(approvals.projectId, id)),
    });
    if (!existing) return reply.status(404).send({ error: "Approval not found" });

    // Only designated approver or admin can approve/reject
    if (body.status === "approved" || body.status === "rejected") {
      const isApprover = existing.approverUserId === request.auth.userId;
      const isAdmin = request.auth.role === "architect_admin";
      if (!isApprover && !isAdmin) {
        return reply.status(403).send({ error: "Only the designated approver or admin can approve/reject" });
      }
    }

    const updates: Record<string, unknown> = {};
    if (body.status) updates.status = body.status;
    if (body.notes !== undefined) updates.notes = body.notes;
    if (body.approverUserId) updates.approverUserId = body.approverUserId;

    if (body.status === "approved") {
      updates.approvedAt = new Date();
    }

    const [updated] = await db
      .update(approvals)
      .set(updates)
      .where(eq(approvals.id, approvalId))
      .returning();

    if (body.status === "approved" || body.status === "rejected") {
      await logAudit({
        workspaceId: request.auth.workspaceId,
        projectId: id,
        userId: request.auth.userId,
        action: `approval.${body.status}`,
        entityType: "approval",
        entityId: approvalId,
        beforeState: { status: existing.status, name: existing.name },
        afterState: { status: body.status },
      });

      if (existing.requestedBy && existing.requestedBy !== request.auth.userId) {
        await createNotification({
          workspaceId: request.auth.workspaceId,
          userId: existing.requestedBy,
          projectId: id,
          type: "approval_requested",
          title: `Approval "${existing.name}" was ${body.status}`,
          body: `On project "${project.name}"`,
          entityType: "approval",
          entityId: approvalId,
        });
      }
    }

    return { data: updated };
  });
}
