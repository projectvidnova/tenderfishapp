import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { db, projects, consultants, gates, tenderPackages, bidders, users, contracts } from "@tenderfish/db";
import { eq, and, asc, desc } from "drizzle-orm";
import { logAudit } from "../utils/audit";

const DEFAULT_READINESS_CRITERIA = [
  { key: "scope_description", label: "Clear scope description", met: false },
  { key: "project_state_visible", label: "Current project state visible", met: false },
  { key: "expected_outputs", label: "Expected outputs defined", met: false },
  { key: "input_documents", label: "Required input documents available", met: false },
  { key: "interfaces_identified", label: "Interfaces identified", met: false },
  { key: "internal_approval", label: "Internal approval to invite", met: false },
];

async function verifyProject(projectId: string, workspaceId: string) {
  return db.query.projects.findFirst({
    where: and(eq(projects.id, projectId), eq(projects.workspaceId, workspaceId)),
  });
}

export async function consultantRoutes(app: FastifyInstance) {
  // ─── CONSULTANTS ────────────────────────────────────────────

  // GET /api/projects/:id/consultants
  app.get("/projects/:id/consultants", async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.auth) return reply.status(401).send({ error: "Unauthorized" });
    const { id } = request.params as { id: string };

    const project = await verifyProject(id, request.auth.workspaceId);
    if (!project) return reply.status(404).send({ error: "Project not found" });

    const list = await db.query.consultants.findMany({
      where: eq(consultants.projectId, id),
    });

    // Check Gate C status for invitation lock
    const gateC = await db.query.gates.findFirst({
      where: and(eq(gates.projectId, id), eq(gates.gate, "C")),
    });
    const gateCOpen = gateC?.status === "complete" || gateC?.status === "overridden";

    const enriched = list.map((c) => {
      const criteria = (c.readinessCriteria || []) as { key: string; label: string; met: boolean }[];
      const total = criteria.length;
      const met = criteria.filter((cr) => cr.met).length;
      const allMet = total > 0 && met === total;
      return {
        ...c,
        readinessPercent: total > 0 ? Math.round((met / total) * 100) : 0,
        criteriaMet: met,
        criteriaTotal: total,
        canInvite: allMet && gateCOpen,
        gateCOpen,
      };
    });

    return { data: enriched, gateCOpen };
  });

  // POST /api/projects/:id/consultants
  app.post("/projects/:id/consultants", async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.auth) return reply.status(401).send({ error: "Unauthorized" });
    const { id } = request.params as { id: string };
    const body = request.body as {
      discipline: string;
      contactName?: string;
      company?: string;
      email?: string;
    };

    const project = await verifyProject(id, request.auth.workspaceId);
    if (!project) return reply.status(404).send({ error: "Project not found" });

    if (!body.discipline?.trim()) {
      return reply.status(400).send({ error: "Discipline is required" });
    }

    const [created] = await db
      .insert(consultants)
      .values({
        projectId: id,
        discipline: body.discipline.trim(),
        contactName: body.contactName || null,
        company: body.company || null,
        email: body.email || null,
        readinessCriteria: DEFAULT_READINESS_CRITERIA,
        invitationStatus: "not_ready",
      })
      .returning();

    return reply.status(201).send({ data: created });
  });

  // PATCH /api/projects/:id/consultants/:consultantId
  app.patch("/projects/:id/consultants/:consultantId", async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.auth) return reply.status(401).send({ error: "Unauthorized" });
    const { id, consultantId } = request.params as { id: string; consultantId: string };
    const body = request.body as {
      discipline?: string;
      contactName?: string;
      company?: string;
      email?: string;
      readinessCriteria?: { key: string; label: string; met: boolean }[];
      invitationStatus?: string;
    };

    const project = await verifyProject(id, request.auth.workspaceId);
    if (!project) return reply.status(404).send({ error: "Project not found" });

    const existing = await db.query.consultants.findFirst({
      where: and(eq(consultants.id, consultantId), eq(consultants.projectId, id)),
    });
    if (!existing) return reply.status(404).send({ error: "Consultant not found" });

    const updates: Record<string, unknown> = {};
    if (body.discipline !== undefined) updates.discipline = body.discipline;
    if (body.contactName !== undefined) updates.contactName = body.contactName;
    if (body.company !== undefined) updates.company = body.company;
    if (body.email !== undefined) updates.email = body.email;
    if (body.readinessCriteria !== undefined) updates.readinessCriteria = body.readinessCriteria;
    if (body.invitationStatus !== undefined) updates.invitationStatus = body.invitationStatus;

    const [updated] = await db
      .update(consultants)
      .set(updates)
      .where(eq(consultants.id, consultantId))
      .returning();

    return { data: updated };
  });

  // POST /api/projects/:id/consultants/:consultantId/invite
  app.post("/projects/:id/consultants/:consultantId/invite", async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.auth) return reply.status(401).send({ error: "Unauthorized" });
    const { id, consultantId } = request.params as { id: string; consultantId: string };

    const project = await verifyProject(id, request.auth.workspaceId);
    if (!project) return reply.status(404).send({ error: "Project not found" });

    const consultant = await db.query.consultants.findFirst({
      where: and(eq(consultants.id, consultantId), eq(consultants.projectId, id)),
    });
    if (!consultant) return reply.status(404).send({ error: "Consultant not found" });

    // Check all criteria met
    const criteria = (consultant.readinessCriteria || []) as { key: string; label: string; met: boolean }[];
    const allMet = criteria.length > 0 && criteria.every((c) => c.met);
    if (!allMet) return reply.status(400).send({ error: "Not all readiness criteria are met" });

    // Check Gate C
    const gateC = await db.query.gates.findFirst({
      where: and(eq(gates.projectId, id), eq(gates.gate, "C")),
    });
    if (gateC?.status !== "complete" && gateC?.status !== "overridden") {
      return reply.status(400).send({ error: "Gate C must be complete before inviting consultants" });
    }

    const [updated] = await db
      .update(consultants)
      .set({
        invitationStatus: "invited",
        invitedAt: new Date(),
        invitedBy: request.auth.userId,
      })
      .where(eq(consultants.id, consultantId))
      .returning();

    return { data: updated };
  });

  // DELETE /api/projects/:id/consultants/:consultantId
  app.delete("/projects/:id/consultants/:consultantId", async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.auth) return reply.status(401).send({ error: "Unauthorized" });
    const { id, consultantId } = request.params as { id: string; consultantId: string };

    const project = await verifyProject(id, request.auth.workspaceId);
    if (!project) return reply.status(404).send({ error: "Project not found" });

    await db.delete(consultants).where(and(eq(consultants.id, consultantId), eq(consultants.projectId, id)));
    return { success: true };
  });

  // ─── TENDER PACKAGES ───────────────────────────────────────

  // GET /api/projects/:id/tender-packages
  app.get("/projects/:id/tender-packages", async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.auth) return reply.status(401).send({ error: "Unauthorized" });
    const { id } = request.params as { id: string };

    const project = await verifyProject(id, request.auth.workspaceId);
    if (!project) return reply.status(404).send({ error: "Project not found" });

    const packages = await db.query.tenderPackages.findMany({
      where: eq(tenderPackages.projectId, id),
    });

    // Enrich with bidder counts
    const enriched = await Promise.all(
      packages.map(async (pkg) => {
        const bidderList = await db.query.bidders.findMany({
          where: eq(bidders.packageId, pkg.id),
        });
        const lead = pkg.leadUserId
          ? await db.query.users.findFirst({ where: eq(users.id, pkg.leadUserId) })
          : null;
        return {
          ...pkg,
          leadName: lead?.name || null,
          bidderCount: bidderList.length,
          returnedCount: bidderList.filter((b) => b.status === "returned").length,
          awardedBidder: bidderList.find((b) => b.status === "awarded") || null,
        };
      })
    );

    return { data: enriched };
  });

  // POST /api/projects/:id/tender-packages
  app.post("/projects/:id/tender-packages", async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.auth) return reply.status(401).send({ error: "Unauthorized" });
    const { id } = request.params as { id: string };
    const body = request.body as {
      name: string;
      description?: string;
      scope?: string;
      procurementModel?: string;
      targetTenderDate?: string;
    };

    const project = await verifyProject(id, request.auth.workspaceId);
    if (!project) return reply.status(404).send({ error: "Project not found" });

    if (!body.name?.trim()) {
      return reply.status(400).send({ error: "Package name is required" });
    }

    const [created] = await db
      .insert(tenderPackages)
      .values({
        projectId: id,
        name: body.name.trim(),
        description: body.description || null,
        scope: body.scope || null,
        procurementModel: (body.procurementModel as "general_contractor" | "single_trades" | "unclear") || "unclear",
        targetTenderDate: body.targetTenderDate || null,
      })
      .returning();

    return reply.status(201).send({ data: created });
  });

  // PATCH /api/projects/:id/tender-packages/:packageId
  app.patch("/projects/:id/tender-packages/:packageId", async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.auth) return reply.status(401).send({ error: "Unauthorized" });
    const { id, packageId } = request.params as { id: string; packageId: string };
    const body = request.body as {
      name?: string;
      description?: string;
      scope?: string;
      procurementModel?: string;
      leadUserId?: string;
      targetTenderDate?: string;
      tenderReady?: boolean;
      invitationEnabled?: boolean;
      readinessScore?: number;
      blockers?: { description: string; gateRef?: string; resolved: boolean }[];
    };

    const project = await verifyProject(id, request.auth.workspaceId);
    if (!project) return reply.status(404).send({ error: "Project not found" });

    const existing = await db.query.tenderPackages.findFirst({
      where: and(eq(tenderPackages.id, packageId), eq(tenderPackages.projectId, id)),
    });
    if (!existing) return reply.status(404).send({ error: "Tender package not found" });

    const updates: Record<string, unknown> = {};
    if (body.name !== undefined) updates.name = body.name;
    if (body.description !== undefined) updates.description = body.description;
    if (body.scope !== undefined) updates.scope = body.scope;
    if (body.procurementModel !== undefined) updates.procurementModel = body.procurementModel;
    if (body.leadUserId !== undefined) updates.leadUserId = body.leadUserId;
    if (body.targetTenderDate !== undefined) updates.targetTenderDate = body.targetTenderDate;
    if (body.tenderReady !== undefined) updates.tenderReady = body.tenderReady;
    if (body.invitationEnabled !== undefined) updates.invitationEnabled = body.invitationEnabled;
    if (body.readinessScore !== undefined) updates.readinessScore = body.readinessScore;
    if (body.blockers !== undefined) updates.blockers = body.blockers;

    const [updated] = await db
      .update(tenderPackages)
      .set(updates)
      .where(eq(tenderPackages.id, packageId))
      .returning();

    return { data: updated };
  });

  // DELETE /api/projects/:id/tender-packages/:packageId
  app.delete("/projects/:id/tender-packages/:packageId", async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.auth) return reply.status(401).send({ error: "Unauthorized" });
    const { id, packageId } = request.params as { id: string; packageId: string };

    const project = await verifyProject(id, request.auth.workspaceId);
    if (!project) return reply.status(404).send({ error: "Project not found" });

    await db.delete(tenderPackages).where(and(eq(tenderPackages.id, packageId), eq(tenderPackages.projectId, id)));
    return { success: true };
  });

  // ─── BIDDERS ────────────────────────────────────────────────

  // GET /api/projects/:id/tender-packages/:packageId/bidders
  app.get("/projects/:id/tender-packages/:packageId/bidders", async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.auth) return reply.status(401).send({ error: "Unauthorized" });
    const { id, packageId } = request.params as { id: string; packageId: string };

    const project = await verifyProject(id, request.auth.workspaceId);
    if (!project) return reply.status(404).send({ error: "Project not found" });

    const list = await db.query.bidders.findMany({
      where: eq(bidders.packageId, packageId),
    });

    return { data: list };
  });

  // POST /api/projects/:id/tender-packages/:packageId/bidders
  app.post("/projects/:id/tender-packages/:packageId/bidders", async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.auth) return reply.status(401).send({ error: "Unauthorized" });
    const { id, packageId } = request.params as { id: string; packageId: string };
    const body = request.body as {
      company: string;
      contactName?: string;
      email?: string;
      returnDue?: string;
    };

    const project = await verifyProject(id, request.auth.workspaceId);
    if (!project) return reply.status(404).send({ error: "Project not found" });

    if (!body.company?.trim()) {
      return reply.status(400).send({ error: "Company name is required" });
    }

    const [created] = await db
      .insert(bidders)
      .values({
        packageId,
        projectId: id,
        company: body.company.trim(),
        contactName: body.contactName || null,
        email: body.email || null,
        returnDue: body.returnDue || null,
      })
      .returning();

    return reply.status(201).send({ data: created });
  });

  // PATCH /api/projects/:id/tender-packages/:packageId/bidders/:bidderId
  app.patch("/projects/:id/tender-packages/:packageId/bidders/:bidderId", async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.auth) return reply.status(401).send({ error: "Unauthorized" });
    const { id, packageId, bidderId } = request.params as { id: string; packageId: string; bidderId: string };
    const body = request.body as {
      status?: string;
      offerAmount?: number;
      offerNotes?: string;
      returnDue?: string;
    };

    const project = await verifyProject(id, request.auth.workspaceId);
    if (!project) return reply.status(404).send({ error: "Project not found" });

    const existing = await db.query.bidders.findFirst({
      where: and(eq(bidders.id, bidderId), eq(bidders.packageId, packageId)),
    });
    if (!existing) return reply.status(404).send({ error: "Bidder not found" });

    const updates: Record<string, unknown> = {};
    if (body.status !== undefined) {
      updates.status = body.status;
      if (body.status === "returned") updates.returnedAt = new Date();
    }
    if (body.offerAmount !== undefined) updates.offerAmount = body.offerAmount;
    if (body.offerNotes !== undefined) updates.offerNotes = body.offerNotes;
    if (body.returnDue !== undefined) updates.returnDue = body.returnDue;

    const [updated] = await db
      .update(bidders)
      .set(updates)
      .where(eq(bidders.id, bidderId))
      .returning();

    return { data: updated };
  });

  // POST /api/projects/:id/tender-packages/:packageId/bidders/:bidderId/award
  app.post("/projects/:id/tender-packages/:packageId/bidders/:bidderId/award", async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.auth) return reply.status(401).send({ error: "Unauthorized" });
    const { id, packageId, bidderId } = request.params as { id: string; packageId: string; bidderId: string };

    const project = await verifyProject(id, request.auth.workspaceId);
    if (!project) return reply.status(404).send({ error: "Project not found" });

    const bidder = await db.query.bidders.findFirst({
      where: and(eq(bidders.id, bidderId), eq(bidders.packageId, packageId)),
    });
    if (!bidder) return reply.status(404).send({ error: "Bidder not found" });
    if (bidder.status !== "returned") {
      return reply.status(400).send({ error: "Only returned bids can be awarded" });
    }

    // Mark this bidder as awarded
    const [updated] = await db
      .update(bidders)
      .set({
        status: "awarded",
        awardedAt: new Date(),
        awardedBy: request.auth.userId,
      })
      .where(eq(bidders.id, bidderId))
      .returning();

    await logAudit({
      workspaceId: request.auth.workspaceId,
      projectId: id,
      userId: request.auth.userId,
      action: "bidder.award",
      entityType: "bidder",
      entityId: bidderId,
      beforeState: { status: bidder.status, company: bidder.company },
      afterState: { status: "awarded", company: bidder.company },
    });

    // Bridge to post-tender lifecycle: create a draft VOB/B contract from
    // the awarded bidder + advance the project state to `awarded` if it's
    // still at `released_for_tender`. Both actions are best-effort — if
    // they fail, the award itself still stands.
    let contractId: string | null = null;
    try {
      const offerNet = bidder.offerAmount ?? 0;
      const offerGross = Math.round(offerNet * 1.19);
      const pkg = await db.query.tenderPackages.findFirst({
        where: eq(tenderPackages.id, packageId),
      });
      const [contract] = await db
        .insert(contracts)
        .values({
          projectId: id,
          packageId,
          title: pkg?.name ? `Vertrag: ${pkg.name}` : `Vertrag: ${bidder.company}`,
          contractType: "vob_b",
          contractorCompany: bidder.company,
          contractorContact: bidder.contactName ?? null,
          contractorEmail: bidder.email ?? null,
          contractValueNet: offerNet,
          contractValueGross: offerGross,
          warrantyPeriodMonths: 48,
          awardDate: new Date().toISOString().slice(0, 10),
          status: "draft",
          createdBy: request.auth.userId,
        })
        .returning();
      contractId = contract.id;

      await logAudit({
        workspaceId: request.auth.workspaceId,
        projectId: id,
        userId: request.auth.userId,
        action: "contract.create",
        entityType: "contract",
        entityId: contract.id,
        afterState: { source: "bidder.award", contractor: contract.contractorCompany, value: contract.contractValueNet },
      });
    } catch (err) {
      request.log.warn({ err, bidderId }, "Failed to auto-create contract from award");
    }

    try {
      const [proj] = await db
        .select({ lifecycleState: projects.lifecycleState })
        .from(projects)
        .where(eq(projects.id, id))
        .limit(1);
      if (proj?.lifecycleState === "released_for_tender") {
        await db.update(projects).set({ lifecycleState: "awarded" }).where(eq(projects.id, id));
        await logAudit({
          workspaceId: request.auth.workspaceId,
          projectId: id,
          userId: request.auth.userId,
          action: "project.lifecycle.transition",
          entityType: "project",
          entityId: id,
          beforeState: { lifecycleState: "released_for_tender" },
          afterState: { lifecycleState: "awarded", trigger: "bidder.award" },
        });
      }
    } catch (err) {
      request.log.warn({ err, projectId: id }, "Failed to advance lifecycle to awarded");
    }

    return { data: { ...updated, contractId } };
  });
}
