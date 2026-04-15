import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { db, projects, reviewSubmissions, users } from "@tenderfish/db";
import { eq, and, asc, desc } from "drizzle-orm";
import { logAudit } from "../utils/audit";

async function verifyProject(projectId: string, workspaceId: string) {
  return db.query.projects.findFirst({
    where: and(eq(projects.id, projectId), eq(projects.workspaceId, workspaceId)),
  });
}

export async function reviewRoutes(app: FastifyInstance) {
  // ─── REVIEWS (shop drawings) ───────────────────────────────

  // GET /api/projects/:id/reviews
  app.get("/projects/:id/reviews", async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.auth) return reply.status(401).send({ error: "Unauthorized" });
    const { id } = request.params as { id: string };
    const { type, status } = request.query as { type?: string; status?: string };

    const project = await verifyProject(id, request.auth.workspaceId);
    if (!project) return reply.status(404).send({ error: "Project not found" });

    let list = await db.query.reviewSubmissions.findMany({
      where: eq(reviewSubmissions.projectId, id),
    });

    if (type) list = list.filter((r) => r.type === type);
    if (status) list = list.filter((r) => r.status === status);

    // Enrich with reviewer name
    const enriched = await Promise.all(
      list.map(async (r) => {
        const reviewer = r.reviewerId
          ? await db.query.users.findFirst({ where: eq(users.id, r.reviewerId) })
          : null;
        const deviations = (r.deviations || []) as { itemNo: number; status: string }[];
        return {
          ...r,
          reviewerName: reviewer?.name || null,
          deviationCount: deviations.length,
          isOverdue: r.reviewDueDate && new Date(r.reviewDueDate) < new Date() && r.status !== "closed",
        };
      })
    );

    return { data: enriched };
  });

  // POST /api/projects/:id/reviews
  app.post("/projects/:id/reviews", async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.auth) return reply.status(401).send({ error: "Unauthorized" });
    const { id } = request.params as { id: string };
    const body = request.body as {
      title: string;
      type: string;
      packageName?: string;
      contractor?: string;
      submittedBy: string;
      submissionDate: string;
      reviewDueDate?: string;
    };

    const project = await verifyProject(id, request.auth.workspaceId);
    if (!project) return reply.status(404).send({ error: "Project not found" });

    if (!body.title?.trim() || !body.submittedBy || !body.submissionDate) {
      return reply.status(400).send({ error: "title, submittedBy, and submissionDate are required" });
    }

    const [created] = await db
      .insert(reviewSubmissions)
      .values({
        projectId: id,
        title: body.title.trim(),
        type: (body.type as "shop_drawing" | "execution_evidence") || "shop_drawing",
        packageName: body.packageName || null,
        contractor: body.contractor || null,
        submittedBy: body.submittedBy,
        submissionDate: body.submissionDate,
        reviewDueDate: body.reviewDueDate || null,
      })
      .returning();

    return reply.status(201).send({ data: created });
  });

  // PATCH /api/projects/:id/reviews/:reviewId
  app.patch("/projects/:id/reviews/:reviewId", async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.auth) return reply.status(401).send({ error: "Unauthorized" });
    const { id, reviewId } = request.params as { id: string; reviewId: string };
    const body = request.body as {
      status?: string;
      reviewerId?: string;
      reviewOutcome?: string;
      reviewComment?: string;
      deviations?: {
        itemNo: number;
        description: string;
        severity: string;
        designImpact: string;
        technicalImpact: string;
        scheduleImpact: string;
        status: string;
        resolutionNotes?: string;
      }[];
    };

    const project = await verifyProject(id, request.auth.workspaceId);
    if (!project) return reply.status(404).send({ error: "Project not found" });

    const existing = await db.query.reviewSubmissions.findFirst({
      where: and(eq(reviewSubmissions.id, reviewId), eq(reviewSubmissions.projectId, id)),
    });
    if (!existing) return reply.status(404).send({ error: "Review submission not found" });

    const updates: Record<string, unknown> = {};
    if (body.status !== undefined) updates.status = body.status;
    if (body.reviewerId !== undefined) updates.reviewerId = body.reviewerId;
    if (body.deviations !== undefined) updates.deviations = body.deviations;

    if (body.reviewOutcome !== undefined) {
      updates.reviewOutcome = body.reviewOutcome;
      updates.reviewDate = new Date();
      updates.reviewComment = body.reviewComment || null;

      // Auto-update status based on outcome
      if (body.reviewOutcome === "approved" || body.reviewOutcome === "approved_with_comments") {
        updates.status = "closed";
      } else if (body.reviewOutcome === "resubmission_required") {
        updates.status = "received"; // back to start
      }
    }

    const [updated] = await db
      .update(reviewSubmissions)
      .set(updates)
      .where(eq(reviewSubmissions.id, reviewId))
      .returning();

    if (body.reviewOutcome !== undefined) {
      await logAudit({
        workspaceId: request.auth.workspaceId,
        projectId: id,
        userId: request.auth.userId,
        action: "review.outcome",
        entityType: "review_submission",
        entityId: reviewId,
        beforeState: { status: existing.status, outcome: existing.reviewOutcome },
        afterState: { status: updated.status, outcome: body.reviewOutcome },
      });
    }

    return { data: updated };
  });

  // ─── EXECUTION ──────────────────────────────────────────────

  // GET /api/projects/:id/execution
  app.get("/projects/:id/execution", async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.auth) return reply.status(401).send({ error: "Unauthorized" });
    const { id } = request.params as { id: string };
    const { view } = request.query as { view?: string };

    const project = await verifyProject(id, request.auth.workspaceId);
    if (!project) return reply.status(404).send({ error: "Project not found" });

    let list = await db.query.reviewSubmissions.findMany({
      where: and(
        eq(reviewSubmissions.projectId, id),
        eq(reviewSubmissions.type, "execution_evidence"),
      ),
    });

    // Filter by view
    if (view === "accepted") list = list.filter((s) => s.reviewOutcome === "approved" || s.reviewOutcome === "approved_with_comments");
    if (view === "queue") list = list.filter((s) => s.status !== "closed");

    const enriched = await Promise.all(
      list.map(async (r) => {
        const reviewer = r.reviewerId
          ? await db.query.users.findFirst({ where: eq(users.id, r.reviewerId) })
          : null;
        return { ...r, reviewerName: reviewer?.name || null };
      })
    );

    return { data: enriched };
  });

  // POST /api/projects/:id/execution
  app.post("/projects/:id/execution", async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.auth) return reply.status(401).send({ error: "Unauthorized" });
    const { id } = request.params as { id: string };
    const body = request.body as {
      title: string;
      packageName?: string;
      contractor?: string;
      submittedBy: string;
      submissionDate: string;
      reviewDueDate?: string;
    };

    const project = await verifyProject(id, request.auth.workspaceId);
    if (!project) return reply.status(404).send({ error: "Project not found" });

    if (!body.title?.trim() || !body.submittedBy || !body.submissionDate) {
      return reply.status(400).send({ error: "title, submittedBy, and submissionDate are required" });
    }

    const [created] = await db
      .insert(reviewSubmissions)
      .values({
        projectId: id,
        title: body.title.trim(),
        type: "execution_evidence",
        packageName: body.packageName || null,
        contractor: body.contractor || null,
        submittedBy: body.submittedBy,
        submissionDate: body.submissionDate,
        reviewDueDate: body.reviewDueDate || null,
      })
      .returning();

    return reply.status(201).send({ data: created });
  });

  // PATCH /api/projects/:id/execution/:submissionId
  app.patch("/projects/:id/execution/:submissionId", async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.auth) return reply.status(401).send({ error: "Unauthorized" });
    const { id, submissionId } = request.params as { id: string; submissionId: string };
    const body = request.body as {
      status?: string;
      reviewOutcome?: string;
      reviewComment?: string;
      reviewerId?: string;
    };

    const project = await verifyProject(id, request.auth.workspaceId);
    if (!project) return reply.status(404).send({ error: "Project not found" });

    const existing = await db.query.reviewSubmissions.findFirst({
      where: and(eq(reviewSubmissions.id, submissionId), eq(reviewSubmissions.projectId, id)),
    });
    if (!existing) return reply.status(404).send({ error: "Submission not found" });

    const updates: Record<string, unknown> = {};
    if (body.status !== undefined) updates.status = body.status;
    if (body.reviewerId !== undefined) updates.reviewerId = body.reviewerId;
    if (body.reviewOutcome !== undefined) {
      updates.reviewOutcome = body.reviewOutcome;
      updates.reviewDate = new Date();
      updates.reviewComment = body.reviewComment || null;
      if (body.reviewOutcome === "approved" || body.reviewOutcome === "approved_with_comments") {
        updates.status = "closed";
      }
    }

    const [updated] = await db
      .update(reviewSubmissions)
      .set(updates)
      .where(eq(reviewSubmissions.id, submissionId))
      .returning();

    if (body.reviewOutcome !== undefined) {
      await logAudit({
        workspaceId: request.auth.workspaceId,
        projectId: id,
        userId: request.auth.userId,
        action: "execution.review_outcome",
        entityType: "review_submission",
        entityId: submissionId,
        beforeState: { status: existing.status, outcome: existing.reviewOutcome },
        afterState: { status: updated.status, outcome: body.reviewOutcome },
      });
    }

    return { data: updated };
  });
}
