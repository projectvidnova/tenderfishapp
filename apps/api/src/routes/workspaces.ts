import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { db, workspaces } from "@tenderfish/db";
import { eq } from "drizzle-orm";

export async function workspaceRoutes(app: FastifyInstance) {
  // GET /api/workspaces/me — current workspace
  app.get("/workspaces/me", async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.auth) {
      return reply.status(401).send({ error: "Unauthorized" });
    }

    const workspace = await db.query.workspaces.findFirst({
      where: eq(workspaces.id, request.auth.workspaceId),
    });

    if (!workspace) {
      return reply.status(404).send({ error: "Workspace not found" });
    }

    return { data: workspace };
  });

  // PATCH /api/workspaces/me — update workspace
  app.patch("/workspaces/me", async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.auth) {
      return reply.status(401).send({ error: "Unauthorized" });
    }

    if (request.auth.role !== "architect_admin") {
      return reply.status(403).send({ error: "Forbidden", message: "Only Architect Admins can update workspace settings" });
    }

    const body = request.body as Record<string, unknown>;

    // Only allow specific fields to be updated
    const allowedFields = ["name", "street", "city", "postcode", "country", "taxId", "logoUrl", "defaultTimezone"];
    const updates: Record<string, unknown> = {};
    for (const field of allowedFields) {
      if (field in body) {
        updates[field] = body[field];
      }
    }

    if (Object.keys(updates).length === 0) {
      return reply.status(400).send({ error: "No valid fields to update" });
    }

    const [updated] = await db
      .update(workspaces)
      .set(updates)
      .where(eq(workspaces.id, request.auth.workspaceId))
      .returning();

    return { data: updated };
  });
}
