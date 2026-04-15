import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { db, users, workspaces } from "@tenderfish/db";
import { eq } from "drizzle-orm";
import { slugify } from "@tenderfish/shared";
import crypto from "crypto";

export async function authRoutes(app: FastifyInstance) {
  // POST /api/auth/signup — create user + workspace
  app.post("/auth/signup", async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as {
      name: string;
      email: string;
      password: string;
      company: string;
      country?: string;
    };

    if (!body.name?.trim() || !body.email?.trim() || !body.password || !body.company?.trim()) {
      return reply.status(400).send({ error: "All fields are required" });
    }

    if (body.password.length < 8) {
      return reply.status(400).send({ error: "Password must be at least 8 characters" });
    }

    // Check if email already exists
    const existingUser = await db.query.users.findFirst({
      where: eq(users.email, body.email.toLowerCase().trim()),
    });

    if (existingUser) {
      return reply.status(409).send({ error: "An account with this email already exists" });
    }

    const slug = slugify(body.company);

    // Check slug uniqueness
    const existingWorkspace = await db.query.workspaces.findFirst({
      where: eq(workspaces.slug, slug),
    });

    const finalSlug = existingWorkspace
      ? `${slug}-${crypto.randomBytes(3).toString("hex")}`
      : slug;

    // Create workspace
    const [workspace] = await db
      .insert(workspaces)
      .values({
        name: body.company.trim(),
        slug: finalSlug,
        inboxEmail: `${finalSlug}@in.tenderfish.ai`,
        country: body.country || "Germany",
      })
      .returning();

    // In dev mode, we use a mock Clerk ID. In production, we'd create the Clerk
    // user first and use their real ID here.
    const clerkId = process.env.CLERK_SECRET_KEY
      ? `clerk_pending_${crypto.randomUUID()}`
      : `dev_clerk_${crypto.randomBytes(8).toString("hex")}`;

    // Create user
    const [user] = await db
      .insert(users)
      .values({
        workspaceId: workspace.id,
        clerkId,
        email: body.email.toLowerCase().trim(),
        name: body.name.trim(),
        role: "architect_admin",
      })
      .returning();

    // Generate a simple dev token (in production this would be a Clerk session)
    const token = Buffer.from(
      JSON.stringify({
        userId: user.id,
        clerkId: user.clerkId,
        workspaceId: workspace.id,
        role: user.role,
      })
    ).toString("base64url");

    return reply.status(201).send({
      data: {
        user: { id: user.id, email: user.email, name: user.name, role: user.role },
        workspace: { id: workspace.id, name: workspace.name, slug: workspace.slug },
      },
      token,
    });
  });

  // POST /api/auth/login — authenticate user
  app.post("/auth/login", async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as { email: string; password: string };

    if (!body.email?.trim() || !body.password) {
      return reply.status(400).send({ error: "Email and password are required" });
    }

    // Find user by email
    const user = await db.query.users.findFirst({
      where: eq(users.email, body.email.toLowerCase().trim()),
    });

    if (!user) {
      return reply.status(401).send({ error: "Invalid email or password" });
    }

    // In dev mode, accept any password. In production, Clerk handles password verification.
    if (process.env.CLERK_SECRET_KEY) {
      return reply.status(401).send({ error: "Use Clerk for authentication in production" });
    }

    // Generate dev token
    const token = Buffer.from(
      JSON.stringify({
        userId: user.id,
        clerkId: user.clerkId,
        workspaceId: user.workspaceId,
        role: user.role,
      })
    ).toString("base64url");

    return {
      data: { id: user.id, email: user.email, name: user.name, role: user.role },
      token,
    };
  });

  // GET /api/auth/me — current user info
  app.get("/auth/me", async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.auth) {
      return reply.status(401).send({ error: "Unauthorized" });
    }

    const user = await db.query.users.findFirst({
      where: eq(users.id, request.auth.userId),
    });

    if (!user) {
      return reply.status(404).send({ error: "User not found" });
    }

    const workspace = await db.query.workspaces.findFirst({
      where: eq(workspaces.id, user.workspaceId),
    });

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
