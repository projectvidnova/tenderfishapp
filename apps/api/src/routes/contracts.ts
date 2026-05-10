import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import {
  db,
  contracts,
  payments,
  abnahmen,
  nachtraege,
  projects,
} from "@tenderfish/db";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import {
  createContractSchema,
  updateContractSchema,
  createPaymentSchema,
  updatePaymentSchema,
  createAbnahmeSchema,
  updateAbnahmeSchema,
  createNachtragSchema,
  updateNachtragSchema,
  validateBody,
} from "../lib/validation";
import { logAudit } from "../utils/audit";

// Post-tender contract lifecycle (V5 §3 + DIN VOB/B compliance).
// Covers Verträge, Zahlungen, Abnahmen, Nachträge.

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

async function ensureContractInProject(
  contractId: string,
  projectId: string
): Promise<typeof contracts.$inferSelect | null> {
  const [row] = await db
    .select()
    .from(contracts)
    .where(and(eq(contracts.id, contractId), eq(contracts.projectId, projectId)))
    .limit(1);
  return row ?? null;
}

export async function contractRoutes(app: FastifyInstance) {
  // ─── Contracts ───────────────────────────────────────────────

  app.get(
    "/projects/:id/contracts",
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      if (!request.auth) return reply.status(401).send({ error: "Unauthorized" });
      const project = await ensureProjectInWorkspace(request.params.id, request.auth.workspaceId);
      if (!project) return reply.status(404).send({ error: "Project not found" });

      const rows = await db
        .select()
        .from(contracts)
        .where(eq(contracts.projectId, request.params.id))
        .orderBy(desc(contracts.createdAt));
      return { data: rows };
    }
  );

  app.post(
    "/projects/:id/contracts",
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      if (!request.auth) return reply.status(401).send({ error: "Unauthorized" });
      if (request.auth.role !== "architect_admin") {
        return reply.status(403).send({ error: "Forbidden" });
      }
      const project = await ensureProjectInWorkspace(request.params.id, request.auth.workspaceId);
      if (!project) return reply.status(404).send({ error: "Project not found" });

      const parsed = validateBody(createContractSchema, request.body);
      if (!parsed.success) return reply.status(400).send({ error: parsed.error });

      const [row] = await db
        .insert(contracts)
        .values({
          projectId: request.params.id,
          ...parsed.data,
          createdBy: request.auth.userId,
        })
        .returning();

      await logAudit({
        workspaceId: request.auth.workspaceId,
        projectId: request.params.id,
        userId: request.auth.userId,
        action: "contract.create",
        entityType: "contract",
        entityId: row.id,
        afterState: { contractor: row.contractorCompany, value: row.contractValueNet },
      });

      return reply.status(201).send({ data: row });
    }
  );

  app.get(
    "/projects/:id/contracts/:contractId",
    async (
      request: FastifyRequest<{ Params: { id: string; contractId: string } }>,
      reply: FastifyReply
    ) => {
      if (!request.auth) return reply.status(401).send({ error: "Unauthorized" });
      const project = await ensureProjectInWorkspace(request.params.id, request.auth.workspaceId);
      if (!project) return reply.status(404).send({ error: "Project not found" });

      const contract = await ensureContractInProject(request.params.contractId, request.params.id);
      if (!contract) return reply.status(404).send({ error: "Contract not found" });
      return { data: contract };
    }
  );

  app.patch(
    "/projects/:id/contracts/:contractId",
    async (
      request: FastifyRequest<{ Params: { id: string; contractId: string } }>,
      reply: FastifyReply
    ) => {
      if (!request.auth) return reply.status(401).send({ error: "Unauthorized" });
      if (request.auth.role !== "architect_admin") {
        return reply.status(403).send({ error: "Forbidden" });
      }
      const project = await ensureProjectInWorkspace(request.params.id, request.auth.workspaceId);
      if (!project) return reply.status(404).send({ error: "Project not found" });

      const existing = await ensureContractInProject(request.params.contractId, request.params.id);
      if (!existing) return reply.status(404).send({ error: "Contract not found" });

      const parsed = validateBody(updateContractSchema, request.body);
      if (!parsed.success) return reply.status(400).send({ error: parsed.error });

      const [row] = await db
        .update(contracts)
        .set(parsed.data)
        .where(eq(contracts.id, existing.id))
        .returning();

      await logAudit({
        workspaceId: request.auth.workspaceId,
        projectId: request.params.id,
        userId: request.auth.userId,
        action: "contract.update",
        entityType: "contract",
        entityId: existing.id,
        beforeState: { status: existing.status },
        afterState: parsed.data,
      });

      return { data: row };
    }
  );

  // ─── Payments ────────────────────────────────────────────────

  app.get(
    "/projects/:id/contracts/:contractId/payments",
    async (
      request: FastifyRequest<{ Params: { id: string; contractId: string } }>,
      reply: FastifyReply
    ) => {
      if (!request.auth) return reply.status(401).send({ error: "Unauthorized" });
      const project = await ensureProjectInWorkspace(request.params.id, request.auth.workspaceId);
      if (!project) return reply.status(404).send({ error: "Project not found" });

      const rows = await db
        .select()
        .from(payments)
        .where(eq(payments.contractId, request.params.contractId))
        .orderBy(asc(payments.invoiceDate));
      return { data: rows };
    }
  );

  app.post(
    "/projects/:id/contracts/:contractId/payments",
    async (
      request: FastifyRequest<{ Params: { id: string; contractId: string } }>,
      reply: FastifyReply
    ) => {
      if (!request.auth) return reply.status(401).send({ error: "Unauthorized" });
      if (request.auth.role !== "architect_admin") {
        return reply.status(403).send({ error: "Forbidden" });
      }
      const project = await ensureProjectInWorkspace(request.params.id, request.auth.workspaceId);
      if (!project) return reply.status(404).send({ error: "Project not found" });

      const contract = await ensureContractInProject(request.params.contractId, request.params.id);
      if (!contract) return reply.status(404).send({ error: "Contract not found" });

      const parsed = validateBody(createPaymentSchema, request.body);
      if (!parsed.success) return reply.status(400).send({ error: parsed.error });

      // Roll up cumulative net from prior payments.
      const [{ priorNet }] = await db
        .select({ priorNet: sql<number>`COALESCE(SUM(${payments.amountNet}), 0)::int` })
        .from(payments)
        .where(eq(payments.contractId, contract.id));

      const cumulativeNet = priorNet + parsed.data.amountNet;

      const [row] = await db
        .insert(payments)
        .values({
          contractId: contract.id,
          projectId: request.params.id,
          ...parsed.data,
          cumulativeNet,
        })
        .returning();

      await logAudit({
        workspaceId: request.auth.workspaceId,
        projectId: request.params.id,
        userId: request.auth.userId,
        action: "payment.create",
        entityType: "payment",
        entityId: row.id,
        afterState: { type: row.type, amountNet: row.amountNet, cumulativeNet },
      });

      return reply.status(201).send({ data: row });
    }
  );

  app.patch(
    "/projects/:id/contracts/:contractId/payments/:paymentId",
    async (
      request: FastifyRequest<{
        Params: { id: string; contractId: string; paymentId: string };
      }>,
      reply: FastifyReply
    ) => {
      if (!request.auth) return reply.status(401).send({ error: "Unauthorized" });
      if (request.auth.role !== "architect_admin") {
        return reply.status(403).send({ error: "Forbidden" });
      }
      const project = await ensureProjectInWorkspace(request.params.id, request.auth.workspaceId);
      if (!project) return reply.status(404).send({ error: "Project not found" });

      const parsed = validateBody(updatePaymentSchema, request.body);
      if (!parsed.success) return reply.status(400).send({ error: parsed.error });

      const updateData: Record<string, unknown> = { ...parsed.data };
      if (parsed.data.status === "approved" || parsed.data.status === "paid") {
        updateData.reviewedBy = request.auth.userId;
      }
      if (parsed.data.status === "paid" && !parsed.data.paidDate) {
        updateData.paidDate = new Date().toISOString().slice(0, 10);
      }

      const [row] = await db
        .update(payments)
        .set(updateData)
        .where(
          and(eq(payments.id, request.params.paymentId), eq(payments.contractId, request.params.contractId))
        )
        .returning();

      if (!row) return reply.status(404).send({ error: "Payment not found" });

      await logAudit({
        workspaceId: request.auth.workspaceId,
        projectId: request.params.id,
        userId: request.auth.userId,
        action: "payment.update",
        entityType: "payment",
        entityId: row.id,
        afterState: parsed.data,
      });

      return { data: row };
    }
  );

  // ─── Abnahmen ────────────────────────────────────────────────

  app.get(
    "/projects/:id/contracts/:contractId/abnahmen",
    async (
      request: FastifyRequest<{ Params: { id: string; contractId: string } }>,
      reply: FastifyReply
    ) => {
      if (!request.auth) return reply.status(401).send({ error: "Unauthorized" });
      const project = await ensureProjectInWorkspace(request.params.id, request.auth.workspaceId);
      if (!project) return reply.status(404).send({ error: "Project not found" });

      const rows = await db
        .select()
        .from(abnahmen)
        .where(eq(abnahmen.contractId, request.params.contractId))
        .orderBy(asc(abnahmen.scheduledDate));
      return { data: rows };
    }
  );

  app.post(
    "/projects/:id/contracts/:contractId/abnahmen",
    async (
      request: FastifyRequest<{ Params: { id: string; contractId: string } }>,
      reply: FastifyReply
    ) => {
      if (!request.auth) return reply.status(401).send({ error: "Unauthorized" });
      if (request.auth.role !== "architect_admin") {
        return reply.status(403).send({ error: "Forbidden" });
      }
      const project = await ensureProjectInWorkspace(request.params.id, request.auth.workspaceId);
      if (!project) return reply.status(404).send({ error: "Project not found" });

      const contract = await ensureContractInProject(request.params.contractId, request.params.id);
      if (!contract) return reply.status(404).send({ error: "Contract not found" });

      const parsed = validateBody(createAbnahmeSchema, request.body);
      if (!parsed.success) return reply.status(400).send({ error: parsed.error });

      // Ensure attendees match the JSONB type (company is required string).
      const attendees = (parsed.data.attendees ?? []).map((a) => ({
        name: a.name,
        role: a.role,
        company: a.company ?? "",
      }));

      const [row] = await db
        .insert(abnahmen)
        .values({
          contractId: contract.id,
          projectId: request.params.id,
          type: parsed.data.type,
          scheduledDate: parsed.data.scheduledDate,
          notes: parsed.data.notes ?? null,
          attendees,
          createdBy: request.auth.userId,
        })
        .returning();

      await logAudit({
        workspaceId: request.auth.workspaceId,
        projectId: request.params.id,
        userId: request.auth.userId,
        action: "abnahme.create",
        entityType: "abnahme",
        entityId: row.id,
        afterState: { type: row.type, scheduledDate: row.scheduledDate },
      });

      return reply.status(201).send({ data: row });
    }
  );

  app.patch(
    "/projects/:id/contracts/:contractId/abnahmen/:abnahmeId",
    async (
      request: FastifyRequest<{
        Params: { id: string; contractId: string; abnahmeId: string };
      }>,
      reply: FastifyReply
    ) => {
      if (!request.auth) return reply.status(401).send({ error: "Unauthorized" });
      if (request.auth.role !== "architect_admin") {
        return reply.status(403).send({ error: "Forbidden" });
      }
      const project = await ensureProjectInWorkspace(request.params.id, request.auth.workspaceId);
      if (!project) return reply.status(404).send({ error: "Project not found" });

      const parsed = validateBody(updateAbnahmeSchema, request.body);
      if (!parsed.success) return reply.status(400).send({ error: parsed.error });

      const updateData: Record<string, unknown> = { ...parsed.data };

      // When a formal Abnahme is recorded as completed, set warranty start
      // automatically per VOB/B § 13.4 (Verjährungsbeginn).
      if (
        (parsed.data.status === "completed_without_defects" ||
          parsed.data.status === "completed_with_defects") &&
        !parsed.data.warrantyStartDate
      ) {
        updateData.warrantyStartDate =
          parsed.data.actualDate ?? new Date().toISOString().slice(0, 10);
      }

      const [row] = await db
        .update(abnahmen)
        .set(updateData)
        .where(
          and(eq(abnahmen.id, request.params.abnahmeId), eq(abnahmen.contractId, request.params.contractId))
        )
        .returning();

      if (!row) return reply.status(404).send({ error: "Abnahme not found" });

      // If warranty start was set, propagate to contract.warrantyEndDate
      // using contract.warrantyPeriodMonths.
      if (updateData.warrantyStartDate) {
        const contract = await ensureContractInProject(
          request.params.contractId,
          request.params.id
        );
        if (contract) {
          const start = new Date(updateData.warrantyStartDate as string);
          const end = new Date(start);
          end.setMonth(end.getMonth() + (contract.warrantyPeriodMonths ?? 48));
          await db
            .update(contracts)
            .set({
              abnahmeDate: updateData.warrantyStartDate as string,
              warrantyEndDate: end.toISOString().slice(0, 10),
              status: "in_warranty",
            })
            .where(eq(contracts.id, contract.id));
        }
      }

      await logAudit({
        workspaceId: request.auth.workspaceId,
        projectId: request.params.id,
        userId: request.auth.userId,
        action: "abnahme.update",
        entityType: "abnahme",
        entityId: row.id,
        afterState: parsed.data,
      });

      return { data: row };
    }
  );

  // ─── Nachträge ───────────────────────────────────────────────

  app.get(
    "/projects/:id/contracts/:contractId/nachtraege",
    async (
      request: FastifyRequest<{ Params: { id: string; contractId: string } }>,
      reply: FastifyReply
    ) => {
      if (!request.auth) return reply.status(401).send({ error: "Unauthorized" });
      const project = await ensureProjectInWorkspace(request.params.id, request.auth.workspaceId);
      if (!project) return reply.status(404).send({ error: "Project not found" });

      const rows = await db
        .select()
        .from(nachtraege)
        .where(eq(nachtraege.contractId, request.params.contractId))
        .orderBy(desc(nachtraege.submittedAt));
      return { data: rows };
    }
  );

  app.post(
    "/projects/:id/contracts/:contractId/nachtraege",
    async (
      request: FastifyRequest<{ Params: { id: string; contractId: string } }>,
      reply: FastifyReply
    ) => {
      if (!request.auth) return reply.status(401).send({ error: "Unauthorized" });
      const project = await ensureProjectInWorkspace(request.params.id, request.auth.workspaceId);
      if (!project) return reply.status(404).send({ error: "Project not found" });

      const contract = await ensureContractInProject(request.params.contractId, request.params.id);
      if (!contract) return reply.status(404).send({ error: "Contract not found" });

      const parsed = validateBody(createNachtragSchema, request.body);
      if (!parsed.success) return reply.status(400).send({ error: parsed.error });

      const [row] = await db
        .insert(nachtraege)
        .values({
          contractId: contract.id,
          projectId: request.params.id,
          ...parsed.data,
        })
        .returning();

      await logAudit({
        workspaceId: request.auth.workspaceId,
        projectId: request.params.id,
        userId: request.auth.userId,
        action: "nachtrag.create",
        entityType: "nachtrag",
        entityId: row.id,
        afterState: { type: row.type, requestedAmountNet: row.requestedAmountNet },
      });

      return reply.status(201).send({ data: row });
    }
  );

  app.patch(
    "/projects/:id/contracts/:contractId/nachtraege/:nachtragId",
    async (
      request: FastifyRequest<{
        Params: { id: string; contractId: string; nachtragId: string };
      }>,
      reply: FastifyReply
    ) => {
      if (!request.auth) return reply.status(401).send({ error: "Unauthorized" });
      if (request.auth.role !== "architect_admin") {
        return reply.status(403).send({ error: "Forbidden" });
      }
      const project = await ensureProjectInWorkspace(request.params.id, request.auth.workspaceId);
      if (!project) return reply.status(404).send({ error: "Project not found" });

      const parsed = validateBody(updateNachtragSchema, request.body);
      if (!parsed.success) return reply.status(400).send({ error: parsed.error });

      const updateData: Record<string, unknown> = { ...parsed.data };
      if (parsed.data.status === "approved" || parsed.data.status === "rejected" || parsed.data.status === "partially_approved") {
        updateData.reviewedBy = request.auth.userId;
        updateData.reviewedAt = new Date();
      }

      const [row] = await db
        .update(nachtraege)
        .set(updateData)
        .where(
          and(
            eq(nachtraege.id, request.params.nachtragId),
            eq(nachtraege.contractId, request.params.contractId)
          )
        )
        .returning();

      if (!row) return reply.status(404).send({ error: "Nachtrag not found" });

      await logAudit({
        workspaceId: request.auth.workspaceId,
        projectId: request.params.id,
        userId: request.auth.userId,
        action: "nachtrag.update",
        entityType: "nachtrag",
        entityId: row.id,
        afterState: parsed.data,
      });

      return { data: row };
    }
  );
}
