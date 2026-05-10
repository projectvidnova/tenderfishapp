import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { db, projects, projectDescriptions, tenderReleases, participants, projectVersions, documents, costSnapshots, costLineItems, tenderPackages } from "@tenderfish/db";
import { eq, and, desc, sql } from "drizzle-orm";
import {
  PROJECT_STATE_TRANSITIONS,
  getAllowedTransitions,
  isValidTransition,
  READINESS_RULES,
  TENDER_RELEASE_PREREQUISITES,
} from "@tenderfish/shared";
import type { ProjectLifecycleState } from "@tenderfish/shared";
import {
  transitionStateSchema,
  createSpdSchema,
  updateSpdSchema,
  approveResourceSchema,
  createTenderReleaseSchema,
  updateTenderReleaseSchema,
  createParticipantSchema,
  updateParticipantSchema,
  validateBody,
} from "../lib/validation";
import { verifyProjectLvMath } from "../services/gaeb-math-verifier";
import { logAudit } from "../utils/audit";

export async function lifecycleRoutes(app: FastifyInstance) {
  // ═══════════════════════════════════════════════════════════
  // STATE MACHINE
  // ═══════════════════════════════════════════════════════════

  // GET /api/projects/:id/lifecycle — current state + allowed transitions
  app.get("/projects/:id/lifecycle", async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    if (!request.auth) return reply.status(401).send({ error: "Unauthorized" });

    const project = await db.query.projects.findFirst({
      where: and(eq(projects.id, request.params.id), eq(projects.workspaceId, request.auth.workspaceId)),
    });
    if (!project) return reply.status(404).send({ error: "Project not found" });

    const currentState = (project.lifecycleState ?? "input_received") as ProjectLifecycleState;
    const allowed = getAllowedTransitions(currentState);
    const transitions = PROJECT_STATE_TRANSITIONS.filter(t => t.from === currentState);

    return {
      data: {
        currentState,
        allowedTransitions: transitions.map(t => ({
          to: t.to,
          automatic: t.automatic,
          humanRequired: t.humanRequired,
          description: t.description,
        })),
        allowedStates: allowed,
      },
    };
  });

  // POST /api/projects/:id/lifecycle/transition — advance state
  app.post("/projects/:id/lifecycle/transition", async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    if (!request.auth) return reply.status(401).send({ error: "Unauthorized" });

    if (!["architect_admin", "project_lead"].includes(request.auth.role)) {
      return reply.status(403).send({ error: "Only architect admins and project leads can transition state" });
    }

    const parsed = validateBody(transitionStateSchema, request.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error });

    const project = await db.query.projects.findFirst({
      where: and(eq(projects.id, request.params.id), eq(projects.workspaceId, request.auth.workspaceId)),
    });
    if (!project) return reply.status(404).send({ error: "Project not found" });

    const currentState = (project.lifecycleState ?? "input_received") as ProjectLifecycleState;
    const targetState = parsed.data.targetState as ProjectLifecycleState;

    if (!isValidTransition(currentState, targetState)) {
      return reply.status(400).send({
        error: `Invalid transition from '${currentState}' to '${targetState}'`,
        allowedStates: getAllowedTransitions(currentState),
      });
    }

    const rule = PROJECT_STATE_TRANSITIONS.find(t => t.from === currentState && t.to === targetState);
    if (rule?.humanRequired && !request.auth) {
      return reply.status(403).send({ error: "This transition requires human authorization" });
    }

    const [updated] = await db
      .update(projects)
      .set({ lifecycleState: targetState })
      .where(eq(projects.id, request.params.id))
      .returning();

    return { data: { previousState: currentState, currentState: targetState, project: updated } };
  });

  // ═══════════════════════════════════════════════════════════
  // STRUCTURED PROJECT DESCRIPTION (SPD)
  // ═══════════════════════════════════════════════════════════

  // GET /api/projects/:id/spd — get latest SPD
  app.get("/projects/:id/spd", async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    if (!request.auth) return reply.status(401).send({ error: "Unauthorized" });

    const spd = await db.query.projectDescriptions.findFirst({
      where: eq(projectDescriptions.projectId, request.params.id),
      orderBy: desc(projectDescriptions.version),
    });

    return { data: spd ?? null };
  });

  // GET /api/projects/:id/spd/versions — list all SPD versions
  app.get("/projects/:id/spd/versions", async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    if (!request.auth) return reply.status(401).send({ error: "Unauthorized" });

    const versions = await db.query.projectDescriptions.findMany({
      where: eq(projectDescriptions.projectId, request.params.id),
      orderBy: desc(projectDescriptions.version),
    });

    return { data: versions };
  });

  // POST /api/projects/:id/spd — create new SPD version
  app.post("/projects/:id/spd", async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    if (!request.auth) return reply.status(401).send({ error: "Unauthorized" });

    if (!["architect_admin", "project_lead"].includes(request.auth.role)) {
      return reply.status(403).send({ error: "Forbidden" });
    }

    const parsed = validateBody(createSpdSchema, request.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error });

    // Get current max version
    const latest = await db.query.projectDescriptions.findFirst({
      where: eq(projectDescriptions.projectId, request.params.id),
      orderBy: desc(projectDescriptions.version),
    });

    const nextVersion = (latest?.version ?? 0) + 1;

    const [spd] = await db
      .insert(projectDescriptions)
      .values({
        projectId: request.params.id,
        version: nextVersion,
        status: "draft",
        createdBy: request.auth.userId,
        ...parsed.data,
      })
      .returning();

    return reply.status(201).send({ data: spd });
  });

  // PATCH /api/projects/:id/spd/:spdId — update SPD
  app.patch("/projects/:id/spd/:spdId", async (request: FastifyRequest<{ Params: { id: string; spdId: string } }>, reply: FastifyReply) => {
    if (!request.auth) return reply.status(401).send({ error: "Unauthorized" });

    const parsed = validateBody(updateSpdSchema, request.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error });

    const existing = await db.query.projectDescriptions.findFirst({
      where: and(
        eq(projectDescriptions.id, request.params.spdId),
        eq(projectDescriptions.projectId, request.params.id),
      ),
    });
    if (!existing) return reply.status(404).send({ error: "SPD not found" });
    if (existing.status === "approved") {
      return reply.status(400).send({ error: "Cannot edit an approved SPD. Create a new version." });
    }

    const [updated] = await db
      .update(projectDescriptions)
      .set(parsed.data)
      .where(eq(projectDescriptions.id, request.params.spdId))
      .returning();

    return { data: updated };
  });

  // POST /api/projects/:id/spd/:spdId/approve — approve SPD
  app.post("/projects/:id/spd/:spdId/approve", async (request: FastifyRequest<{ Params: { id: string; spdId: string } }>, reply: FastifyReply) => {
    if (!request.auth) return reply.status(401).send({ error: "Unauthorized" });

    if (!["architect_admin"].includes(request.auth.role)) {
      return reply.status(403).send({ error: "Only architect admins can approve SPDs" });
    }

    const existing = await db.query.projectDescriptions.findFirst({
      where: and(
        eq(projectDescriptions.id, request.params.spdId),
        eq(projectDescriptions.projectId, request.params.id),
      ),
    });
    if (!existing) return reply.status(404).send({ error: "SPD not found" });

    const [updated] = await db
      .update(projectDescriptions)
      .set({
        status: "approved",
        approvedBy: request.auth.userId,
        approvedAt: new Date(),
      })
      .where(eq(projectDescriptions.id, request.params.spdId))
      .returning();

    return { data: updated };
  });

  // ═══════════════════════════════════════════════════════════
  // APPROVED RESOURCES
  // ═══════════════════════════════════════════════════════════

  // GET /api/projects/:id/approved-resources — list approved resource documents
  app.get("/projects/:id/approved-resources", async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    if (!request.auth) return reply.status(401).send({ error: "Unauthorized" });

    const approvedDocs = await db.query.documents.findMany({
      where: and(
        eq(documents.projectId, request.params.id),
        eq(documents.isApprovedResource, true),
      ),
    });

    return { data: approvedDocs };
  });

  // POST /api/projects/:id/approved-resources — mark document as approved resource
  app.post("/projects/:id/approved-resources", async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    if (!request.auth) return reply.status(401).send({ error: "Unauthorized" });

    if (!["architect_admin", "project_lead"].includes(request.auth.role)) {
      return reply.status(403).send({ error: "Forbidden" });
    }

    const parsed = validateBody(approveResourceSchema, request.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error });

    const doc = await db.query.documents.findFirst({
      where: and(
        eq(documents.id, parsed.data.documentId),
        eq(documents.projectId, request.params.id),
      ),
    });
    if (!doc) return reply.status(404).send({ error: "Document not found" });

    const [updated] = await db
      .update(documents)
      .set({
        isApprovedResource: true,
        approvedResourceAt: new Date(),
        approvedResourceBy: request.auth.userId,
      })
      .where(eq(documents.id, parsed.data.documentId))
      .returning();

    return { data: updated };
  });

  // DELETE /api/projects/:id/approved-resources/:docId — unmark approved resource
  app.delete("/projects/:id/approved-resources/:docId", async (request: FastifyRequest<{ Params: { id: string; docId: string } }>, reply: FastifyReply) => {
    if (!request.auth) return reply.status(401).send({ error: "Unauthorized" });

    if (!["architect_admin"].includes(request.auth.role)) {
      return reply.status(403).send({ error: "Only architect admins can revoke approved resource status" });
    }

    const [updated] = await db
      .update(documents)
      .set({
        isApprovedResource: false,
        approvedResourceAt: null,
        approvedResourceBy: null,
      })
      .where(and(
        eq(documents.id, request.params.docId),
        eq(documents.projectId, request.params.id),
      ))
      .returning();

    if (!updated) return reply.status(404).send({ error: "Document not found" });
    return { data: updated };
  });

  // ═══════════════════════════════════════════════════════════
  // TENDER RELEASE
  // ═══════════════════════════════════════════════════════════

  // GET /api/projects/:id/tender-release — get tender release status
  app.get("/projects/:id/tender-release", async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    if (!request.auth) return reply.status(401).send({ error: "Unauthorized" });

    const release = await db.query.tenderReleases.findFirst({
      where: eq(tenderReleases.projectId, request.params.id),
      orderBy: desc(tenderReleases.createdAt),
    });

    // Compute prerequisite status
    const prereqs = await computeTenderPrerequisites(request.params.id);

    return { data: { release: release ?? null, prerequisites: prereqs } };
  });

  // POST /api/projects/:id/tender-release — create tender release
  app.post("/projects/:id/tender-release", async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    if (!request.auth) return reply.status(401).send({ error: "Unauthorized" });

    if (!["architect_admin"].includes(request.auth.role)) {
      return reply.status(403).send({ error: "Only architect admins can create tender releases" });
    }

    const parsed = validateBody(createTenderReleaseSchema, request.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error });

    const prereqs = await computeTenderPrerequisites(request.params.id);

    const [release] = await db
      .insert(tenderReleases)
      .values({
        projectId: request.params.id,
        status: "pending_review",
        prerequisites: prereqs,
        notes: parsed.data.notes,
      })
      .returning();

    return reply.status(201).send({ data: release });
  });

  // PATCH /api/projects/:id/tender-release/:releaseId — update release (release / recall)
  app.patch("/projects/:id/tender-release/:releaseId", async (request: FastifyRequest<{ Params: { id: string; releaseId: string } }>, reply: FastifyReply) => {
    if (!request.auth) return reply.status(401).send({ error: "Unauthorized" });

    if (!["architect_admin"].includes(request.auth.role)) {
      return reply.status(403).send({ error: "Only architect admins can update tender releases" });
    }

    const parsed = validateBody(updateTenderReleaseSchema, request.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error });

    const updateData: Record<string, unknown> = { status: parsed.data.status };
    if (parsed.data.notes !== undefined) updateData.notes = parsed.data.notes;

    if (parsed.data.status === "released") {
      // GAEB arithmetic gate — V5 §3 "unapproved BOQs prevent starting a tender"
      const mathReport = await verifyProjectLvMath(request.params.id);
      updateData.gaebMathVerified = mathReport.passed;
      updateData.gaebMathErrors = mathReport.errors;
      updateData.gaebMathCheckedAt = mathReport.checkedAt;

      if (!mathReport.passed) {
        if (!parsed.data.forceRelease) {
          return reply.status(409).send({
            error: "GAEB arithmetic verification failed",
            message: `${mathReport.errors.length} arithmetic discrepancies must be fixed, or release with forceRelease=true and an overrideReason.`,
            report: mathReport,
          });
        }
        if (!parsed.data.overrideReason || parsed.data.overrideReason.trim().length === 0) {
          return reply.status(400).send({
            error: "overrideReason is required when forceRelease is true",
          });
        }
        updateData.mathOverrideReason = parsed.data.overrideReason;
        updateData.mathOverrideBy = request.auth.userId;
        updateData.mathOverrideAt = new Date();

        await logAudit({
          workspaceId: request.auth.workspaceId,
          projectId: request.params.id,
          userId: request.auth.userId,
          action: "tender.release.math_override",
          entityType: "tender_release",
          entityId: request.params.releaseId,
          beforeState: { gaebMathVerified: false, errors: mathReport.errors },
          afterState: {
            forced: true,
            overrideReason: parsed.data.overrideReason,
            errorCount: mathReport.errors.length,
          },
        });
      }

      updateData.releasedBy = request.auth.userId;
      updateData.releasedAt = new Date();
    } else if (parsed.data.status === "recalled") {
      updateData.recalledBy = request.auth.userId;
      updateData.recalledAt = new Date();
      updateData.recallReason = parsed.data.recallReason;
    }

    const [updated] = await db
      .update(tenderReleases)
      .set(updateData)
      .where(and(
        eq(tenderReleases.id, request.params.releaseId),
        eq(tenderReleases.projectId, request.params.id),
      ))
      .returning();

    if (!updated) return reply.status(404).send({ error: "Tender release not found" });
    return { data: updated };
  });

  // ═══════════════════════════════════════════════════════════
  // PARTICIPANTS
  // ═══════════════════════════════════════════════════════════

  // GET /api/projects/:id/participants
  app.get("/projects/:id/participants", async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    if (!request.auth) return reply.status(401).send({ error: "Unauthorized" });

    const list = await db.query.participants.findMany({
      where: eq(participants.projectId, request.params.id),
      orderBy: desc(participants.createdAt),
    });

    return { data: list };
  });

  // POST /api/projects/:id/participants
  app.post("/projects/:id/participants", async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    if (!request.auth) return reply.status(401).send({ error: "Unauthorized" });

    const parsed = validateBody(createParticipantSchema, request.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error });

    const [participant] = await db
      .insert(participants)
      .values({
        projectId: request.params.id,
        ...parsed.data,
      })
      .returning();

    return reply.status(201).send({ data: participant });
  });

  // PATCH /api/projects/:id/participants/:participantId
  app.patch("/projects/:id/participants/:participantId", async (request: FastifyRequest<{ Params: { id: string; participantId: string } }>, reply: FastifyReply) => {
    if (!request.auth) return reply.status(401).send({ error: "Unauthorized" });

    const parsed = validateBody(updateParticipantSchema, request.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error });

    const updateData: Record<string, unknown> = { ...parsed.data };
    if (parsed.data.roleConfirmed) {
      updateData.confirmedBy = request.auth.userId;
      updateData.confirmedAt = new Date();
    }

    const [updated] = await db
      .update(participants)
      .set(updateData)
      .where(and(
        eq(participants.id, request.params.participantId),
        eq(participants.projectId, request.params.id),
      ))
      .returning();

    if (!updated) return reply.status(404).send({ error: "Participant not found" });
    return { data: updated };
  });

  // DELETE /api/projects/:id/participants/:participantId
  app.delete("/projects/:id/participants/:participantId", async (request: FastifyRequest<{ Params: { id: string; participantId: string } }>, reply: FastifyReply) => {
    if (!request.auth) return reply.status(401).send({ error: "Unauthorized" });

    if (!["architect_admin", "project_lead"].includes(request.auth.role)) {
      return reply.status(403).send({ error: "Forbidden" });
    }

    const [deleted] = await db
      .delete(participants)
      .where(and(
        eq(participants.id, request.params.participantId),
        eq(participants.projectId, request.params.id),
      ))
      .returning();

    if (!deleted) return reply.status(404).send({ error: "Participant not found" });
    return { data: deleted };
  });

  // POST /api/projects/:id/participants/:participantId/confirm — confirm role
  app.post("/projects/:id/participants/:participantId/confirm", async (request: FastifyRequest<{ Params: { id: string; participantId: string } }>, reply: FastifyReply) => {
    if (!request.auth) return reply.status(401).send({ error: "Unauthorized" });

    if (!["architect_admin", "project_lead"].includes(request.auth.role)) {
      return reply.status(403).send({ error: "Forbidden" });
    }

    const [updated] = await db
      .update(participants)
      .set({
        roleConfirmed: true,
        confirmedBy: request.auth.userId,
        confirmedAt: new Date(),
      })
      .where(and(
        eq(participants.id, request.params.participantId),
        eq(participants.projectId, request.params.id),
      ))
      .returning();

    if (!updated) return reply.status(404).send({ error: "Participant not found" });
    return { data: updated };
  });

  // ═══════════════════════════════════════════════════════════
  // READINESS CHECK
  // ═══════════════════════════════════════════════════════════

  // GET /api/projects/:id/readiness — compute readiness across all levels
  app.get("/projects/:id/readiness", async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    if (!request.auth) return reply.status(401).send({ error: "Unauthorized" });

    const project = await db.query.projects.findFirst({
      where: and(eq(projects.id, request.params.id), eq(projects.workspaceId, request.auth.workspaceId)),
    });
    if (!project) return reply.status(404).send({ error: "Project not found" });

    // SPD readiness
    const latestSpd = await db.query.projectDescriptions.findFirst({
      where: eq(projectDescriptions.projectId, request.params.id),
      orderBy: desc(projectDescriptions.version),
    });

    const approvedDocs = await db.query.documents.findMany({
      where: and(
        eq(documents.projectId, request.params.id),
        eq(documents.isApprovedResource, true),
      ),
    });

    const spdChecks = READINESS_RULES.spd.checks.map(c => {
      let met = false;
      if (c.key === "spd_exists") met = !!latestSpd;
      else if (c.key === "spd_name") met = !!latestSpd?.projectName;
      else if (c.key === "spd_goal") met = !!latestSpd?.projectGoal;
      else if (c.key === "spd_type") met = !!latestSpd?.projectType;
      else if (c.key === "spd_location") met = !!latestSpd?.location;
      else if (c.key === "spd_scope") met = !!latestSpd?.scopeOfWork;
      else if (c.key === "spd_participants") met = Array.isArray(latestSpd?.participants) && (latestSpd?.participants as unknown[]).length > 0;
      else if (c.key === "spd_approved_resources") met = approvedDocs.length > 0;
      else if (c.key === "spd_open_points") met = !!latestSpd; // captured = exists
      else if (c.key === "spd_approved") met = latestSpd?.status === "approved";
      return { ...c, met };
    });

    // Cost readiness
    const latestCostSnapshot = await db.query.costSnapshots.findFirst({
      where: eq(costSnapshots.projectId, request.params.id),
      orderBy: desc(costSnapshots.createdAt),
    });
    const costItemCount = latestCostSnapshot
      ? await db.select({ count: sql<number>`count(*)` }).from(costLineItems).where(eq(costLineItems.snapshotId, latestCostSnapshot.id))
      : [{ count: 0 }];

    const costChecks = READINESS_RULES.cost.checks.map(c => {
      let met = false;
      if (c.key === "cost_structure_approved") met = latestSpd?.status === "approved";
      if (c.key === "cost_groups_created") met = (costItemCount[0]?.count ?? 0) > 0;
      if (c.key === "cost_items_present") met = (costItemCount[0]?.count ?? 0) > 0;
      if (c.key === "cost_approved_resources") met = approvedDocs.length > 0;
      if (c.key === "cost_snapshot_exists") met = !!latestCostSnapshot;
      if (c.key === "cost_snapshot_approved") met = latestCostSnapshot?.status === "approved";
      return { ...c, met };
    });

    // Detail readiness
    const packages = await db.query.tenderPackages.findMany({
      where: eq(tenderPackages.projectId, request.params.id),
    });
    const detailChecks = READINESS_RULES.detail.checks.map(c => {
      let met = false;
      if (c.key === "detail_packages_defined") met = packages.length > 0;
      if (c.key === "detail_package_descriptions") met = packages.length > 0 && packages.every(p => !!p.description);
      if (c.key === "detail_documents_linked") met = approvedDocs.length > 0;
      if (c.key === "detail_cost_linked") met = !!latestCostSnapshot;
      if (c.key === "detail_critical_gaps") met = false; // TODO: gap detection
      if (c.key === "detail_packages_approved") met = false; // TODO: package approval state
      return { ...c, met };
    });

    // Tender readiness
    const latestRelease = await db.query.tenderReleases.findFirst({
      where: eq(tenderReleases.projectId, request.params.id),
      orderBy: desc(tenderReleases.createdAt),
    });
    const tenderChecks = READINESS_RULES.tender.checks.map(c => {
      let met = false;
      if (c.key === "tender_all_approvals") met = latestSpd?.status === "approved" && latestCostSnapshot?.status === "approved";
      if (c.key === "tender_approved_resources") met = approvedDocs.length > 0;
      if (c.key === "tender_cost_signed_off") met = latestCostSnapshot?.status === "approved";
      if (c.key === "tender_packages_complete") met = packages.length > 0;
      if (c.key === "tender_spd_approved") met = latestSpd?.status === "approved";
      if (c.key === "tender_release_available") met = !!latestRelease;
      if (c.key === "tender_released") met = latestRelease?.status === "released";
      return { ...c, met };
    });

    const levels = [
      { ...READINESS_RULES.spd, checks: spdChecks, score: Math.round(spdChecks.filter(c => c.met).length / spdChecks.length * 100) },
      { ...READINESS_RULES.cost, checks: costChecks, score: Math.round(costChecks.filter(c => c.met).length / costChecks.length * 100) },
      { ...READINESS_RULES.detail, checks: detailChecks, score: Math.round(detailChecks.filter(c => c.met).length / detailChecks.length * 100) },
      { ...READINESS_RULES.tender, checks: tenderChecks, score: Math.round(tenderChecks.filter(c => c.met).length / tenderChecks.length * 100) },
    ];

    return {
      data: {
        projectId: request.params.id,
        lifecycleState: project.lifecycleState,
        levels,
        overallScore: Math.round(levels.reduce((sum, l) => sum + l.score, 0) / levels.length),
      },
    };
  });

  // ── Project Versions ─────────────────────────────────────────

  // GET /projects/:id/versions
  app.get<{ Params: { id: string } }>("/projects/:id/versions", async (request) => {
    const versions = await db.query.projectVersions.findMany({
      where: eq(projectVersions.projectId, request.params.id),
      orderBy: desc(projectVersions.createdAt),
    });
    return { data: versions };
  });

  // POST /projects/:id/versions — create a snapshot
  app.post<{ Params: { id: string }; Body: { label: string } }>(
    "/projects/:id/versions",
    async (request, reply) => {
      const project = await db.query.projects.findFirst({
        where: eq(projects.id, request.params.id),
      });
      if (!project) return reply.code(404).send({ error: "Project not found" });

      const [spd, docs, costs, parts] = await Promise.all([
        db.query.projectDescriptions.findFirst({
          where: eq(projectDescriptions.projectId, request.params.id),
          orderBy: desc(projectDescriptions.createdAt),
        }),
        db.query.documents.findMany({ where: eq(documents.projectId, request.params.id) }),
        db.query.costSnapshots.findMany({ where: eq(costSnapshots.projectId, request.params.id) }),
        db.query.participants.findMany({ where: eq(participants.projectId, request.params.id) }),
      ]);

      const existing = await db.query.projectVersions.findMany({
        where: eq(projectVersions.projectId, request.params.id),
      });
      const nextVersion = existing.length + 1;

      if (existing.length > 0) {
        await db.update(projectVersions)
          .set({ isCurrent: false })
          .where(and(eq(projectVersions.projectId, request.params.id), eq(projectVersions.isCurrent, true)));
      }

      const [version] = await db.insert(projectVersions).values({
        projectId: request.params.id,
        versionNumber: nextVersion,
        label: request.body.label || `Snapshot v${nextVersion}`,
        isCurrent: true,
        snapshotData: {
          project,
          projectDescription: spd || null,
          documentsCount: docs.length,
          costSnapshotsCount: costs.length,
          participantsCount: parts.length,
          snapshotAt: new Date().toISOString(),
        },
      }).returning();

      return reply.code(201).send({ data: version });
    }
  );
}

