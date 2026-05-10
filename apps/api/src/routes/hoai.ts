import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { db, hoaiFeeCalculations, projects } from "@tenderfish/db";
import { and, desc, eq } from "drizzle-orm";
import {
  createHoaiCalculationSchema,
  updateHoaiCalculationSchema,
  validateBody,
} from "../lib/validation";
import { logAudit } from "../utils/audit";
import { calculateHoai } from "../services/hoai-calculator";
import { refreshAndAutoCompleteGates } from "../services/gate-evaluator";

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

async function ensureCalculationInProject(
  calcId: string,
  projectId: string
): Promise<typeof hoaiFeeCalculations.$inferSelect | null> {
  const [row] = await db
    .select()
    .from(hoaiFeeCalculations)
    .where(and(eq(hoaiFeeCalculations.id, calcId), eq(hoaiFeeCalculations.projectId, projectId)))
    .limit(1);
  return row ?? null;
}

export async function hoaiRoutes(app: FastifyInstance) {
  // GET /api/projects/:id/hoai — list all calculations for the project
  app.get(
    "/projects/:id/hoai",
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      if (!request.auth) return reply.status(401).send({ error: "Unauthorized" });
      const project = await ensureProjectInWorkspace(request.params.id, request.auth.workspaceId);
      if (!project) return reply.status(404).send({ error: "Project not found" });

      const rows = await db
        .select()
        .from(hoaiFeeCalculations)
        .where(eq(hoaiFeeCalculations.projectId, request.params.id))
        .orderBy(desc(hoaiFeeCalculations.calculatedAt));

      return { data: rows };
    }
  );

  // POST /api/projects/:id/hoai — create or replace calculation for a service type
  app.post(
    "/projects/:id/hoai",
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      if (!request.auth) return reply.status(401).send({ error: "Unauthorized" });
      if (request.auth.role !== "architect_admin") {
        return reply.status(403).send({ error: "Forbidden" });
      }
      const project = await ensureProjectInWorkspace(request.params.id, request.auth.workspaceId);
      if (!project) return reply.status(404).send({ error: "Project not found" });

      const parsed = validateBody(createHoaiCalculationSchema, request.body);
      if (!parsed.success) return reply.status(400).send({ error: parsed.error });

      let result;
      try {
        result = calculateHoai({
          anrechenbareKostenCents: parsed.data.anrechenbareKosten,
          feeZone: parsed.data.feeZone,
          feePositionInZone: parsed.data.feePositionInZone,
          serviceType: parsed.data.serviceType,
          commissionedPhases: parsed.data.commissionedPhases,
          modifiers: parsed.data.modifiers,
        });
      } catch (err) {
        return reply.status(400).send({
          error: "Calculation failed",
          message: err instanceof Error ? err.message : "Unknown error",
        });
      }

      // One calculation per (project, serviceType): replace if exists.
      const existing = await db
        .select()
        .from(hoaiFeeCalculations)
        .where(
          and(
            eq(hoaiFeeCalculations.projectId, request.params.id),
            eq(hoaiFeeCalculations.serviceType, parsed.data.serviceType)
          )
        )
        .limit(1);

      const values = {
        projectId: request.params.id,
        serviceType: parsed.data.serviceType,
        feeZone: parsed.data.feeZone,
        anrechenbareKosten: parsed.data.anrechenbareKosten,
        feePositionInZone: parsed.data.feePositionInZone,
        baseFee: result.baseFee,
        commissionedPhases: parsed.data.commissionedPhases,
        phaseFees: result.phaseFees,
        modifiers: parsed.data.modifiers,
        totalFee: result.totalFee,
        notes: parsed.data.notes ?? null,
        calculatedAt: new Date(),
        createdBy: request.auth.userId,
      };

      let row: typeof hoaiFeeCalculations.$inferSelect;
      if (existing.length > 0) {
        const [updated] = await db
          .update(hoaiFeeCalculations)
          .set(values)
          .where(eq(hoaiFeeCalculations.id, existing[0].id))
          .returning();
        row = updated;
      } else {
        const [created] = await db.insert(hoaiFeeCalculations).values(values).returning();
        row = created;
      }

      await logAudit({
        workspaceId: request.auth.workspaceId,
        projectId: request.params.id,
        userId: request.auth.userId,
        action: "hoai.calculate",
        entityType: "hoai_calculation",
        entityId: row.id,
        afterState: {
          serviceType: row.serviceType,
          feeZone: row.feeZone,
          totalFee: row.totalFee,
          extrapolated: result.extrapolated,
        },
      });

      // Tick Gate B's hoai_fee_zone criterion + advance lifecycle journey.
      await refreshAndAutoCompleteGates(request.params.id);

      return reply.status(201).send({ data: { ...row, extrapolated: result.extrapolated } });
    }
  );

  // POST /api/projects/:id/hoai/:calcId/recalculate — re-run with stored inputs
  // (useful after the HOAI fee table is updated server-side; otherwise identical to POST)
  app.post(
    "/projects/:id/hoai/:calcId/recalculate",
    async (
      request: FastifyRequest<{ Params: { id: string; calcId: string } }>,
      reply: FastifyReply
    ) => {
      if (!request.auth) return reply.status(401).send({ error: "Unauthorized" });
      if (request.auth.role !== "architect_admin") {
        return reply.status(403).send({ error: "Forbidden" });
      }
      const project = await ensureProjectInWorkspace(request.params.id, request.auth.workspaceId);
      if (!project) return reply.status(404).send({ error: "Project not found" });

      const calc = await ensureCalculationInProject(request.params.calcId, request.params.id);
      if (!calc) return reply.status(404).send({ error: "Calculation not found" });

      const result = calculateHoai({
        anrechenbareKostenCents: calc.anrechenbareKosten,
        feeZone: calc.feeZone,
        feePositionInZone: calc.feePositionInZone,
        serviceType: calc.serviceType,
        commissionedPhases: calc.commissionedPhases,
        modifiers: (calc.modifiers ?? []) as { key: string; label: string; factor: number }[],
      });

      const [updated] = await db
        .update(hoaiFeeCalculations)
        .set({
          baseFee: result.baseFee,
          phaseFees: result.phaseFees,
          totalFee: result.totalFee,
          calculatedAt: new Date(),
        })
        .where(eq(hoaiFeeCalculations.id, calc.id))
        .returning();

      await logAudit({
        workspaceId: request.auth.workspaceId,
        projectId: request.params.id,
        userId: request.auth.userId,
        action: "hoai.recalculate",
        entityType: "hoai_calculation",
        entityId: calc.id,
        beforeState: { totalFee: calc.totalFee },
        afterState: { totalFee: updated.totalFee },
      });

      return { data: { ...updated, extrapolated: result.extrapolated } };
    }
  );

  // PATCH /api/projects/:id/hoai/:calcId — update notes (or any subset)
  app.patch(
    "/projects/:id/hoai/:calcId",
    async (
      request: FastifyRequest<{ Params: { id: string; calcId: string } }>,
      reply: FastifyReply
    ) => {
      if (!request.auth) return reply.status(401).send({ error: "Unauthorized" });
      if (request.auth.role !== "architect_admin") {
        return reply.status(403).send({ error: "Forbidden" });
      }
      const project = await ensureProjectInWorkspace(request.params.id, request.auth.workspaceId);
      if (!project) return reply.status(404).send({ error: "Project not found" });

      const calc = await ensureCalculationInProject(request.params.calcId, request.params.id);
      if (!calc) return reply.status(404).send({ error: "Calculation not found" });

      const parsed = validateBody(updateHoaiCalculationSchema, request.body);
      if (!parsed.success) return reply.status(400).send({ error: parsed.error });

      // If structural inputs changed, recompute. Otherwise only metadata fields.
      const structuralChanged =
        parsed.data.serviceType !== undefined ||
        parsed.data.feeZone !== undefined ||
        parsed.data.anrechenbareKosten !== undefined ||
        parsed.data.feePositionInZone !== undefined ||
        parsed.data.commissionedPhases !== undefined ||
        parsed.data.modifiers !== undefined;

      const setValues: Record<string, unknown> = {};
      if (parsed.data.notes !== undefined) setValues.notes = parsed.data.notes;

      if (structuralChanged) {
        const next = {
          serviceType: parsed.data.serviceType ?? calc.serviceType,
          feeZone: parsed.data.feeZone ?? calc.feeZone,
          anrechenbareKosten: parsed.data.anrechenbareKosten ?? calc.anrechenbareKosten,
          feePositionInZone: parsed.data.feePositionInZone ?? calc.feePositionInZone,
          commissionedPhases: parsed.data.commissionedPhases ?? calc.commissionedPhases,
          modifiers:
            parsed.data.modifiers ??
            ((calc.modifiers ?? []) as { key: string; label: string; factor: number }[]),
        };
        let result;
        try {
          result = calculateHoai({
            anrechenbareKostenCents: next.anrechenbareKosten,
            feeZone: next.feeZone,
            feePositionInZone: next.feePositionInZone,
            serviceType: next.serviceType,
            commissionedPhases: next.commissionedPhases,
            modifiers: next.modifiers,
          });
        } catch (err) {
          return reply.status(400).send({
            error: "Calculation failed",
            message: err instanceof Error ? err.message : "Unknown error",
          });
        }
        Object.assign(setValues, {
          serviceType: next.serviceType,
          feeZone: next.feeZone,
          anrechenbareKosten: next.anrechenbareKosten,
          feePositionInZone: next.feePositionInZone,
          commissionedPhases: next.commissionedPhases,
          modifiers: next.modifiers,
          baseFee: result.baseFee,
          phaseFees: result.phaseFees,
          totalFee: result.totalFee,
          calculatedAt: new Date(),
        });
      }

      if (Object.keys(setValues).length === 0) {
        return reply.status(400).send({ error: "No valid fields to update" });
      }

      const [updated] = await db
        .update(hoaiFeeCalculations)
        .set(setValues)
        .where(eq(hoaiFeeCalculations.id, calc.id))
        .returning();

      return { data: updated };
    }
  );

  // DELETE /api/projects/:id/hoai/:calcId
  app.delete(
    "/projects/:id/hoai/:calcId",
    async (
      request: FastifyRequest<{ Params: { id: string; calcId: string } }>,
      reply: FastifyReply
    ) => {
      if (!request.auth) return reply.status(401).send({ error: "Unauthorized" });
      if (request.auth.role !== "architect_admin") {
        return reply.status(403).send({ error: "Forbidden" });
      }
      const project = await ensureProjectInWorkspace(request.params.id, request.auth.workspaceId);
      if (!project) return reply.status(404).send({ error: "Project not found" });

      const calc = await ensureCalculationInProject(request.params.calcId, request.params.id);
      if (!calc) return reply.status(404).send({ error: "Calculation not found" });

      await db.delete(hoaiFeeCalculations).where(eq(hoaiFeeCalculations.id, calc.id));

      await logAudit({
        workspaceId: request.auth.workspaceId,
        projectId: request.params.id,
        userId: request.auth.userId,
        action: "hoai.delete",
        entityType: "hoai_calculation",
        entityId: calc.id,
        beforeState: { serviceType: calc.serviceType, totalFee: calc.totalFee },
      });

      // Re-evaluate gates so Gate B's hoai_fee_zone criterion drops back to unmet
      // if this was the last calculation for the project.
      await refreshAndAutoCompleteGates(request.params.id);

      return { data: { id: calc.id, deleted: true } };
    }
  );
}
