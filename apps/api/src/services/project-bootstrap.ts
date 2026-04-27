import { db, gates, phases, projectDescriptions } from "@tenderfish/db";
import { eq, desc } from "drizzle-orm";
import { GATE_DEFINITIONS, LPH_PHASES } from "@tenderfish/shared";
import type { GateLetter, LphNumber } from "@tenderfish/shared";

interface BootstrapSeed {
  name?: string;
  type?: string;
  location?: string | null;
  objective?: string | null;
  scopeSummary?: string | null;
  currentLph?: number | null;
}

export interface SpdSyncSeed {
  name?: string | null;
  type?: string | null;
  location?: string | null;
  objective?: string | null;
  scopeSummary?: string | null;
  currentLph?: number | null;
}

function humanizeProjectType(type?: string): string {
  if (!type) return "Not sure";
  return type
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export async function ensureProjectBootstrap(
  projectId: string,
  userId: string | null | undefined,
  seed?: BootstrapSeed
) {
  const [existingGates, existingPhases, existingSpd] = await Promise.all([
    db.query.gates.findMany({ where: eq(gates.projectId, projectId) }),
    db.query.phases.findMany({ where: eq(phases.projectId, projectId) }),
    db.query.projectDescriptions.findFirst({
      where: eq(projectDescriptions.projectId, projectId),
    }),
  ]);

  if (existingGates.length === 0) {
    const gateLetters: GateLetter[] = ["A", "B", "C", "D", "E", "F"];
    await db.insert(gates).values(
      gateLetters.map((letter) => ({
        projectId,
        gate: letter,
        status: letter === "A" ? ("in_progress" as const) : ("locked" as const),
        criteria: GATE_DEFINITIONS[letter].defaultCriteria.map((criteria) => ({
          ...criteria,
          met: false,
        })),
      }))
    );
  }

  if (existingPhases.length === 0) {
    const lphNumbers: LphNumber[] = [1, 2, 3, 4, 5, 6, 7, 8, 9];
    const activeLph = seed?.currentLph && seed.currentLph >= 1 && seed.currentLph <= 9 ? seed.currentLph : 1;

    await db.insert(phases).values(
      lphNumbers.map((lph) => ({
        projectId,
        lph,
        status: lph === activeLph ? ("active" as const) : ("not_started" as const),
        objective: LPH_PHASES[lph].objective,
      }))
    );
  }

  if (!existingSpd) {
    const projectName = seed?.name?.trim() || "Untitled Project";
    const projectGoal =
      seed?.objective?.trim() ||
      "Project goal to be validated from uploaded planning materials.";
    const scopeOfWork =
      seed?.scopeSummary?.trim() ||
      "Scope of work to be inferred and reviewed from intake documents.";
    const currentPhase = `LPH ${seed?.currentLph && seed.currentLph >= 1 && seed.currentLph <= 9 ? seed.currentLph : 1}`;

    await db.insert(projectDescriptions).values({
      projectId,
      version: 1,
      status: "draft",
      projectName,
      projectGoal,
      projectType: humanizeProjectType(seed?.type),
      location: seed?.location?.trim() || "Not specified",
      participants: [],
      scopeOfWork,
      spatialScope: "To be confirmed during project review.",
      relevantApprovedDocuments: [],
      assumptions: ["Auto-generated SPD draft at project creation."],
      openPoints: [
        {
          point: "Validate inferred facts and confirm compliance scope.",
          priority: "medium",
        },
      ],
      currentProjectPhase: currentPhase,
      approvedProjectResources: [],
      currentDefinedProjectStatus: "Draft created automatically from project setup.",
      createdBy: userId || undefined,
    });
  }
}

export async function syncLatestDraftSpd(projectId: string, seed: SpdSyncSeed) {
  const latestSpd = await db.query.projectDescriptions.findFirst({
    where: eq(projectDescriptions.projectId, projectId),
    orderBy: desc(projectDescriptions.version),
  });

  if (!latestSpd || latestSpd.status === "approved") return;

  const lph = seed.currentLph && seed.currentLph >= 1 && seed.currentLph <= 9 ? seed.currentLph : 1;

  await db
    .update(projectDescriptions)
    .set({
      projectName:
        typeof seed.name === "string" && seed.name.trim().length > 0
          ? seed.name.trim()
          : latestSpd.projectName,
      projectType:
        typeof seed.type === "string" && seed.type.trim().length > 0
          ? humanizeProjectType(seed.type)
          : latestSpd.projectType,
      location:
        typeof seed.location === "string" && seed.location.trim().length > 0
          ? seed.location.trim()
          : latestSpd.location,
      projectGoal:
        typeof seed.objective === "string" && seed.objective.trim().length > 0
          ? seed.objective.trim()
          : latestSpd.projectGoal,
      scopeOfWork:
        typeof seed.scopeSummary === "string" && seed.scopeSummary.trim().length > 0
          ? seed.scopeSummary.trim()
          : latestSpd.scopeOfWork,
      currentProjectPhase: `LPH ${lph}`,
      currentDefinedProjectStatus: "Synced from latest project metadata and inferred intake facts.",
    })
    .where(eq(projectDescriptions.id, latestSpd.id));
}
