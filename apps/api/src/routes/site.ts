import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { db, constructionDiaryEntries, projects } from "@tenderfish/db";
import { and, desc, eq } from "drizzle-orm";
import {
  createDiaryEntrySchema,
  updateDiaryEntrySchema,
  validateBody,
} from "../lib/validation";
import { logAudit } from "../utils/audit";

// Construction diary (Bautagebuch). Delays/risks live in documents.ts;
// execution submissions live in reviews.ts.

async function ensureProjectInWorkspace(
  projectId: string,
  workspaceId: string
): Promise<{ id: string } | null> {
  const [row] = await db
    .select({ id: projects.id })
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.workspaceId, workspaceId)))
    .limit(1);
  return row ?? null;
}

export async function siteRoutes(app: FastifyInstance) {
  app.get(
    "/projects/:id/construction-diary-entries",
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      if (!request.auth) return reply.status(401).send({ error: "Unauthorized" });
      const project = await ensureProjectInWorkspace(request.params.id, request.auth.workspaceId);
      if (!project) return reply.status(404).send({ error: "Project not found" });

      const rows = await db
        .select()
        .from(constructionDiaryEntries)
        .where(eq(constructionDiaryEntries.projectId, request.params.id))
        .orderBy(desc(constructionDiaryEntries.entryDate));
      return { data: rows };
    }
  );

  app.post(
    "/projects/:id/construction-diary-entries",
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      if (!request.auth) return reply.status(401).send({ error: "Unauthorized" });
      const project = await ensureProjectInWorkspace(request.params.id, request.auth.workspaceId);
      if (!project) return reply.status(404).send({ error: "Project not found" });

      const parsed = validateBody(createDiaryEntrySchema, request.body);
      if (!parsed.success) return reply.status(400).send({ error: parsed.error });

      const [row] = await db
        .insert(constructionDiaryEntries)
        .values({
          projectId: request.params.id,
          ...parsed.data,
        })
        .returning();

      await logAudit({
        workspaceId: request.auth.workspaceId,
        projectId: request.params.id,
        userId: request.auth.userId,
        action: "diary.create",
        entityType: "construction_diary_entry",
        entityId: row.id,
        afterState: { entryDate: row.entryDate },
      });

      return reply.status(201).send({ data: row });
    }
  );

  app.patch(
    "/projects/:id/construction-diary-entries/:entryId",
    async (
      request: FastifyRequest<{ Params: { id: string; entryId: string } }>,
      reply: FastifyReply
    ) => {
      if (!request.auth) return reply.status(401).send({ error: "Unauthorized" });
      if (request.auth.role !== "architect_admin") {
        return reply.status(403).send({ error: "Forbidden" });
      }
      const project = await ensureProjectInWorkspace(request.params.id, request.auth.workspaceId);
      if (!project) return reply.status(404).send({ error: "Project not found" });

      const parsed = validateBody(updateDiaryEntrySchema, request.body);
      if (!parsed.success) return reply.status(400).send({ error: parsed.error });

      const updateData: Record<string, unknown> = { ...parsed.data };
      if (parsed.data.status === "signed_off") {
        updateData.signedOffBy = request.auth.userId;
      }

      const [row] = await db
        .update(constructionDiaryEntries)
        .set(updateData)
        .where(
          and(
            eq(constructionDiaryEntries.id, request.params.entryId),
            eq(constructionDiaryEntries.projectId, request.params.id)
          )
        )
        .returning();

      if (!row) return reply.status(404).send({ error: "Entry not found" });

      await logAudit({
        workspaceId: request.auth.workspaceId,
        projectId: request.params.id,
        userId: request.auth.userId,
        action: "diary.update",
        entityType: "construction_diary_entry",
        entityId: row.id,
        afterState: parsed.data,
      });

      return { data: row };
    }
  );
}