async function computeTenderPrerequisites(projectId: string) {
  const latestSpd = await db.query.projectDescriptions.findFirst({
    where: eq(projectDescriptions.projectId, projectId),
    orderBy: desc(projectDescriptions.version),
  });

  const approvedDocs = await db.query.documents.findMany({
    where: and(
      eq(documents.projectId, projectId),
      eq(documents.isApprovedResource, true),
    ),
  });

  const latestCost = await db.query.costSnapshots.findFirst({
    where: eq(costSnapshots.projectId, projectId),
    orderBy: desc(costSnapshots.createdAt),
  });

  const pkgs = await db.query.tenderPackages.findMany({
    where: eq(tenderPackages.projectId, projectId),
  });

  // Math gate is computed at read-time (cheap when LVs are small) so the
  // /tender-release GET surfaces the live state to the UI.
  let mathPassed = false;
  try {
    const report = await verifyProjectLvMath(projectId);
    // Treat "no LVs at all" as not yet met — surfaces that the BoQ is missing.
    mathPassed = report.passed && report.positionCount > 0;
  } catch {
    mathPassed = false;
  }

  return TENDER_RELEASE_PREREQUISITES.map(p => ({
    key: p.key,
    label: p.label,
    category: p.category,
    met: computePrerequisiteMet(p.key, latestSpd, approvedDocs, latestCost, pkgs, mathPassed),
  }));
}

function computePrerequisiteMet(
  key: string,
  spd: { status: string | null } | undefined,
  approvedDocs: unknown[],
  costSnapshot: { status: string | null } | undefined | null,
  pkgs: { tenderReady: boolean }[],
  mathPassed: boolean
): boolean {
  switch (key) {
    case "spd_approved": return spd?.status === "approved";
    case "approved_resources_complete": return approvedDocs.length > 0;
    case "cost_estimate_approved": return costSnapshot?.status === "approved";
    case "packages_defined": return pkgs.length > 0;
    case "packages_ready": return pkgs.length > 0 && pkgs.every(p => p.tenderReady);
    case "mandatory_approvals": return spd?.status === "approved" && costSnapshot?.status === "approved";
    case "gate_d_complete": return false; // requires gate query — checked via gate status
    case "gaeb_math_verified": return mathPassed;
    default: return false;
  }
}
