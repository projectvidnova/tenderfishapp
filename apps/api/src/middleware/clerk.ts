import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import fp from "fastify-plugin";

// Extend Fastify request type with auth context
declare module "fastify" {
  interface FastifyRequest {
    auth: {
      userId: string;
      clerkId: string;
      workspaceId: string;
      role: string;
    } | null;
  }
}

/**
 * Clerk authentication plugin.
 * In development without Clerk keys, accepts dev tokens from /api/auth/signup|login.
 * In production, validates Clerk session tokens.
 */
async function clerkAuth(app: FastifyInstance) {
  app.decorateRequest("auth", null);

  app.addHook("onRequest", async (request: FastifyRequest, reply: FastifyReply) => {
    // Skip auth for health, webhooks, public and auth routes
    const publicPaths = ["/api/health", "/api/webhooks/", "/api/auth/signup", "/api/auth/login", "/api/invitations/"];
    if (publicPaths.some((p) => request.url.startsWith(p))) {
      return;
    }

    const authHeader = request.headers.authorization;
    const clerkSecretKey = process.env.CLERK_SECRET_KEY;

    // If we have a Bearer token, try to decode it
    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.slice(7);

      if (clerkSecretKey) {
        // Production: Validate Clerk session token
        try {
          // TODO: Replace with actual Clerk verification:
          // const session = await clerkClient.verifyToken(token);
          // const clerkId = session.sub;
          // Lookup internal user by clerkId → get workspaceId and role
          return reply.status(401).send({ error: "Unauthorized", message: "Clerk not configured" });
        } catch {
          return reply.status(401).send({ error: "Unauthorized", message: "Invalid auth token" });
        }
      } else {
        // Dev mode: decode the base64url dev token
        try {
          const decoded = JSON.parse(Buffer.from(token, "base64url").toString());
          if (decoded.userId && decoded.workspaceId) {
            request.auth = {
              userId: decoded.userId,
              clerkId: decoded.clerkId || "",
              workspaceId: decoded.workspaceId,
              role: decoded.role || "team_member",
            };
            return;
          }
        } catch {
          // Token didn't decode — fall through to mock
        }
      }
    }

    // Dev fallback: no token and no Clerk keys → use mock auth
    if (!clerkSecretKey && !authHeader) {
      request.auth = {
        userId: "00000000-0000-0000-0000-000000000001",
        clerkId: "dev-clerk-001",
        workspaceId: "00000000-0000-0000-0000-000000000010",
        role: "architect_admin",
      };
      return;
    }

    // No valid auth found
    if (!request.auth) {
      return reply.status(401).send({ error: "Unauthorized", message: "Missing or invalid auth token" });
    }
  });
}

export const clerkPlugin = fp(clerkAuth, { name: "clerk-auth" });
