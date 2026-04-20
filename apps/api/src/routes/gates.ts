import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { db, projects, gates, approvals, users } from "@tenderfish/db";
import { eq, and, asc, inArray } from "drizzle-orm";
import { requireAccess } from "../middleware/rbac";
import { logAudit } from "../utils/audit";
import { broadcastNotification, createNotification } from "../utils/notify";
import { gateOverrideSchema, validateBody } from "../lib/validation";

async function verifyProject(projectId: string, workspaceId: string) {
  return db.query.projects.findFirst({
    where: and(eq(projects.id, projectId), eq(projects.workspaceId, workspaceId)),
  });
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
