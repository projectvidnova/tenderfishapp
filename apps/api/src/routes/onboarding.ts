import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { db, workspaces } from "@tenderfish/db";
import { eq } from "drizzle-orm";

export async function onboardingRoutes(app: FastifyInstance) {
  // POST /api/onboarding/workspace — update workspace during onboarding step 1
  app.post("/onboarding/workspace", async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.auth) {
      return reply.status(401).send({ error: "Unauthorized" });
    }

    const body = request.body as {
      name?: string;
      street?: string;
      city?: string;
      postcode?: string;
      country?: string;
      taxId?: string;
    };

    const workspace = await db.query.workspaces.findFirst({
      where: eq(workspaces.id, request.auth.workspaceId),
    });

    if (!workspace) {
      return reply.status(404).send({ error: "Workspace not found" });
    }

    const updates: Record<string, unknown> = {};
    if (body.name) updates.name = body.name.trim();
    if (body.street) updates.street = body.street.trim();
    if (body.city) updates.city = body.city.trim();
    if (body.postcode) updates.postcode = body.postcode.trim();
    if (body.country) updates.country = body.country;
    if (body.taxId) updates.taxId = body.taxId.trim();

    if (Object.keys(updates).length > 0) {
      await db.update(workspaces).set(updates).where(eq(workspaces.id, workspace.id));
    }

    const updated = await db.query.workspaces.findFirst({
      where: eq(workspaces.id, workspace.id),
    });

    return {
      data: {
        id: updated!.id,
        name: updated!.name,
        slug: updated!.slug,
        inboxEmail: updated!.inboxEmail,
      },
    };
  });
}
