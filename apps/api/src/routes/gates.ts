import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import {
  db,
  projects,
  gates,
  approvals,
  users,
  documents,
  projectFacts,
  type GateCriterionStateSnapshot,
} from "@tenderfish/db";
import { eq, and, inArray } from "drizzle-orm";
import { logAudit } from "../utils/audit";
import { broadcastNotification, createNotification } from "../utils/notify";
import { gateOverrideSchema, validateBody } from "../lib/validation";
import { processFile, attestCriteriaFromEvidenceText } from "../services/ai-pipeline";
import { refreshAndAutoCompleteGates, syncPhasesFromGateCompletions } from "../services/gate-evaluator";
import { insertFactsFromProcessFileOutput } from "../services/process-file-facts";
import { rescanAllStoredProjectDocuments } from "../services/project-document-rescan";
import { tryPersistDocumentFileToStorage } from "../services/document-version-storage";
import { resolveDeclaredMimeType } from "../services/file-parser";

function isGateRowUuid(param: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    param
  );
}

async function verifyProject(projectId: string, workspaceId: string) {
  return db.query.projects.findFirst({
    where: and(eq(projects.id, projectId), eq(projects.workspaceId, workspaceId)),
  });
}


export async function gateRoutes(app: FastifyInstance) {
  // ─── GATES ──────────────────────────────────────────────────

  // GET /api/projects/:id/gates/detail — all gates with readiness % + attestation evidence
  app.get("/projects/:id/gates/detail", async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.auth) return reply.status(401).send({ error: "Unauthorized" });
    const { id } = request.params as { id: string };

    const project = await verifyProject(id, request.auth.workspaceId);
    if (!project) return reply.status(404).send({ error: "Project not found" });

    const [gateList, attestationFacts] = await Promise.all([
      db.query.gates.findMany({ where: eq(gates.projectId, id) }),
      db.query.projectFacts.findMany({
        where: and(
          eq(projectFacts.projectId, id),
          eq(projectFacts.fieldName, "gate_evidence_attestation")
        ),
      }),
    ]);

    // Index attestations by (gate, criterionKey). Most recent wins per pair.
    type Attestation = {
      supporting_quote: string;
      source_document_id: string;
      source_document_name?: string;
      reason: string;
    };
    const attIndex = new Map<string, Attestation>();
    const docIdsNeeded = new Set<string>();
    for (const fact of attestationFacts) {
      if (!fact.value) continue;
      try {
        const parsed = JSON.parse(fact.value) as {
          criterion_key?: unknown;
          gate?: unknown;
          supporting_quote?: unknown;
          source_document_id?: unknown;
          reason?: unknown;
        };
        const ckey = typeof parsed.criterion_key === "string" ? parsed.criterion_key : "";
        const gate = typeof parsed.gate === "string" ? parsed.gate : "";
        if (!ckey || !gate) continue;
        const key = `${gate}::${ckey}`;
        const att: Attestation = {
          supporting_quote:
            typeof parsed.supporting_quote === "string" ? parsed.supporting_quote : "",
          source_document_id:
            typeof parsed.source_document_id === "string" ? parsed.source_document_id : "",
          reason: typeof parsed.reason === "string" ? parsed.reason : "",
        };
        if (att.source_document_id) docIdsNeeded.add(att.source_document_id);
        attIndex.set(key, att);
      } catch {
        // Skip malformed attestation rows.
      }
    }

    // Look up document names so the UI can display "Confirmed by [doc]".
    const docNameById = new Map<string, string>();
    if (docIdsNeeded.size > 0) {
      const docRows = await db.query.documents.findMany({
        where: inArray(documents.id, [...docIdsNeeded]),
      });
      for (const d of docRows) docNameById.set(d.id, d.name);
    }

    const enriched = gateList.map((g) => {
      const criteria = g.criteria as GateCriterionStateSnapshot[];
      const enrichedCriteria = criteria.map((c) => {
        const att = attIndex.get(`${g.gate}::${c.key}`);
        if (!att) return c;
        return {
          ...c,
          attestation: {
            supporting_quote: att.supporting_quote,
            source_document_id: att.source_document_id,
            source_document_name: docNameById.get(att.source_document_id) ?? null,
            reason: att.reason,
          },
        };
      });
      const total = enrichedCriteria.length;
      const met = enrichedCriteria.filter((c) => c.met).length;
      return {
        ...g,
        criteria: enrichedCriteria,
        readinessPercent: total > 0 ? Math.round((met / total) * 100) : 0,
        criteriaCount: total,
        criteriaMet: met,
      };
    });

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
    const criteria = gateRecord.criteria as GateCriterionStateSnapshot[];
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

    // Advance the HOAI lifecycle journey shown on the project overview so phases
    // reflect the newly completed gate (e.g. completing Gate B marks LPH 1+2 complete
    // and sets LPH 3 active).
    await syncPhasesFromGateCompletions(id);

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

    // Advance the HOAI lifecycle journey for the override path too (overrides
    // count as gate progression for phase mapping purposes).
    await syncPhasesFromGateCompletions(id);

    return { data: updated };
  });

  // PATCH /api/projects/:id/gates/:gate/criteria/:key — blocked (algorithmic auditor: met is server-derived only)
  app.patch("/projects/:id/gates/:gate/criteria/:key", async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.auth) return reply.status(401).send({ error: "Unauthorized" });
    return reply.status(403).send({
      error: "Forbidden",
      message:
        "Gate criterion satisfaction is computed from project evidence (facts and intake). Manual check-off is not permitted.",
    });
  });

  app.put("/projects/:id/gates/:gate/criteria/:key", async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.auth) return reply.status(401).send({ error: "Unauthorized" });
    return reply.status(403).send({
      error: "Forbidden",
      message:
        "Gate criterion satisfaction is computed from project evidence (facts and intake). Manual check-off is not permitted.",
    });
  });

  // POST /api/projects/:id/gates/:gateRef/reverify
  // - If `gateRef` is a gate row UUID: re-run AI on all stored project documents and refresh gate criteria (no client criteria payload).
  // - Else `gateRef` is gate letter A–F: multipart upload of additional evidence (legacy).
  app.post("/projects/:id/gates/:gateRef/reverify", async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.auth) return reply.status(401).send({ error: "Unauthorized" });
    const { id, gateRef } = request.params as { id: string; gateRef: string };

    const project = await verifyProject(id, request.auth.workspaceId);
    if (!project) return reply.status(404).send({ error: "Project not found" });

    if (isGateRowUuid(gateRef)) {
      const gateRecord = await db.query.gates.findFirst({
        where: and(eq(gates.id, gateRef), eq(gates.projectId, id)),
      });
      if (!gateRecord) return reply.status(404).send({ error: "Gate not found" });

      try {
        const rescan = await rescanAllStoredProjectDocuments(id);

        const refreshedGate = await db.query.gates.findFirst({
          where: eq(gates.id, gateRef),
        });

        const criteria = (refreshedGate?.criteria || []) as GateCriterionStateSnapshot[];
        const total = criteria.length;
        const metCount = criteria.filter((c) => c.met).length;

        let rescanNotice: string | undefined;
        if (rescan.documentsProcessed === 0 && rescan.documentsSkipped > 0) {
          rescanNotice =
            "No project documents had a stored file to re-analyze. Configure S3 (IONOS Object Storage) and upload documents again, or add new evidence with files on this gate.";
        }

        return {
          data: {
            gate: refreshedGate
              ? {
                  ...refreshedGate,
                  readinessPercent: total > 0 ? Math.round((metCount / total) * 100) : 0,
                  criteriaCount: total,
                  criteriaMet: metCount,
                }
              : null,
            rescan,
            rescanNotice,
          },
        };
      } catch (err) {
        request.log.error({ err }, "rescanAllStoredProjectDocuments failed");
        return reply.status(500).send({
          error: "Document rescan failed",
          message: err instanceof Error ? err.message : "Unknown error",
        });
      }
    }

    const gateParam = gateRef;
    const gateRecord = await db.query.gates.findFirst({
      where: and(eq(gates.projectId, id), eq(gates.gate, gateParam as typeof gates.gate.enumValues[number])),
    });
    if (!gateRecord) return reply.status(404).send({ error: "Gate not found" });

    // Snapshot the unmet criteria BEFORE processing so we can ask the AI to
    // cross-reference uploaded evidence against them.
    const unmetCriteriaSnapshot = ((gateRecord.criteria || []) as GateCriterionStateSnapshot[])
      .filter((c) => !c.met)
      .map((c) => ({ key: c.key, label: c.label }));

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

    const insertedFactKeys = new Set<string>();

    for (const file of fileBuffers) {
      const resolvedMime = resolveDeclaredMimeType(file.name, file.mime);

      const [documentRecord] = await db
        .insert(documents)
        .values({
          projectId: id,
          name: file.name,
          type: resolvedMime,
          versions: [],
          sourceChannel: "gate_reverify_upload",
          confidence: 100,
        })
        .returning();

      const persisted = await tryPersistDocumentFileToStorage({
        workspaceId: request.auth.workspaceId,
        projectId: id,
        documentId: documentRecord.id,
        fileName: file.name,
        buffer: file.buffer,
        contentType: resolvedMime,
        uploadedBy: request.auth.userId ?? "system",
      });

      if (persisted) {
        await db
          .update(documents)
          .set({ versions: persisted, currentVersion: 1 })
          .where(eq(documents.id, documentRecord.id));
      }

      const processed = await processFile({
        project_id: id,
        document_id: documentRecord.id,
        file_name: file.name,
        mime_type: resolvedMime,
        buffer: file.buffer,
      });

      await insertFactsFromProcessFileOutput(id, documentRecord.id, processed, insertedFactKeys);

      // Cross-reference the document's parsed text with the gate's unmet criteria.
      // Each AI-confirmed match becomes a `gate_evidence_attestation` fact, which
      // gate-evaluator treats as direct satisfaction proof for that criterion.
      if (unmetCriteriaSnapshot.length > 0 && processed.text.trim().length > 0) {
        try {
          const attestations = await attestCriteriaFromEvidenceText(
            processed.text,
            unmetCriteriaSnapshot
          );
          for (const att of attestations) {
            if (!att.satisfied) continue;
            await db.insert(projectFacts).values({
              projectId: id,
              fieldName: "gate_evidence_attestation",
              value: JSON.stringify({
                criterion_key: att.key,
                gate: gateParam,
                supporting_quote: att.supportingQuote,
                reason: att.reason,
                source_document_id: documentRecord.id,
                truth_state: "inferred",
              }),
              dataState: "DERIVED",
              sourceRef: `document_id:${documentRecord.id} | gate_evidence_attestation:${att.key}`,
            });
          }
        } catch (attErr) {
          request.log.warn({ err: attErr }, "Gate criterion attestation failed; continuing.");
        }
      }
    }

    await refreshAndAutoCompleteGates(id);

    const refreshedGate = await db.query.gates.findFirst({
      where: and(eq(gates.projectId, id), eq(gates.gate, gateParam as typeof gates.gate.enumValues[number])),
    });

    const criteria = (refreshedGate?.criteria || []) as GateCriterionStateSnapshot[];
    const total = criteria.length;
    const metCount = criteria.filter((c) => c.met).length;

    return {
      data: {
        gate: refreshedGate
          ? {
              ...refreshedGate,
              readinessPercent: total > 0 ? Math.round((metCount / total) * 100) : 0,
              criteriaCount: total,
              criteriaMet: metCount,
            }
          : null,
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
