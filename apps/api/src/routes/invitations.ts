import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { db, invitations, workspaces, users } from "@tenderfish/db";
import { eq, and } from "drizzle-orm";
import crypto from "crypto";

export async function invitationRoutes(app: FastifyInstance) {
  // POST /api/onboarding/invitations — batch invite during onboarding step 2
  app.post("/onboarding/invitations", async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.auth) {
      return reply.status(401).send({ error: "Unauthorized" });
    }

    const body = request.body as {
      invitations: { email: string; role: string }[];
    };

    if (!body.invitations?.length) {
      return reply.status(400).send({ error: "No invitations provided" });
    }

    const created = [];

    for (const inv of body.invitations) {
      if (!inv.email?.includes("@")) continue;

      const token = crypto.randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

      const validRoles = ["project_lead", "team_member"] as const;
      const role = validRoles.includes(inv.role as typeof validRoles[number])
        ? (inv.role as typeof validRoles[number])
        : "team_member";

      const [invitation] = await db
        .insert(invitations)
        .values({
          workspaceId: request.auth.workspaceId,
          email: inv.email.toLowerCase().trim(),
          role,
          invitedBy: request.auth.userId,
          token,
          expiresAt,
        })
        .returning();

      created.push(invitation);

      // TODO: Send invitation email via Postmark
      // await sendInvitationEmail({
      //   to: inv.email,
      //   inviterName: request.auth.userName,
      //   workspaceName: workspace.name,
      //   acceptUrl: `${process.env.NEXT_PUBLIC_APP_URL}/invite/${token}`,
      // });
    }

    return reply.status(201).send({ data: created, count: created.length });
  });

  // POST /api/invitations — create invitation from settings / project
  app.post("/invitations", async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.auth) {
      return reply.status(401).send({ error: "Unauthorized" });
    }

    if (!["architect_admin", "project_lead"].includes(request.auth.role)) {
      return reply.status(403).send({ error: "Forbidden" });
    }

    const body = request.body as {
      email: string;
      role: string;
      projectId?: string;
    };

    if (!body.email?.includes("@")) {
      return reply.status(400).send({ error: "Valid email is required" });
    }

    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const [invitation] = await db
      .insert(invitations)
      .values({
        workspaceId: request.auth.workspaceId,
        projectId: body.projectId || null,
        email: body.email.toLowerCase().trim(),
        role: body.role as typeof invitations.role.enumValues[number],
        invitedBy: request.auth.userId,
        token,
        expiresAt,
      })
      .returning();

    return reply.status(201).send({ data: invitation });
  });

  // GET /api/invitations — list workspace invitations
  app.get("/invitations", async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.auth) {
      return reply.status(401).send({ error: "Unauthorized" });
    }

    const list = await db.query.invitations.findMany({
      where: eq(invitations.workspaceId, request.auth.workspaceId),
      orderBy: (inv, { desc }) => [desc(inv.createdAt)],
    });

    return { data: list };
  });

  // GET /api/invitations/:token/verify — verify invitation token (public)
  app.get("/invitations/:token/verify", async (request: FastifyRequest, reply: FastifyReply) => {
    const { token } = request.params as { token: string };

    const invitation = await db.query.invitations.findFirst({
      where: eq(invitations.token, token),
    });

    if (!invitation) {
      return reply.status(404).send({ error: "Invitation not found" });
    }

    if (invitation.status !== "pending") {
      return reply.status(410).send({ error: "Invitation already used or revoked" });
    }

    if (new Date(invitation.expiresAt) < new Date()) {
      return reply.status(410).send({ error: "Invitation expired" });
    }

    const workspace = await db.query.workspaces.findFirst({
      where: eq(workspaces.id, invitation.workspaceId),
    });

    const inviter = await db.query.users.findFirst({
      where: eq(users.id, invitation.invitedBy),
    });

    return {
      data: {
        workspaceName: workspace?.name || "Unknown workspace",
        role: invitation.role,
        inviterName: inviter?.name || "A team member",
      },
    };
  });

  // POST /api/invitations/:token/accept — accept invitation
  app.post("/invitations/:token/accept", async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.auth) {
      return reply.status(401).send({ error: "Unauthorized — please sign up or log in first" });
    }

    const { token } = request.params as { token: string };

    const invitation = await db.query.invitations.findFirst({
      where: eq(invitations.token, token),
    });

    if (!invitation) {
      return reply.status(404).send({ error: "Invitation not found" });
    }

    if (invitation.status !== "pending") {
      return reply.status(410).send({ error: "Invitation already used" });
    }

    if (new Date(invitation.expiresAt) < new Date()) {
      return reply.status(410).send({ error: "Invitation expired" });
    }

    // Mark invitation as accepted
    await db
      .update(invitations)
      .set({ status: "accepted", acceptedAt: new Date() })
      .where(eq(invitations.id, invitation.id));

    // Update user's workspace and role if needed
    await db
      .update(users)
      .set({
        workspaceId: invitation.workspaceId,
        role: invitation.role === "project_lead" ? "project_lead" : "team_member",
      })
      .where(eq(users.id, request.auth.userId));

    return { data: { accepted: true, workspaceId: invitation.workspaceId } };
  });

  // DELETE /api/invitations/:id — revoke invitation
  app.delete("/invitations/:id", async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.auth) {
      return reply.status(401).send({ error: "Unauthorized" });
    }

    if (request.auth.role !== "architect_admin") {
      return reply.status(403).send({ error: "Only admins can revoke invitations" });
    }

    const { id } = request.params as { id: string };

    const invitation = await db.query.invitations.findFirst({
      where: and(eq(invitations.id, id), eq(invitations.workspaceId, request.auth.workspaceId)),
    });

    if (!invitation) {
      return reply.status(404).send({ error: "Invitation not found" });
    }

    await db
      .update(invitations)
      .set({ status: "revoked" })
      .where(eq(invitations.id, id));

    return { data: { revoked: true } };
  });
}
