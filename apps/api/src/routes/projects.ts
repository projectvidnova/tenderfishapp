import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { db, projects, projectFacts, phases, gates } from "@tenderfish/db";
import { eq, and } from "drizzle-orm";
import { ensureProjectBootstrap, syncLatestDraftSpd } from "../services/project-bootstrap";
import { createProjectSchema, validateBody } from "../lib/validation";

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
