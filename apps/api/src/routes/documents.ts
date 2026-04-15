import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { db, projects, documents, risks, delayEvents, users } from "@tenderfish/db";
import { eq, and, asc, desc } from "drizzle-orm";
import { logAudit } from "../utils/audit";

async function verifyProject(projectId: string, workspaceId: string) {
  return db.query.projects.findFirst({
    where: and(eq(projects.id, projectId), eq(projects.workspaceId, workspaceId)),
  });
}

export async function documentRoutes(app: FastifyInstance) {
  // ─── DOCUMENTS ──────────────────────────────────────────────

  // GET /api/projects/:id/documents
  app.get("/projects/:id/documents", async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.auth) return reply.status(401).send({ error: "Unauthorized" });
    const { id } = request.params as { id: string };
    const { type } = request.query as { type?: string };

    const project = await verifyProject(id, request.auth.workspaceId);
    if (!project) return reply.status(404).send({ error: "Project not found" });

    const list = await db.query.documents.findMany({
      where: eq(documents.projectId, id),
    });

    const filtered = type ? list.filter((d) => d.type === type) : list;

    // Enrich with creator name
    const enriched = await Promise.all(
      filtered.map(async (doc) => {
        const creator = doc.createdBy
          ? await db.query.users.findFirst({ where: eq(users.id, doc.createdBy) })
          : null;
        return { ...doc, createdByName: creator?.name || null };
      })
    );

    return { data: enriched };
  });

  // POST /api/projects/:id/documents
  app.post("/projects/:id/documents", async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.auth) return reply.status(401).send({ error: "Unauthorized" });
    const { id } = request.params as { id: string };
    const body = request.body as {
      name: string;
      type: string;
      relatedPhaseId?: string;
      relatedPackageId?: string;
    };

    const project = await verifyProject(id, request.auth.workspaceId);
    if (!project) return reply.status(404).send({ error: "Project not found" });

    if (!body.name?.trim() || !body.type?.trim()) {
      return reply.status(400).send({ error: "Name and type are required" });
    }

    const [created] = await db
      .insert(documents)
      .values({
        projectId: id,
        name: body.name.trim(),
        type: body.type.trim(),
        createdBy: request.auth.userId,
        relatedPhaseId: body.relatedPhaseId || null,
        relatedPackageId: body.relatedPackageId || null,
        versions: [
          {
            version: 1,
            date: new Date().toISOString(),
            uploadedBy: request.auth.userId,
            status: "draft",
            filePath: "",
          },
        ],
      })
      .returning();

    await logAudit({
      workspaceId: request.auth.workspaceId,
      projectId: id,
      userId: request.auth.userId,
      action: "document.create",
      entityType: "document",
      entityId: created.id,
      afterState: { name: created.name, type: created.type },
    });

    return reply.status(201).send({ data: created });
  });

  // POST /api/projects/:id/documents/:docId/versions — upload new version
  app.post("/projects/:id/documents/:docId/versions", async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.auth) return reply.status(401).send({ error: "Unauthorized" });
    const { id, docId } = request.params as { id: string; docId: string };
    const body = request.body as { changesNote?: string };

    const project = await verifyProject(id, request.auth.workspaceId);
    if (!project) return reply.status(404).send({ error: "Project not found" });

    const doc = await db.query.documents.findFirst({
      where: and(eq(documents.id, docId), eq(documents.projectId, id)),
    });
    if (!doc) return reply.status(404).send({ error: "Document not found" });

    const currentVersions = (doc.versions || []) as {
      version: number;
      date: string;
      uploadedBy: string;
      status: string;
      changesNote?: string;
      filePath: string;
    }[];
    const newVersion = currentVersions.length + 1;

    const updatedVersions = [
      ...currentVersions,
      {
        version: newVersion,
        date: new Date().toISOString(),
        uploadedBy: request.auth.userId,
        status: "draft",
        changesNote: body.changesNote || undefined,
        filePath: "",
      },
    ];

    const [updated] = await db
      .update(documents)
      .set({
        versions: updatedVersions,
        currentVersion: newVersion,
      })
      .where(eq(documents.id, docId))
      .returning();

    return { data: updated };
  });

  // PATCH /api/projects/:id/documents/:docId — update status, name, etc.
  app.patch("/projects/:id/documents/:docId", async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.auth) return reply.status(401).send({ error: "Unauthorized" });
    const { id, docId } = request.params as { id: string; docId: string };
    const body = request.body as {
      name?: string;
      status?: string;
      type?: string;
    };

    const project = await verifyProject(id, request.auth.workspaceId);
    if (!project) return reply.status(404).send({ error: "Project not found" });

    const doc = await db.query.documents.findFirst({
      where: and(eq(documents.id, docId), eq(documents.projectId, id)),
    });
    if (!doc) return reply.status(404).send({ error: "Document not found" });

    const updates: Record<string, unknown> = {};
    if (body.name !== undefined) updates.name = body.name;
    if (body.type !== undefined) updates.type = body.type;
    if (body.status !== undefined) updates.status = body.status;

    const [updated] = await db
      .update(documents)
      .set(updates)
      .where(eq(documents.id, docId))
      .returning();

    if (body.status !== undefined) {
      await logAudit({
        workspaceId: request.auth.workspaceId,
        projectId: id,
        userId: request.auth.userId,
        action: "document.status_change",
        entityType: "document",
        entityId: docId,
        beforeState: { status: doc.status },
        afterState: { status: body.status },
      });
    }

    return { data: updated };
  });

  // DELETE /api/projects/:id/documents/:docId
  app.delete("/projects/:id/documents/:docId", async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.auth) return reply.status(401).send({ error: "Unauthorized" });
    const { id, docId } = request.params as { id: string; docId: string };

    const project = await verifyProject(id, request.auth.workspaceId);
    if (!project) return reply.status(404).send({ error: "Project not found" });

    const docToDelete = await db.query.documents.findFirst({
      where: and(eq(documents.id, docId), eq(documents.projectId, id)),
    });

    await db.delete(documents).where(and(eq(documents.id, docId), eq(documents.projectId, id)));

    await logAudit({
      workspaceId: request.auth.workspaceId,
      projectId: id,
      userId: request.auth.userId,
      action: "document.delete",
      entityType: "document",
      entityId: docId,
      beforeState: docToDelete ? { name: docToDelete.name, type: docToDelete.type } : {},
    });

    return { success: true };
  });

  // ─── RISKS ──────────────────────────────────────────────────

  // GET /api/projects/:id/risks
  app.get("/projects/:id/risks", async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.auth) return reply.status(401).send({ error: "Unauthorized" });
    const { id } = request.params as { id: string };

    const project = await verifyProject(id, request.auth.workspaceId);
    if (!project) return reply.status(404).send({ error: "Project not found" });

    const list = await db.query.risks.findMany({
      where: eq(risks.projectId, id),
    });

    const enriched = await Promise.all(
      list.map(async (r) => {
        const owner = r.ownerUserId
          ? await db.query.users.findFirst({ where: eq(users.id, r.ownerUserId) })
          : null;
        // Risk score: L=1,M=2,H=3 → product
        const pVal = { low: 1, medium: 2, high: 3 }[r.probability] || 2;
        const iVal = { low: 1, medium: 2, high: 3 }[r.impact] || 2;
        return {
          ...r,
          ownerName: owner?.name || null,
          riskScore: pVal * iVal,
        };
      })
    );

    return { data: enriched };
  });

  // POST /api/projects/:id/risks
  app.post("/projects/:id/risks", async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.auth) return reply.status(401).send({ error: "Unauthorized" });
    const { id } = request.params as { id: string };
    const body = request.body as {
      name: string;
      category: string;
      description?: string;
      probability?: string;
      impact?: string;
      ownerUserId?: string;
      mitigationAction?: string;
    };

    const project = await verifyProject(id, request.auth.workspaceId);
    if (!project) return reply.status(404).send({ error: "Project not found" });

    if (!body.name?.trim() || !body.category) {
      return reply.status(400).send({ error: "Name and category are required" });
    }

    const [created] = await db
      .insert(risks)
      .values({
        projectId: id,
        name: body.name.trim(),
        category: body.category as any,
        description: body.description || null,
        probability: (body.probability as any) || "medium",
        impact: (body.impact as any) || "medium",
        ownerUserId: body.ownerUserId || null,
        mitigationAction: body.mitigationAction || null,
      })
      .returning();

    return reply.status(201).send({ data: created });
  });

  // PATCH /api/projects/:id/risks/:riskId
  app.patch("/projects/:id/risks/:riskId", async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.auth) return reply.status(401).send({ error: "Unauthorized" });
    const { id, riskId } = request.params as { id: string; riskId: string };
    const body = request.body as {
      name?: string;
      category?: string;
      description?: string;
      probability?: string;
      impact?: string;
      ownerUserId?: string;
      status?: string;
      mitigationAction?: string;
    };

    const project = await verifyProject(id, request.auth.workspaceId);
    if (!project) return reply.status(404).send({ error: "Project not found" });

    const existing = await db.query.risks.findFirst({
      where: and(eq(risks.id, riskId), eq(risks.projectId, id)),
    });
    if (!existing) return reply.status(404).send({ error: "Risk not found" });

    const updates: Record<string, unknown> = {};
    if (body.name !== undefined) updates.name = body.name;
    if (body.category !== undefined) updates.category = body.category;
    if (body.description !== undefined) updates.description = body.description;
    if (body.probability !== undefined) updates.probability = body.probability;
    if (body.impact !== undefined) updates.impact = body.impact;
    if (body.ownerUserId !== undefined) updates.ownerUserId = body.ownerUserId;
    if (body.status !== undefined) updates.status = body.status;
    if (body.mitigationAction !== undefined) updates.mitigationAction = body.mitigationAction;

    const [updated] = await db
      .update(risks)
      .set(updates)
      .where(eq(risks.id, riskId))
      .returning();

    return { data: updated };
  });

  // DELETE /api/projects/:id/risks/:riskId
  app.delete("/projects/:id/risks/:riskId", async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.auth) return reply.status(401).send({ error: "Unauthorized" });
    const { id, riskId } = request.params as { id: string; riskId: string };

    const project = await verifyProject(id, request.auth.workspaceId);
    if (!project) return reply.status(404).send({ error: "Project not found" });

    await db.delete(risks).where(and(eq(risks.id, riskId), eq(risks.projectId, id)));
    return { success: true };
  });

  // ─── DELAYS ─────────────────────────────────────────────────

  // GET /api/projects/:id/delays
  app.get("/projects/:id/delays", async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.auth) return reply.status(401).send({ error: "Unauthorized" });
    const { id } = request.params as { id: string };

    const project = await verifyProject(id, request.auth.workspaceId);
    if (!project) return reply.status(404).send({ error: "Project not found" });

    const list = await db.query.delayEvents.findMany({
      where: eq(delayEvents.projectId, id),
    });

    // Summary stats
    const totalEvents = list.length;
    const totalImpactDays = list.reduce((sum, d) => sum + d.scheduleImpactDays, 0);
    const byCause: Record<string, number> = {};
    const byStatus: Record<string, number> = {};
    for (const d of list) {
      byCause[d.causeCategory] = (byCause[d.causeCategory] || 0) + 1;
      byStatus[d.status] = (byStatus[d.status] || 0) + 1;
    }

    return {
      data: list,
      summary: { totalEvents, totalImpactDays, byCause, byStatus },
    };
  });

  // POST /api/projects/:id/delays
  app.post("/projects/:id/delays", async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.auth) return reply.status(401).send({ error: "Unauthorized" });
    const { id } = request.params as { id: string };
    const body = request.body as {
      eventDate: string;
      reportedBy: string;
      description: string;
      causeCategory: string;
      affectedTasks?: string[];
      scheduleImpactDays?: number;
      initialResponsibility?: string;
    };

    const project = await verifyProject(id, request.auth.workspaceId);
    if (!project) return reply.status(404).send({ error: "Project not found" });

    if (!body.eventDate || !body.reportedBy || !body.description || !body.causeCategory) {
      return reply.status(400).send({ error: "eventDate, reportedBy, description, and causeCategory are required" });
    }

    const [created] = await db
      .insert(delayEvents)
      .values({
        projectId: id,
        eventDate: body.eventDate,
        reportedBy: body.reportedBy,
        description: body.description,
        causeCategory: body.causeCategory as any,
        affectedTasks: body.affectedTasks || [],
        scheduleImpactDays: body.scheduleImpactDays || 0,
        initialResponsibility: body.initialResponsibility || null,
      })
      .returning();

    return reply.status(201).send({ data: created });
  });

  // PATCH /api/projects/:id/delays/:delayId
  app.patch("/projects/:id/delays/:delayId", async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.auth) return reply.status(401).send({ error: "Unauthorized" });
    const { id, delayId } = request.params as { id: string; delayId: string };
    const body = request.body as {
      description?: string;
      causeCategory?: string;
      scheduleImpactDays?: number;
      status?: string;
      initialResponsibility?: string;
    };

    const project = await verifyProject(id, request.auth.workspaceId);
    if (!project) return reply.status(404).send({ error: "Project not found" });

    const existing = await db.query.delayEvents.findFirst({
      where: and(eq(delayEvents.id, delayId), eq(delayEvents.projectId, id)),
    });
    if (!existing) return reply.status(404).send({ error: "Delay event not found" });

    const updates: Record<string, unknown> = {};
    if (body.description !== undefined) updates.description = body.description;
    if (body.causeCategory !== undefined) updates.causeCategory = body.causeCategory;
    if (body.scheduleImpactDays !== undefined) updates.scheduleImpactDays = body.scheduleImpactDays;
    if (body.status !== undefined) updates.status = body.status;
    if (body.initialResponsibility !== undefined) updates.initialResponsibility = body.initialResponsibility;

    const [updated] = await db
      .update(delayEvents)
      .set(updates)
      .where(eq(delayEvents.id, delayId))
      .returning();

    return { data: updated };
  });
}
