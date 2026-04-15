import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { db, projects, phases, tasks, milestones, users } from "@tenderfish/db";
import { eq, and, asc, desc, inArray } from "drizzle-orm";

// Verify project ownership helper
async function verifyProject(projectId: string, workspaceId: string) {
  return db.query.projects.findFirst({
    where: and(eq(projects.id, projectId), eq(projects.workspaceId, workspaceId)),
  });
}

export async function phaseRoutes(app: FastifyInstance) {
  // ─── PHASES ─────────────────────────────────────────────────

  // GET /api/projects/:id/phases — all phases with task counts
  app.get("/projects/:id/phases/detail", async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.auth) return reply.status(401).send({ error: "Unauthorized" });
    const { id } = request.params as { id: string };

    const project = await verifyProject(id, request.auth.workspaceId);
    if (!project) return reply.status(404).send({ error: "Project not found" });

    const phaseList = await db.query.phases.findMany({
      where: eq(phases.projectId, id),
      orderBy: [asc(phases.lph)],
    });

    // Get all tasks for this project grouped by phase
    const allTasks = await db.query.tasks.findMany({
      where: eq(tasks.projectId, id),
      orderBy: [asc(tasks.name)],
    });

    const phasesWithCounts = phaseList.map((phase) => {
      const phaseTasks = allTasks.filter((t) => t.phaseId === phase.id);
      return {
        ...phase,
        taskCounts: {
          total: phaseTasks.length,
          complete: phaseTasks.filter((t) => t.status === "complete").length,
          inProgress: phaseTasks.filter((t) => t.status === "in_progress").length,
          notStarted: phaseTasks.filter((t) => t.status === "not_started").length,
        },
        requiredOutputs: phaseTasks.filter((t) => t.type === "required_output").length,
        workPackages: phaseTasks.filter((t) => t.type === "work_package").length,
        decisions: phaseTasks.filter((t) => t.type === "decision").length,
        documents: phaseTasks.filter((t) => t.type === "document").length,
      };
    });

    return { data: phasesWithCounts };
  });

  // PATCH /api/projects/:id/phases/:lph — update phase
  app.patch("/projects/:id/phases/:lph", async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.auth) return reply.status(401).send({ error: "Unauthorized" });
    const { id, lph } = request.params as { id: string; lph: string };
    const body = request.body as Record<string, unknown>;

    const project = await verifyProject(id, request.auth.workspaceId);
    if (!project) return reply.status(404).send({ error: "Project not found" });

    const lphNum = parseInt(lph, 10);
    if (isNaN(lphNum) || lphNum < 1 || lphNum > 9) {
      return reply.status(400).send({ error: "Invalid LPH number" });
    }

    const phase = await db.query.phases.findFirst({
      where: and(eq(phases.projectId, id), eq(phases.lph, lphNum)),
    });
    if (!phase) return reply.status(404).send({ error: "Phase not found" });

    // If trying to mark complete, verify all required outputs are complete
    if (body.status === "complete") {
      const requiredOutputs = await db.query.tasks.findMany({
        where: and(eq(tasks.phaseId, phase.id), eq(tasks.type, "required_output")),
      });
      const incomplete = requiredOutputs.filter((t) => t.status !== "complete");
      if (incomplete.length > 0) {
        return reply.status(400).send({
          error: "Cannot complete phase",
          message: `${incomplete.length} required output(s) are not complete`,
          incomplete: incomplete.map((t) => ({ id: t.id, name: t.name, status: t.status })),
        });
      }
    }

    const allowedFields = ["status", "startDate", "endDate", "dateDataState", "objective"];
    const updates: Record<string, unknown> = {};
    for (const field of allowedFields) {
      if (field in body) updates[field] = body[field];
    }

    if (Object.keys(updates).length === 0) {
      return reply.status(400).send({ error: "No valid fields to update" });
    }

    const [updated] = await db
      .update(phases)
      .set(updates)
      .where(eq(phases.id, phase.id))
      .returning();

    return { data: updated };
  });

  // ─── TASKS ──────────────────────────────────────────────────

  // GET /api/projects/:id/tasks — all tasks (filterable by phase, type)
  app.get("/projects/:id/tasks", async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.auth) return reply.status(401).send({ error: "Unauthorized" });
    const { id } = request.params as { id: string };
    const query = request.query as { phaseId?: string; type?: string; lph?: string };

    const project = await verifyProject(id, request.auth.workspaceId);
    if (!project) return reply.status(404).send({ error: "Project not found" });

    let phaseId = query.phaseId;

    // If lph is provided, resolve to phaseId
    if (query.lph && !phaseId) {
      const lphNum = parseInt(query.lph, 10);
      const phase = await db.query.phases.findFirst({
        where: and(eq(phases.projectId, id), eq(phases.lph, lphNum)),
      });
      if (phase) phaseId = phase.id;
    }

    const allTasks = await db.query.tasks.findMany({
      where: eq(tasks.projectId, id),
      orderBy: [asc(tasks.name)],
    });

    let filtered = allTasks;
    if (phaseId) filtered = filtered.filter((t) => t.phaseId === phaseId);
    if (query.type) filtered = filtered.filter((t) => t.type === query.type);

    // Enrich with user names
    const userIds = new Set<string>();
    filtered.forEach((t) => {
      if (t.ownerUserId) userIds.add(t.ownerUserId);
      if (t.reviewerUserId) userIds.add(t.reviewerUserId);
      if (t.approverUserId) userIds.add(t.approverUserId);
    });

    const userMap: Record<string, string> = {};
    if (userIds.size > 0) {
      const userList = await db.query.users.findMany({
        where: inArray(users.id, Array.from(userIds)),
      });
      userList.forEach((u) => { userMap[u.id] = u.name; });
    }

    const enriched = filtered.map((t) => ({
      ...t,
      ownerName: t.ownerUserId ? userMap[t.ownerUserId] || null : null,
      reviewerName: t.reviewerUserId ? userMap[t.reviewerUserId] || null : null,
      approverName: t.approverUserId ? userMap[t.approverUserId] || null : null,
    }));

    return { data: enriched };
  });

  // POST /api/projects/:id/tasks — create task
  app.post("/projects/:id/tasks", async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.auth) return reply.status(401).send({ error: "Unauthorized" });
    const { id } = request.params as { id: string };
    const body = request.body as {
      phaseId?: string;
      lph?: number;
      name: string;
      description?: string;
      type?: string;
      ownerUserId?: string;
      reviewerUserId?: string;
      approverUserId?: string;
      dueDate?: string;
      dependencies?: string[];
      evidenceRequired?: boolean;
      decisionMaker?: string;
      documentType?: string;
      documentRequiredFor?: string;
      raciResponsible?: string;
      raciAccountable?: string;
      raciConsulted?: string[];
      raciInformed?: string[];
    };

    const project = await verifyProject(id, request.auth.workspaceId);
    if (!project) return reply.status(404).send({ error: "Project not found" });

    if (!body.name?.trim()) {
      return reply.status(400).send({ error: "Task name is required" });
    }

    let phaseId = body.phaseId;
    if (!phaseId && body.lph) {
      const phase = await db.query.phases.findFirst({
        where: and(eq(phases.projectId, id), eq(phases.lph, body.lph)),
      });
      if (phase) phaseId = phase.id;
    }
    if (!phaseId) {
      return reply.status(400).send({ error: "phaseId or lph is required" });
    }

    const [task] = await db
      .insert(tasks)
      .values({
        projectId: id,
        phaseId,
        name: body.name.trim(),
        description: body.description,
        type: (body.type as typeof tasks.type.enumValues[number]) || "work_package",
        ownerUserId: body.ownerUserId,
        reviewerUserId: body.reviewerUserId,
        approverUserId: body.approverUserId,
        dueDate: body.dueDate,
        dependencies: body.dependencies || [],
        evidenceRequired: body.evidenceRequired || false,
        decisionMaker: body.decisionMaker,
        documentType: body.documentType,
        documentRequiredFor: body.documentRequiredFor,
        raciResponsible: body.raciResponsible,
        raciAccountable: body.raciAccountable,
        raciConsulted: body.raciConsulted || [],
        raciInformed: body.raciInformed || [],
      })
      .returning();

    return reply.status(201).send({ data: task });
  });

  // PATCH /api/projects/:id/tasks/:taskId — update task
  app.patch("/projects/:id/tasks/:taskId", async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.auth) return reply.status(401).send({ error: "Unauthorized" });
    const { id, taskId } = request.params as { id: string; taskId: string };
    const body = request.body as Record<string, unknown>;

    const project = await verifyProject(id, request.auth.workspaceId);
    if (!project) return reply.status(404).send({ error: "Project not found" });

    const existing = await db.query.tasks.findFirst({
      where: and(eq(tasks.id, taskId), eq(tasks.projectId, id)),
    });
    if (!existing) return reply.status(404).send({ error: "Task not found" });

    const allowedFields = [
      "name", "description", "type", "status",
      "ownerUserId", "reviewerUserId", "approverUserId",
      "dueDate", "dependencies", "evidenceRef", "evidenceRequired",
      "decisionMaker", "decisionStatus", "decisionNotes",
      "documentType", "documentRequiredFor", "documentFileRef",
      "raciResponsible", "raciAccountable", "raciConsulted", "raciInformed",
    ];

    const updates: Record<string, unknown> = {};
    for (const field of allowedFields) {
      if (field in body) updates[field] = body[field];
    }

    if (Object.keys(updates).length === 0) {
      return reply.status(400).send({ error: "No valid fields to update" });
    }

    const [updated] = await db
      .update(tasks)
      .set(updates)
      .where(eq(tasks.id, taskId))
      .returning();

    return { data: updated };
  });

  // DELETE /api/projects/:id/tasks/:taskId
  app.delete("/projects/:id/tasks/:taskId", async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.auth) return reply.status(401).send({ error: "Unauthorized" });
    const { id, taskId } = request.params as { id: string; taskId: string };

    const project = await verifyProject(id, request.auth.workspaceId);
    if (!project) return reply.status(404).send({ error: "Project not found" });

    const existing = await db.query.tasks.findFirst({
      where: and(eq(tasks.id, taskId), eq(tasks.projectId, id)),
    });
    if (!existing) return reply.status(404).send({ error: "Task not found" });

    await db.delete(tasks).where(eq(tasks.id, taskId));
    return { success: true };
  });

  // ─── MILESTONES ─────────────────────────────────────────────

  // GET /api/projects/:id/milestones
  app.get("/projects/:id/milestones", async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.auth) return reply.status(401).send({ error: "Unauthorized" });
    const { id } = request.params as { id: string };

    const project = await verifyProject(id, request.auth.workspaceId);
    if (!project) return reply.status(404).send({ error: "Project not found" });

    const milestoneList = await db.query.milestones.findMany({
      where: eq(milestones.projectId, id),
      orderBy: [asc(milestones.date)],
    });

    // Enrich with phase info
    const phaseIds = [...new Set(milestoneList.filter((m) => m.relatedPhaseId).map((m) => m.relatedPhaseId!))];
    const phaseMap: Record<string, { lph: number; objective: string }> = {};
    if (phaseIds.length > 0) {
      const phaseList = await db.query.phases.findMany({
        where: inArray(phases.id, phaseIds),
      });
      phaseList.forEach((p) => { phaseMap[p.id] = { lph: p.lph, objective: p.objective }; });
    }

    const enriched = milestoneList.map((m) => ({
      ...m,
      phaseLph: m.relatedPhaseId ? phaseMap[m.relatedPhaseId]?.lph : null,
    }));

    return { data: enriched };
  });

  // POST /api/projects/:id/milestones
  app.post("/projects/:id/milestones", async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.auth) return reply.status(401).send({ error: "Unauthorized" });
    const { id } = request.params as { id: string };
    const body = request.body as {
      name: string;
      date: string;
      type: string;
      ownerUserId?: string;
      relatedGate?: string;
      relatedPhaseId?: string;
      dataState?: string;
    };

    const project = await verifyProject(id, request.auth.workspaceId);
    if (!project) return reply.status(404).send({ error: "Project not found" });

    if (!body.name?.trim() || !body.date || !body.type) {
      return reply.status(400).send({ error: "name, date, and type are required" });
    }

    const [milestone] = await db
      .insert(milestones)
      .values({
        projectId: id,
        name: body.name.trim(),
        date: body.date,
        type: body.type as typeof milestones.type.enumValues[number],
        ownerUserId: body.ownerUserId,
        relatedGate: body.relatedGate,
        relatedPhaseId: body.relatedPhaseId,
        dataState: (body.dataState as typeof milestones.dataState.enumValues[number]) || "DERIVED",
      })
      .returning();

    return reply.status(201).send({ data: milestone });
  });

  // PATCH /api/projects/:id/milestones/:milestoneId
  app.patch("/projects/:id/milestones/:milestoneId", async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.auth) return reply.status(401).send({ error: "Unauthorized" });
    const { id, milestoneId } = request.params as { id: string; milestoneId: string };
    const body = request.body as Record<string, unknown>;

    const project = await verifyProject(id, request.auth.workspaceId);
    if (!project) return reply.status(404).send({ error: "Project not found" });

    const existing = await db.query.milestones.findFirst({
      where: and(eq(milestones.id, milestoneId), eq(milestones.projectId, id)),
    });
    if (!existing) return reply.status(404).send({ error: "Milestone not found" });

    const allowedFields = ["name", "date", "type", "ownerUserId", "relatedGate", "relatedPhaseId", "dataState", "status"];
    const updates: Record<string, unknown> = {};
    for (const field of allowedFields) {
      if (field in body) updates[field] = body[field];
    }

    if (Object.keys(updates).length === 0) {
      return reply.status(400).send({ error: "No valid fields to update" });
    }

    const [updated] = await db
      .update(milestones)
      .set(updates)
      .where(eq(milestones.id, milestoneId))
      .returning();

    return { data: updated };
  });

  // DELETE /api/projects/:id/milestones/:milestoneId
  app.delete("/projects/:id/milestones/:milestoneId", async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.auth) return reply.status(401).send({ error: "Unauthorized" });
    const { id, milestoneId } = request.params as { id: string; milestoneId: string };

    const project = await verifyProject(id, request.auth.workspaceId);
    if (!project) return reply.status(404).send({ error: "Project not found" });

    const existing = await db.query.milestones.findFirst({
      where: and(eq(milestones.id, milestoneId), eq(milestones.projectId, id)),
    });
    if (!existing) return reply.status(404).send({ error: "Milestone not found" });

    await db.delete(milestones).where(eq(milestones.id, milestoneId));
    return { success: true };
  });

  // ─── RACI / RESPONSIBILITIES ────────────────────────────────

  // GET /api/projects/:id/responsibilities — aggregated RACI matrix
  app.get("/projects/:id/responsibilities", async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.auth) return reply.status(401).send({ error: "Unauthorized" });
    const { id } = request.params as { id: string };
    const query = request.query as { lph?: string; role?: string; unassigned?: string };

    const project = await verifyProject(id, request.auth.workspaceId);
    if (!project) return reply.status(404).send({ error: "Project not found" });

    // Get all work package and required output tasks
    let taskList = await db.query.tasks.findMany({
      where: eq(tasks.projectId, id),
      orderBy: [asc(tasks.name)],
    });

    // Filter by type — only show work packages and required outputs in RACI
    taskList = taskList.filter((t) => t.type === "work_package" || t.type === "required_output");

    // Get phases for LPH mapping
    const phaseList = await db.query.phases.findMany({
      where: eq(phases.projectId, id),
      orderBy: [asc(phases.lph)],
    });
    const phaseMap: Record<string, number> = {};
    phaseList.forEach((p) => { phaseMap[p.id] = p.lph; });

    // Filter by LPH
    if (query.lph && query.lph !== "all") {
      const lphNum = parseInt(query.lph, 10);
      const matchingPhaseIds = phaseList.filter((p) => p.lph === lphNum).map((p) => p.id);
      taskList = taskList.filter((t) => matchingPhaseIds.includes(t.phaseId));
    }

    // Filter by unassigned
    if (query.unassigned === "true") {
      taskList = taskList.filter((t) => !t.raciResponsible);
    }

    const unassignedCount = taskList.filter((t) => !t.raciResponsible).length;

    const rows = taskList.map((t) => ({
      id: t.id,
      name: t.name,
      type: t.type,
      phaseLph: phaseMap[t.phaseId] || null,
      status: t.status,
      raciResponsible: t.raciResponsible,
      raciAccountable: t.raciAccountable,
      raciConsulted: t.raciConsulted,
      raciInformed: t.raciInformed,
    }));

    return {
      data: {
        rows,
        unassignedCount,
        totalCount: rows.length,
      },
    };
  });

  // PATCH /api/projects/:id/tasks/:taskId/raci — update RACI for a task
  app.patch("/projects/:id/tasks/:taskId/raci", async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.auth) return reply.status(401).send({ error: "Unauthorized" });
    const { id, taskId } = request.params as { id: string; taskId: string };
    const body = request.body as {
      raciResponsible?: string;
      raciAccountable?: string;
      raciConsulted?: string[];
      raciInformed?: string[];
    };

    const project = await verifyProject(id, request.auth.workspaceId);
    if (!project) return reply.status(404).send({ error: "Project not found" });

    const existing = await db.query.tasks.findFirst({
      where: and(eq(tasks.id, taskId), eq(tasks.projectId, id)),
    });
    if (!existing) return reply.status(404).send({ error: "Task not found" });

    const updates: Record<string, unknown> = {};
    if ("raciResponsible" in body) updates.raciResponsible = body.raciResponsible;
    if ("raciAccountable" in body) updates.raciAccountable = body.raciAccountable;
    if ("raciConsulted" in body) updates.raciConsulted = body.raciConsulted;
    if ("raciInformed" in body) updates.raciInformed = body.raciInformed;

    const [updated] = await db
      .update(tasks)
      .set(updates)
      .where(eq(tasks.id, taskId))
      .returning();

    return { data: updated };
  });
}
