import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { db, projects, projectFacts, phases, gates } from "@tenderfish/db";
import { eq, and } from "drizzle-orm";
import { GATE_DEFINITIONS, LPH_PHASES } from "@tenderfish/shared";
import type { GateLetter, LphNumber } from "@tenderfish/shared";

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

    const body = request.body as {
      name: string;
      type?: string;
      location?: string;
      clientName?: string;
      procurementModel?: string;
      targetCompletion?: string;
      objective?: string;
      scopeSummary?: string;
    };

    if (!body.name?.trim()) {
      return reply.status(400).send({ error: "Project name is required" });
    }

    // Create project
    const [project] = await db
      .insert(projects)
      .values({
        workspaceId: request.auth.workspaceId,
        name: body.name.trim(),
        type: (body.type as typeof projects.type.enumValues[number]) || "not_sure",
        location: body.location,
        clientName: body.clientName,
        procurementModel:
          (body.procurementModel as typeof projects.procurementModel.enumValues[number]) || "unclear",
        targetCompletion: body.targetCompletion,
        objective: body.objective,
        scopeSummary: body.scopeSummary,
      })
      .returning();

    // Create default gates (A–F)
    const gateLetters: GateLetter[] = ["A", "B", "C", "D", "E", "F"];
    await db.insert(gates).values(
      gateLetters.map((letter) => ({
        projectId: project.id,
        gate: letter,
        status: letter === "A" ? ("in_progress" as const) : ("locked" as const),
        criteria: GATE_DEFINITIONS[letter].defaultCriteria.map((c) => ({
          ...c,
          met: false,
        })),
      }))
    );

    // Create default phases (LPH 1–9)
    const lphNumbers: LphNumber[] = [1, 2, 3, 4, 5, 6, 7, 8, 9];
    await db.insert(phases).values(
      lphNumbers.map((lph) => ({
        projectId: project.id,
        lph,
        status: "not_started" as const,
        objective: LPH_PHASES[lph].objective,
      }))
    );

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

  // PATCH /api/projects/:id/facts/:factId — update fact
  app.patch("/projects/:id/facts/:factId", async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.auth) {
      return reply.status(401).send({ error: "Unauthorized" });
    }

    const { id, factId } = request.params as { id: string; factId: string };
    const body = request.body as { value?: string; dataState?: string };

    // Verify project belongs to workspace
    const project = await db.query.projects.findFirst({
      where: and(eq(projects.id, id), eq(projects.workspaceId, request.auth.workspaceId)),
    });

    if (!project) {
      return reply.status(404).send({ error: "Project not found" });
    }

    const updates: Record<string, unknown> = {};
    if ("value" in body) updates.value = body.value;
    if ("dataState" in body) updates.dataState = body.dataState;

    const [updated] = await db
      .update(projectFacts)
      .set(updates)
      .where(eq(projectFacts.id, factId))
      .returning();

    return { data: updated };
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
