import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import {
  db,
  projects,
  gates,
  phases,
  approvals,
  tasks,
  projectFacts,
  consultants,
  tenderPackages,
} from "@tenderfish/db";
import { eq, and, lte, gte, sql, inArray } from "drizzle-orm";

export async function dashboardRoutes(app: FastifyInstance) {
  // GET /api/dashboard — aggregated dashboard data
  app.get("/dashboard", async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.auth) {
      return reply.status(401).send({ error: "Unauthorized" });
    }

    const wsId = request.auth.workspaceId;
    const now = new Date();
    const thirtyDaysLater = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const todayStr = now.toISOString().slice(0, 10);
    const thirtyStr = thirtyDaysLater.toISOString().slice(0, 10);

    // 1. Active projects with phases & gates
    const projectList = await db.query.projects.findMany({
      where: eq(projects.workspaceId, wsId),
      orderBy: (p, { desc }) => [desc(p.createdAt)],
    });

    const projectIds = projectList.map((p) => p.id);

    if (projectIds.length === 0) {
      return {
        data: {
          projects: [],
          actionItems: [],
          milestones: [],
          blockedProjects: [],
        },
      };
    }

    // Fetch gates & phases for all projects in one go
    const allGates = await db.query.gates.findMany({
      where: inArray(gates.projectId, projectIds),
    });
    const allPhases = await db.query.phases.findMany({
      where: inArray(phases.projectId, projectIds),
    });

    // Build enriched project cards
    const projectCards = projectList.map((p) => {
      const pGates = allGates.filter((g) => g.projectId === p.id);
      const pPhases = allPhases.filter((ph) => ph.projectId === p.id);

      // Current LPH = highest active phase
      const activePhases = pPhases
        .filter((ph) => ph.status === "active")
        .sort((a, b) => b.lph - a.lph);
      const currentLph = activePhases.length > 0 ? activePhases[0].lph : 1;

      // Current gate = first non-complete gate
      const sortedGates = pGates.sort(
        (a, b) => a.gate.charCodeAt(0) - b.gate.charCodeAt(0)
      );
      const currentGate = sortedGates.find(
        (g) => g.status !== "complete"
      );

      return {
        id: p.id,
        name: p.name,
        type: p.type,
        status: p.status,
        healthScore: p.healthScore,
        procurementModel: p.procurementModel,
        targetCompletion: p.targetCompletion,
        currentLph,
        currentGate: currentGate
          ? { gate: currentGate.gate, status: currentGate.status }
          : { gate: "F", status: "complete" },
      };
    });

    // 2. Action required items
    const actionItems: {
      projectId: string;
      projectName: string;
      item: string;
      type: string;
      due: string | null;
      link: string;
    }[] = [];

    // Overdue approvals
    const overdueApprovals = await db.query.approvals.findMany({
      where: and(
        inArray(approvals.projectId, projectIds),
        eq(approvals.status, "pending"),
        lte(approvals.dueDate, todayStr)
      ),
    });
    for (const a of overdueApprovals) {
      const proj = projectList.find((p) => p.id === a.projectId);
      actionItems.push({
        projectId: a.projectId,
        projectName: proj?.name || "",
        item: a.name,
        type: "Overdue Approval",
        due: a.dueDate,
        link: `/projects/${a.projectId}/approvals`,
      });
    }

    // Blocked gates (in_progress with unmet criteria)
    for (const g of allGates) {
      if (g.status !== "in_progress") continue;
      const criteria = g.criteria as { key: string; label: string; met: boolean }[];
      const unmet = criteria.filter((c) => !c.met);
      if (unmet.length > 0) {
        const proj = projectList.find((p) => p.id === g.projectId);
        actionItems.push({
          projectId: g.projectId,
          projectName: proj?.name || "",
          item: `Gate ${g.gate}: ${unmet[0].label}`,
          type: "Blocked Gate",
          due: null,
          link: `/projects/${g.projectId}/gates`,
        });
      }
    }

    // Missing facts (MISSING data state)
    const missingFacts = await db.query.projectFacts.findMany({
      where: and(
        inArray(projectFacts.projectId, projectIds),
        eq(projectFacts.dataState, "MISSING")
      ),
    });
    // Group by project, max 1 per project
    const missingByProject = new Map<string, typeof missingFacts>();
    for (const f of missingFacts) {
      if (!missingByProject.has(f.projectId)) {
        missingByProject.set(f.projectId, []);
      }
      missingByProject.get(f.projectId)!.push(f);
    }
    for (const [pid, facts] of missingByProject) {
      const proj = projectList.find((p) => p.id === pid);
      actionItems.push({
        projectId: pid,
        projectName: proj?.name || "",
        item: `${facts.length} missing fact${facts.length > 1 ? "s" : ""} (${facts[0].fieldName.replace(/_/g, " ")})`,
        type: "Missing Info",
        due: null,
        link: `/projects/${pid}/overview`,
      });
    }

    // Sort by urgency (items with due dates first, overdue first)
    actionItems.sort((a, b) => {
      if (a.due && !b.due) return -1;
      if (!a.due && b.due) return 1;
      if (a.due && b.due) return a.due.localeCompare(b.due);
      return 0;
    });

    // 3. Upcoming milestones (tasks with due dates in next 30 days)
    const upcomingTasks = await db.query.tasks.findMany({
      where: and(
        inArray(tasks.projectId, projectIds),
        gte(tasks.dueDate, todayStr),
        lte(tasks.dueDate, thirtyStr)
      ),
      orderBy: (t, { asc }) => [asc(t.dueDate)],
      limit: 10,
    });

    const milestones = upcomingTasks.map((t) => {
      const proj = projectList.find((p) => p.id === t.projectId);
      const phase = allPhases.find((ph) => ph.id === t.phaseId);
      return {
        date: t.dueDate,
        projectId: t.projectId,
        projectName: proj?.name || "",
        milestone: t.name,
        phase: phase ? `LPH ${phase.lph}` : "",
        status: t.status,
      };
    });

    // 4. Blocked projects (projects with in_progress gates that have unmet criteria)
    const blockedProjects = projectCards
      .map((pc) => {
        const pGates = allGates.filter(
          (g) => g.projectId === pc.id && g.status === "in_progress"
        );
        for (const g of pGates) {
          const criteria = g.criteria as {
            key: string;
            label: string;
            met: boolean;
          }[];
          const unmet = criteria.filter((c) => !c.met);
          if (unmet.length > 0) {
            return {
              id: pc.id,
              name: pc.name,
              gate: g.gate,
              gateStatus: g.status,
              topBlocker: unmet[0].label,
              unmetCount: unmet.length,
            };
          }
        }
        return null;
      })
      .filter(Boolean);

    return {
      data: {
        projects: projectCards,
        actionItems: actionItems.slice(0, 10),
        milestones,
        blockedProjects,
      },
    };
  });

  // GET /api/projects/:id/overview — enriched project overview data
  app.get(
    "/projects/:id/overview",
    async (
      request: FastifyRequest<{ Params: { id: string } }>,
      reply: FastifyReply
    ) => {
      if (!request.auth) {
        return reply.status(401).send({ error: "Unauthorized" });
      }

      const { id } = request.params;

      const project = await db.query.projects.findFirst({
        where: and(
          eq(projects.id, id),
          eq(projects.workspaceId, request.auth.workspaceId)
        ),
      });

      if (!project) {
        return reply.status(404).send({ error: "Project not found" });
      }

      // Parallel fetch all related data
      const [
        projectGates,
        projectPhases,
        projectFacts_,
        projectConsultants,
        projectPackages,
        projectApprovals,
      ] = await Promise.all([
        db.query.gates.findMany({
          where: eq(gates.projectId, id),
          orderBy: (g, { asc }) => [asc(g.gate)],
        }),
        db.query.phases.findMany({
          where: eq(phases.projectId, id),
          orderBy: (p, { asc }) => [asc(p.lph)],
        }),
        db.query.projectFacts.findMany({
          where: eq(projectFacts.projectId, id),
          orderBy: (pf, { asc }) => [asc(pf.fieldName)],
        }),
        db.query.consultants.findMany({
          where: eq(consultants.projectId, id),
        }),
        db.query.tenderPackages.findMany({
          where: eq(tenderPackages.projectId, id),
        }),
        db.query.approvals.findMany({
          where: eq(approvals.projectId, id),
        }),
      ]);

      // Current LPH
      const activePhases = projectPhases
        .filter((ph) => ph.status === "active")
        .sort((a, b) => b.lph - a.lph);
      const currentLph = activePhases.length > 0 ? activePhases[0].lph : 1;

      // Readiness scores
      const planningReadiness = computePhaseReadiness(projectPhases);
      const consultantReadiness = computeConsultantReadiness(projectConsultants);
      const tenderReadiness = computeTenderReadiness(projectPackages);
      const executionReadiness = 0; // Requires execution data from Phase 8
      const closeoutReadiness = 0; // Requires closeout data

      // Action items for this project
      const overdueApprovals = projectApprovals.filter(
        (a) =>
          a.status === "pending" &&
          a.dueDate &&
          a.dueDate <= new Date().toISOString().slice(0, 10)
      );

      const unclearFacts = projectFacts_.filter(
        (f) => f.dataState === "UNCLEAR"
      );
      const missingFacts_ = projectFacts_.filter(
        (f) => f.dataState === "MISSING"
      );

      const actionItems: {
        category: string;
        description: string;
        due: string | null;
        link: string;
      }[] = [];

      for (const a of overdueApprovals) {
        actionItems.push({
          category: "Overdue Approval",
          description: a.name,
          due: a.dueDate,
          link: `/projects/${id}/approvals`,
        });
      }

      if (missingFacts_.length > 0) {
        actionItems.push({
          category: "Missing Info",
          description: `${missingFacts_.length} missing fact${missingFacts_.length > 1 ? "s" : ""}`,
          due: null,
          link: `/projects/${id}/overview`,
        });
      }

      if (unclearFacts.length > 0) {
        actionItems.push({
          category: "Review Required",
          description: `${unclearFacts.length} unclear fact${unclearFacts.length > 1 ? "s" : ""}`,
          due: null,
          link: `/projects/${id}/overview`,
        });
      }

      return {
        data: {
          project,
          currentLph,
          gates: projectGates,
          phases: projectPhases,
          facts: projectFacts_,
          readiness: {
            planning: planningReadiness,
            consultant: consultantReadiness,
            tender: tenderReadiness,
            execution: executionReadiness,
            closeout: closeoutReadiness,
          },
          actionItems,
        },
      };
    }
  );

  // POST /api/projects/:id/health — recompute health score
  app.post(
    "/projects/:id/health",
    async (
      request: FastifyRequest<{ Params: { id: string } }>,
      reply: FastifyReply
    ) => {
      if (!request.auth) {
        return reply.status(401).send({ error: "Unauthorized" });
      }

      const { id } = request.params;
      const project = await db.query.projects.findFirst({
        where: and(
          eq(projects.id, id),
          eq(projects.workspaceId, request.auth.workspaceId)
        ),
      });

      if (!project) {
        return reply.status(404).send({ error: "Project not found" });
      }

      const score = await computeHealthScore(id);

      const [updated] = await db
        .update(projects)
        .set({ healthScore: score })
        .where(eq(projects.id, id))
        .returning();

      return { data: { healthScore: updated.healthScore } };
    }
  );
}

