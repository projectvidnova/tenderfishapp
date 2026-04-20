import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { fromNodeHeaders } from "better-auth/node";
import { db, users, workspaces } from "@tenderfish/db";
import { eq } from "drizzle-orm";
import { slugify } from "@tenderfish/shared";
import crypto from "crypto";
import { getAuth } from "../lib/auth";
import { getEnv } from "../lib/env";

export async function authRoutes(app: FastifyInstance) {
  const env = getEnv();

  // ── Better Auth catch-all handler ─────────────────────────
  // Handles: sign-up/email, sign-in/email, sign-in/social, sign-out,
  //          callback/:id, session, etc.
  app.route({
    method: ["GET", "POST"],
    url: "/auth/*",
    handler: async (request, reply) => {
      try {
        const auth = getAuth();
        const url = new URL(request.url, `http://${request.headers.host}`);
        const headers = fromNodeHeaders(request.headers);
        const req = new Request(url.toString(), {
          method: request.method,
          headers,
          ...(request.body ? { body: JSON.stringify(request.body) } : {}),
        });

        const response = await auth.handler(req);

        reply.status(response.status);

        // Set-Cookie headers must be forwarded individually —
        // Headers.forEach() joins multiple Set-Cookie values with commas
        // which breaks cookie parsing in the browser.
        const setCookies = response.headers.getSetCookie?.() ?? [];
        for (const cookie of setCookies) {
          reply.header("set-cookie", cookie);
        }
        // Forward all other headers
        response.headers.forEach((value, key) => {
          if (key.toLowerCase() !== "set-cookie") {
            reply.header(key, value);
          }
        });

        const text = await response.text();
        return reply.send(text || null);
      } catch (error) {
        request.log.error(error, "Auth handler error");
        return reply.status(500).send({ error: "Internal authentication error" });
      }
    },
  });

  // ── POST /api/auth/setup-workspace ────────────────────────
  // Called after sign-up to create the user's workspace
  app.post("/auth/setup-workspace", async (request: FastifyRequest, reply: FastifyReply) => {
    const auth = getAuth();
    const session = await auth.api.getSession({
      headers: fromNodeHeaders(request.headers),
    });

    if (!session) {
      return reply.status(401).send({ error: "Unauthorized" });
    }

    // Check if user already has a workspace
    const existingUser = await db.query.users.findFirst({
      where: eq(users.id, session.user.id),
    });

    if (existingUser?.workspaceId) {
      const workspace = await db.query.workspaces.findFirst({
        where: eq(workspaces.id, existingUser.workspaceId),
      });
      return { data: { workspace } };
    }

    const body = request.body as { company: string; country?: string };
    if (!body?.company?.trim()) {
      return reply.status(400).send({ error: "company is required" });
    }

    const slug = slugify(body.company);
    const existingWorkspace = await db.query.workspaces.findFirst({
      where: eq(workspaces.slug, slug),
    });
    const finalSlug = existingWorkspace
      ? `${slug}-${crypto.randomBytes(3).toString("hex")}`
      : slug;

    const [workspace] = await db
      .insert(workspaces)
      .values({
        name: body.company.trim(),
        slug: finalSlug,
        inboxEmail: `${finalSlug}@in.tenderfish.ai`,
        country: body.country || env.DEFAULT_COUNTRY,
      })
      .returning();

    // Link user to workspace
    await db
      .update(users)
      .set({ workspaceId: workspace.id, role: "architect_admin" })
      .where(eq(users.id, session.user.id));

    return reply.status(201).send({
      data: { workspace: { id: workspace.id, name: workspace.name, slug: workspace.slug } },
    });
  });

  // ── GET /api/auth/me ──────────────────────────────────────
  // Returns current user + workspace info
  app.get("/auth/me", async (request: FastifyRequest, reply: FastifyReply) => {
    const auth = getAuth();
    const session = await auth.api.getSession({
      headers: fromNodeHeaders(request.headers),
    });

    if (!session) {
      return reply.status(401).send({ error: "Unauthorized" });
    }

    const user = await db.query.users.findFirst({
      where: eq(users.id, session.user.id),
    });

    if (!user) {
      return reply.status(404).send({ error: "User not found" });
    }

    const workspace = user.workspaceId
      ? await db.query.workspaces.findFirst({
          where: eq(workspaces.id, user.workspaceId),
        })
      : null;

    return {
      data: {
        user: { id: user.id, email: user.email, name: user.name, role: user.role },
        workspace: workspace
          ? { id: workspace.id, name: workspace.name, slug: workspace.slug }
          : null,
      },
    };
  });
}
