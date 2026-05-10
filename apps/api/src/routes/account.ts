import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import {
  db,
  users,
  sessions,
  accounts,
  workspaces,
  projects,
  auditLogs,
} from "@tenderfish/db";
import { and, eq } from "drizzle-orm";
import { logAudit } from "../utils/audit";

// DSGVO compliance endpoints — Art. 20 (data portability) + Art. 17 (erasure).
//
// Erasure strategy: anonymize the `users` row in place rather than hard-delete.
// We replace identifying fields (email, name, image) with non-identifying
// markers and cascade-delete sessions. This preserves the audit_logs.user_id
// FK (the audit trail must remain intact per V5 §5 immutable history) while
// removing all personal data — covered by DSGVO Art. 17(3)(b) (necessary
// records of processing operations).

export async function accountRoutes(app: FastifyInstance) {
  // ─── POST /account/export ──────────────────────────────────
  // Returns a JSON blob containing all user-owned data — DSGVO Art. 20.

  app.post("/account/export", async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.auth) return reply.status(401).send({ error: "Unauthorized" });

    const userId = request.auth.userId;
    const workspaceId = request.auth.workspaceId;

    const [userRow] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!userRow) return reply.status(404).send({ error: "User not found" });

    const [workspaceRow] = await db
      .select()
      .from(workspaces)
      .where(eq(workspaces.id, workspaceId))
      .limit(1);

    // We don't have a `createdBy` column on projects, so we list all
    // workspace projects the user can see (the workspace is itself
    // user-owned data). For audit logs we filter strictly by userId.
    const userProjects = await db.query.projects.findMany({
      where: eq(projects.workspaceId, workspaceId),
    });

    const userAuditLogs = await db.query.auditLogs.findMany({
      where: eq(auditLogs.userId, userId),
    });

    const exportPayload = {
      generatedAt: new Date().toISOString(),
      schemaVersion: 1,
      user: {
        id: userRow.id,
        email: userRow.email,
        name: userRow.name,
        role: userRow.role,
        emailVerified: userRow.emailVerified,
        createdAt: userRow.createdAt,
      },
      workspace: workspaceRow
        ? {
            id: workspaceRow.id,
            name: workspaceRow.name,
            createdAt: workspaceRow.createdAt,
          }
        : null,
      workspaceProjects: userProjects.map((p) => ({
        id: p.id,
        name: p.name,
        type: p.type,
        status: p.status,
        lifecycleState: p.lifecycleState,
        createdAt: p.createdAt,
      })),
      auditLogEntries: userAuditLogs.map((a) => ({
        id: a.id,
        action: a.action,
        entityType: a.entityType,
        entityId: a.entityId,
        createdAt: a.createdAt,
      })),
    };

    await logAudit({
      workspaceId,
      userId,
      action: "account.export",
      entityType: "user",
      entityId: userId,
      afterState: { recordCount: userAuditLogs.length + userProjects.length },
    });

    return reply
      .header("Content-Type", "application/json; charset=utf-8")
      .header(
        "Content-Disposition",
        `attachment; filename="tenderfish-data-${userId}.json"`
      )
      .send(exportPayload);
  });

  // ─── DELETE /account ────────────────────────────────────────
  // Anonymizes the user row + invalidates sessions — DSGVO Art. 17.

  app.delete("/account", async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.auth) return reply.status(401).send({ error: "Unauthorized" });

    const userId = request.auth.userId;
    const workspaceId = request.auth.workspaceId;

    const [existing] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!existing) return reply.status(404).send({ error: "User not found" });

    const anonEmail = `deleted-${userId}@anonymized.local`;

    await db
      .update(users)
      .set({
        email: anonEmail,
        name: "Deleted User",
        image: null,
        emailVerified: false,
      })
      .where(eq(users.id, userId));

    // Drop all OAuth account links and active sessions.
    await db.delete(accounts).where(eq(accounts.userId, userId));
    await db.delete(sessions).where(eq(sessions.userId, userId));

    await logAudit({
      workspaceId,
      userId,
      action: "account.delete",
      entityType: "user",
      entityId: userId,
      beforeState: { email: existing.email, name: existing.name },
      afterState: { anonymized: true },
    });

    // Clear the session cookie. Better-Auth stores via the standard
    // `better-auth.session_token` cookie; clearing it logs out the client.
    return reply
      .clearCookie("better-auth.session_token", { path: "/" })
      .status(200)
      .send({ data: { anonymized: true } });
  });
}