// ─── Health Score Engine ──────────────────────────────────────

export async function computeHealthScore(
  projectId: string
): Promise<"green" | "amber" | "red"> {
  const todayStr = new Date().toISOString().slice(0, 10);

  const [projectGates, projectApprovals, projectFacts_] = await Promise.all([
    db.query.gates.findMany({ where: eq(gates.projectId, projectId) }),
    db.query.approvals.findMany({ where: eq(approvals.projectId, projectId) }),
    db.query.projectFacts.findMany({
      where: eq(projectFacts.projectId, projectId),
    }),
  ]);

  // RED: Gate blocked with in_progress + unmet criteria, OR critical overdue approval
  const hasBlockedGate = projectGates.some((g) => {
    if (g.status !== "in_progress") return false;
    const criteria = g.criteria as {
      key: string;
      label: string;
      met: boolean;
    }[];
    return criteria.some((c) => !c.met);
  });

  const hasCriticalOverdue = projectApprovals.some(
    (a) => a.status === "pending" && a.dueDate && a.dueDate < todayStr
  );

  if (hasBlockedGate || hasCriticalOverdue) return "red";

  // AMBER: UNCLEAR facts or pending approvals approaching due date
  const hasUnclearFacts = projectFacts_.some(
    (f) => f.dataState === "UNCLEAR"
  );
  const hasMissingFacts = projectFacts_.some(
    (f) => f.dataState === "MISSING"
  );
  const hasPendingApprovals = projectApprovals.some(
    (a) => a.status === "pending"
  );

  if (hasUnclearFacts || hasMissingFacts || hasPendingApprovals) return "amber";

  return "green";
}

// ─── Readiness Computations ───────────────────────────────────

function computePhaseReadiness(
  phasesData: { status: string }[]
): number {
  if (phasesData.length === 0) return 0;
  const complete = phasesData.filter((p) => p.status === "complete").length;
  return Math.round((complete / phasesData.length) * 100);
}

function computeConsultantReadiness(
  consultantsData: {
    readinessCriteria: { key: string; label: string; met: boolean }[];
  }[]
): number {
  if (consultantsData.length === 0) return 0;
  let total = 0;
  let met = 0;
  for (const c of consultantsData) {
    const criteria = c.readinessCriteria || [];
    total += criteria.length;
    met += criteria.filter((cr) => cr.met).length;
  }
  return total === 0 ? 0 : Math.round((met / total) * 100);
}

function computeTenderReadiness(
  packages: { readinessScore: number }[]
): number {
  if (packages.length === 0) return 0;
  const avg =
    packages.reduce((sum, p) => sum + p.readinessScore, 0) / packages.length;
  return Math.round(avg);
}
