import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import fp from "fastify-plugin";
import { fromNodeHeaders } from "better-auth/node";
import { getAuth } from "../lib/auth";

declare module "fastify" {
  interface FastifyRequest {
    auth: {
      userId: string;
      workspaceId: string;
      role: string;
    } | null;
  }
}

/**
 * Better Auth session middleware.
 * Validates the session cookie on every request (except public paths).
 * Populates request.auth with userId, workspaceId, and role.
 */
async function betterAuthMiddleware(app: FastifyInstance) {
  app.decorateRequest("auth", null);

  app.addHook("onRequest", async (request: FastifyRequest, reply: FastifyReply) => {
    // Skip auth for health, webhooks, Better Auth routes (handled separately), invitations
    const publicPaths = ["/api/health", "/api/webhooks/", "/api/auth/", "/api/invitations/"];
    if (publicPaths.some((p) => request.url.startsWith(p))) {
      return;
    }

    try {
      const auth = getAuth();
      const session = await auth.api.getSession({
        headers: fromNodeHeaders(request.headers),
      });

      if (!session) {
        return reply.status(401).send({ error: "Unauthorized", message: "Not authenticated" });
      }

      request.auth = {
        userId: session.user.id,
        workspaceId: (session.user as any).workspaceId || "",
        role: (session.user as any).role || "team_member",
      };
    } catch {
      return reply.status(401).send({ error: "Unauthorized", message: "Invalid session" });
    }
  });
}

export const authPlugin = fp(betterAuthMiddleware, { name: "better-auth" });
