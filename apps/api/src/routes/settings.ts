import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { db, workspaces, users, auditLogs, notifications, projects } from "@tenderfish/db";
import { eq, and, desc } from "drizzle-orm";

export async function settingsRoutes(app: FastifyInstance) {
  // ─── WORKSPACE SETTINGS ──────────────────────────────────

  // GET /api/settings/workspace
  app.get("/settings/workspace", async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.auth) return reply.status(401).send({ error: "Unauthorized" });

    const workspace = await db.query.workspaces.findFirst({
      where: eq(workspaces.id, request.auth.workspaceId),
    });
    if (!workspace) return reply.status(404).send({ error: "Workspace not found" });

    return { data: workspace };
  });

  // PATCH /api/settings/workspace
  app.patch("/settings/workspace", async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.auth) return reply.status(401).send({ error: "Unauthorized" });
    const body = request.body as { name?: string };

    const updates: Record<string, unknown> = {};
    if (body.name !== undefined) updates.name = body.name;

    const [updated] = await db
      .update(workspaces)
      .set(updates)
      .where(eq(workspaces.id, request.auth.workspaceId))
      .returning();

    return { data: updated };
  });

  // ─── TEAM ────────────────────────────────────────────────

  // GET /api/settings/team
  app.get("/settings/team", async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.auth) return reply.status(401).send({ error: "Unauthorized" });

    const members = await db.query.users.findMany({
      where: eq(users.workspaceId, request.auth.workspaceId),
    });

    return { data: members };
  });

  // ─── AUDIT LOG ───────────────────────────────────────────

  // GET /api/settings/audit-log
  app.get("/settings/audit-log", async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.auth) return reply.status(401).send({ error: "Unauthorized" });
    const { userId, projectId, action } = request.query as {
      userId?: string;
      projectId?: string;
      action?: string;
    };

    let logs = await db.query.auditLogs.findMany({
      where: eq(auditLogs.workspaceId, request.auth.workspaceId),
      orderBy: [desc(auditLogs.createdAt)],
    });

    if (userId) logs = logs.filter((l) => l.userId === userId);
    if (projectId) logs = logs.filter((l) => l.projectId === projectId);
    if (action) logs = logs.filter((l) => l.action.includes(action));

    // Enrich with user name
    const enriched = await Promise.all(
      logs.map(async (l) => {
        const user = await db.query.users.findFirst({ where: eq(users.id, l.userId) });
        let projectName: string | null = null;
        if (l.projectId) {
          const proj = await db.query.projects.findFirst({ where: eq(projects.id, l.projectId) });
          projectName = proj?.name || null;
        }
        return { ...l, userName: user?.name || "Unknown", projectName };
      })
    );

    return { data: enriched };
  });
}
