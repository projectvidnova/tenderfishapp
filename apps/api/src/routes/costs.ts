import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { db, costSnapshots, costLineItems } from "@tenderfish/db";
import { eq, and, desc } from "drizzle-orm";
import { validateBody } from "../lib/validation";
import { z } from "zod";

// ─── Validation schemas ──────────────────────────────────────

const createSnapshotSchema = z.object({
  costStage: z.enum([
    "kostenrahmen",
    "kostenschaetzung",
    "kostenberechnung",
    "kostenanschlag",
    "kostenfeststellung",
  ]),
  snapshotDate: z.string().min(1),
  totalGross: z.number().int().min(0).optional(),
  totalNet: z.number().int().min(0).optional(),
  vatRate: z.number().int().min(0).default(1900),
  notes: z.string().max(5000).optional(),
});

const updateSnapshotSchema = z.object({
  totalGross: z.number().int().min(0).optional(),
  totalNet: z.number().int().min(0).optional(),
  notes: z.string().max(5000).optional(),
  status: z.enum(["draft", "submitted", "approved", "superseded"]).optional(),
});

const createLineItemSchema = z.object({
  costGroupCode: z.string().min(1).max(10),
  costGroupLevel: z.number().int().min(1).max(3),
  description: z.string().max(1000).optional(),
  amountNet: z.number().int().min(0),
  amountGross: z.number().int().min(0),
  quantity: z.number().int().optional(),
  unit: z.string().max(50).optional(),
  unitPrice: z.number().int().optional(),
  source: z.string().max(255).optional(),
  dataState: z.enum(["CONFIRMED", "DERIVED", "UNCLEAR", "MISSING"]).default("DERIVED"),
});

const batchLineItemsSchema = z.object({
  items: z.array(createLineItemSchema).min(1).max(500),
});

export async function costRoutes(app: FastifyInstance) {
  // GET /api/projects/:id/cost-snapshots — list all snapshots
  app.get("/projects/:id/cost-snapshots", async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    if (!request.auth) return reply.status(401).send({ error: "Unauthorized" });

    const snapshots = await db.query.costSnapshots.findMany({
      where: eq(costSnapshots.projectId, request.params.id),
      orderBy: desc(costSnapshots.createdAt),
    });

    return { data: snapshots };
  });

  // GET /api/projects/:id/cost-snapshots/:snapshotId — get snapshot with line items
  app.get("/projects/:id/cost-snapshots/:snapshotId", async (request: FastifyRequest<{ Params: { id: string; snapshotId: string } }>, reply: FastifyReply) => {
    if (!request.auth) return reply.status(401).send({ error: "Unauthorized" });

    const snapshot = await db.query.costSnapshots.findFirst({
      where: and(
        eq(costSnapshots.id, request.params.snapshotId),
        eq(costSnapshots.projectId, request.params.id),
      ),
    });
    if (!snapshot) return reply.status(404).send({ error: "Snapshot not found" });

    const items = await db.query.costLineItems.findMany({
      where: eq(costLineItems.snapshotId, request.params.snapshotId),
    });

    return { data: { ...snapshot, lineItems: items } };
  });

  // POST /api/projects/:id/cost-snapshots — create snapshot
  app.post("/projects/:id/cost-snapshots", async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    if (!request.auth) return reply.status(401).send({ error: "Unauthorized" });

    if (!["architect_admin", "project_lead"].includes(request.auth.role)) {
      return reply.status(403).send({ error: "Forbidden" });
    }

    const parsed = validateBody(createSnapshotSchema, request.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error });

    const [snapshot] = await db
      .insert(costSnapshots)
      .values({
        projectId: request.params.id,
        costStage: parsed.data.costStage,
        snapshotDate: parsed.data.snapshotDate,
        totalGross: parsed.data.totalGross || 0,
        totalNet: parsed.data.totalNet || 0,
        vatRate: parsed.data.vatRate,
        notes: parsed.data.notes,
        createdBy: request.auth.userId,
      })
      .returning();

    return reply.status(201).send({ data: snapshot });
  });

  // PATCH /api/projects/:id/cost-snapshots/:snapshotId — update snapshot
  app.patch("/projects/:id/cost-snapshots/:snapshotId", async (request: FastifyRequest<{ Params: { id: string; snapshotId: string } }>, reply: FastifyReply) => {
    if (!request.auth) return reply.status(401).send({ error: "Unauthorized" });

    const parsed = validateBody(updateSnapshotSchema, request.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error });

    const updateData: Record<string, unknown> = { ...parsed.data };
    if (parsed.data.status === "approved") {
      updateData.approvedBy = request.auth.userId;
      updateData.approvedAt = new Date();
    }

    const [updated] = await db
      .update(costSnapshots)
      .set(updateData)
      .where(and(
        eq(costSnapshots.id, request.params.snapshotId),
        eq(costSnapshots.projectId, request.params.id),
      ))
      .returning();

    if (!updated) return reply.status(404).send({ error: "Snapshot not found" });
    return { data: updated };
  });

  // POST /api/projects/:id/cost-snapshots/:snapshotId/line-items — add line item
  app.post("/projects/:id/cost-snapshots/:snapshotId/line-items", async (request: FastifyRequest<{ Params: { id: string; snapshotId: string } }>, reply: FastifyReply) => {
    if (!request.auth) return reply.status(401).send({ error: "Unauthorized" });

    const parsed = validateBody(createLineItemSchema, request.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error });

    const [item] = await db
      .insert(costLineItems)
      .values({
        snapshotId: request.params.snapshotId,
        ...parsed.data,
      })
      .returning();

    return reply.status(201).send({ data: item });
  });

  // POST /api/projects/:id/cost-snapshots/:snapshotId/line-items/batch — batch add
  app.post("/projects/:id/cost-snapshots/:snapshotId/line-items/batch", async (request: FastifyRequest<{ Params: { id: string; snapshotId: string } }>, reply: FastifyReply) => {
    if (!request.auth) return reply.status(401).send({ error: "Unauthorized" });

    const parsed = validateBody(batchLineItemsSchema, request.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error });

    const items = await db
      .insert(costLineItems)
      .values(
        parsed.data.items.map((item) => ({
          snapshotId: request.params.snapshotId,
          ...item,
        }))
      )
      .returning();

    return reply.status(201).send({ data: items });
  });

  // DELETE /api/projects/:id/cost-snapshots/:snapshotId/line-items/:itemId
  app.delete("/projects/:id/cost-snapshots/:snapshotId/line-items/:itemId", async (request: FastifyRequest<{ Params: { id: string; snapshotId: string; itemId: string } }>, reply: FastifyReply) => {
    if (!request.auth) return reply.status(401).send({ error: "Unauthorized" });

    const [deleted] = await db
      .delete(costLineItems)
      .where(and(
        eq(costLineItems.id, request.params.itemId),
        eq(costLineItems.snapshotId, request.params.snapshotId),
      ))
      .returning();

    if (!deleted) return reply.status(404).send({ error: "Line item not found" });
    return { data: deleted };
  });
}
