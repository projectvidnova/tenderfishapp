import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { db, inboxMessages, notifications, invitations, users, projects } from "@tenderfish/db";
import { eq, and, desc } from "drizzle-orm";
import { logAudit } from "../utils/audit";

export async function inboxRoutes(app: FastifyInstance) {
  // ─── INBOX ─────────────────────────────────────────────────

  // GET /api/inbox
  app.get("/inbox", async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.auth) return reply.status(401).send({ error: "Unauthorized" });
    const { status, search } = request.query as { status?: string; search?: string };

    let list = await db.query.inboxMessages.findMany({
      where: eq(inboxMessages.workspaceId, request.auth.workspaceId),
      orderBy: [desc(inboxMessages.createdAt)],
    });

    if (status && status !== "all") list = list.filter((m) => m.status === status);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (m) =>
          m.subject.toLowerCase().includes(q) ||
          m.fromEmail.toLowerCase().includes(q) ||
          m.body.toLowerCase().includes(q)
      );
    }

    // Enrich with project name if assigned
    const enriched = await Promise.all(
      list.map(async (m) => {
        let projectName: string | null = null;
        if (m.projectId) {
          const proj = await db.query.projects.findFirst({ where: eq(projects.id, m.projectId) });
          projectName = proj?.name || null;
        }
        const attachments = (m.attachments || []) as { name: string; contentType: string; size: number }[];
        return { ...m, projectName, attachmentCount: attachments.length };
      })
    );

    return { data: enriched };
  });

  // PATCH /api/inbox/:messageId
  app.patch("/inbox/:messageId", async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.auth) return reply.status(401).send({ error: "Unauthorized" });
    const { messageId } = request.params as { messageId: string };
    const body = request.body as { status?: string; projectId?: string };

    const existing = await db.query.inboxMessages.findFirst({
      where: and(eq(inboxMessages.id, messageId), eq(inboxMessages.workspaceId, request.auth.workspaceId)),
    });
    if (!existing) return reply.status(404).send({ error: "Message not found" });

    const updates: Record<string, unknown> = {};
    if (body.status) updates.status = body.status;
    if (body.projectId !== undefined) {
      updates.projectId = body.projectId || null;
      if (body.projectId) updates.status = "assigned";
    }

    const [updated] = await db
      .update(inboxMessages)
      .set(updates)
      .where(eq(inboxMessages.id, messageId))
      .returning();

    return { data: updated };
  });

  // POST /api/webhooks/postmark-inbound (simplified — no real Postmark integration)
  app.post("/webhooks/postmark-inbound", async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as {
      From: string;
      Subject: string;
      TextBody?: string;
      HtmlBody?: string;
      Attachments?: { Name: string; ContentType: string; ContentLength: number }[];
    };

    // For now, store without AI analysis — would integrate Claude here
    // Need a workspace context — use first workspace as fallback
    const workspace = await db.query.workspaces.findFirst();
    if (!workspace) return reply.status(400).send({ error: "No workspace configured" });

    const attachments = (body.Attachments || []).map((a) => ({
      name: a.Name,
      contentType: a.ContentType,
      size: a.ContentLength,
      storagePath: "",
    }));

    const [msg] = await db
      .insert(inboxMessages)
      .values({
        workspaceId: workspace.id,
        fromEmail: body.From || "unknown@unknown.com",
        subject: body.Subject || "(no subject)",
        body: body.TextBody || body.HtmlBody || "",
        attachments,
        aiSuggestions: { signals: [] },
      })
      .returning();

    return reply.status(201).send({ data: msg });
  });

  // ─── NOTIFICATIONS ─────────────────────────────────────────

  // GET /api/notifications
  app.get("/notifications", async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.auth) return reply.status(401).send({ error: "Unauthorized" });

    const list = await db.query.notifications.findMany({
      where: and(
        eq(notifications.userId, request.auth.userId),
        eq(notifications.workspaceId, request.auth.workspaceId),
      ),
      orderBy: [desc(notifications.createdAt)],
    });

    const unreadCount = list.filter((n) => !n.read).length;

    return { data: list, unreadCount };
  });

  // PATCH /api/notifications/:notifId — mark read
  app.patch("/notifications/:notifId", async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.auth) return reply.status(401).send({ error: "Unauthorized" });
    const { notifId } = request.params as { notifId: string };
    const body = request.body as { read: boolean };

    const [updated] = await db
      .update(notifications)
      .set({ read: body.read !== undefined ? body.read : true })
      .where(and(eq(notifications.id, notifId), eq(notifications.userId, request.auth.userId)))
      .returning();

    return { data: updated };
  });

  // POST /api/notifications/mark-all-read
  app.post("/notifications/mark-all-read", async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.auth) return reply.status(401).send({ error: "Unauthorized" });

    await db
      .update(notifications)
      .set({ read: true })
      .where(and(eq(notifications.userId, request.auth.userId), eq(notifications.workspaceId, request.auth.workspaceId)));

    return { success: true };
  });

  // ─── PROJECT INVITATIONS ─────────────────────────────────────

  // GET /api/projects/:id/invitations (includes team members)
  app.get("/projects/:id/invitations", async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.auth) return reply.status(401).send({ error: "Unauthorized" });
    const { id } = request.params as { id: string };

    const project = await db.query.projects.findFirst({
      where: and(eq(projects.id, id), eq(projects.workspaceId, request.auth.workspaceId)),
    });
    if (!project) return reply.status(404).send({ error: "Project not found" });

    const invites = await db.query.invitations.findMany({
      where: eq(invitations.projectId, id),
      orderBy: [desc(invitations.createdAt)],
    });

    const enriched = await Promise.all(
      invites.map(async (inv) => {
        const inviter = await db.query.users.findFirst({ where: eq(users.id, inv.invitedBy) });
        return { ...inv, invitedByName: inviter?.name || null };
      })
    );

    return { data: enriched };
  });

  // POST /api/projects/:id/invitations
  app.post("/projects/:id/invitations", async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.auth) return reply.status(401).send({ error: "Unauthorized" });
    const { id } = request.params as { id: string };
    const body = request.body as {
      email: string;
      role: string;
      message?: string;
    };

    const project = await db.query.projects.findFirst({
      where: and(eq(projects.id, id), eq(projects.workspaceId, request.auth.workspaceId)),
    });
    if (!project) return reply.status(404).send({ error: "Project not found" });

    if (!body.email?.trim()) return reply.status(400).send({ error: "Email is required" });

    // Generate a secure random token
    const token = crypto.randomUUID() + "-" + crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    const [created] = await db
      .insert(invitations)
      .values({
        workspaceId: request.auth.workspaceId,
        projectId: id,
        email: body.email.trim().toLowerCase(),
        role: body.role as "architect_admin" | "project_lead" | "team_member",
        invitedBy: request.auth.userId,
        token,
        expiresAt,
        gateAtInvitation: null,
      })
      .returning();

    await logAudit({
      workspaceId: request.auth.workspaceId,
      projectId: id,
      userId: request.auth.userId,
      action: "invitation.create",
      entityType: "invitation",
      entityId: created.id,
      afterState: { email: body.email, role: body.role },
    });

    return reply.status(201).send({ data: created });
  });

  // DELETE /api/projects/:id/invitations/:invId
  app.delete("/projects/:id/invitations/:invId", async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.auth) return reply.status(401).send({ error: "Unauthorized" });
    const { id, invId } = request.params as { id: string; invId: string };

    const existing = await db.query.invitations.findFirst({
      where: and(eq(invitations.id, invId), eq(invitations.projectId, id)),
    });
    if (!existing) return reply.status(404).send({ error: "Invitation not found" });

    await db
      .update(invitations)
      .set({ status: "revoked" })
      .where(eq(invitations.id, invId));

    await logAudit({
      workspaceId: request.auth.workspaceId,
      projectId: id,
      userId: request.auth.userId,
      action: "invitation.revoke",
      entityType: "invitation",
      entityId: invId,
      beforeState: { status: existing.status, email: existing.email },
      afterState: { status: "revoked" },
    });

    return { success: true };
  });
}
