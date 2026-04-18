import { FastifyInstance } from "fastify";
import { db, projects, documents, costSnapshots, costLineItems, projectDescriptions, participants } from "@tenderfish/db";
import { eq, desc } from "drizzle-orm";

export default async function exportRoutes(app: FastifyInstance) {
  // ── CSV: Cost snapshot line items ──
  app.get<{ Params: { id: string; snapshotId: string } }>(
    "/projects/:id/costs/:snapshotId/export/csv",
    async (request, reply) => {
      const items = await db.query.costLineItems.findMany({
        where: eq(costLineItems.snapshotId, request.params.snapshotId),
      });

      const header = "KG Code,Level,Description,Unit,Quantity,Unit Price,Amount Net,Amount Gross,Source,Data State\n";
      const rows = items.map((i) =>
        [i.costGroupCode, i.costGroupLevel, `"${(i.description || "").replace(/"/g, '""')}"`, i.unit || "", i.quantity ?? "", i.unitPrice ?? "", i.amountNet ?? 0, i.amountGross ?? 0, i.source || "", i.dataState || ""].join(",")
      );

      reply.header("Content-Type", "text/csv");
      reply.header("Content-Disposition", `attachment; filename="cost-snapshot-${request.params.snapshotId}.csv"`);
      return header + rows.join("\n");
    }
  );

  // ── CSV: Documents list ──
  app.get<{ Params: { id: string } }>(
    "/projects/:id/documents/export/csv",
    async (request, reply) => {
      const docs = await db.query.documents.findMany({
        where: eq(documents.projectId, request.params.id),
      });

      const header = "Name,Type,Status,Source Channel,Confidence,Uploaded At,Approved Resource\n";
      const rows = docs.map((d) =>
        [`"${(d.name || "").replace(/"/g, '""')}"`, d.type || "", d.status || "", d.sourceChannel || "", d.confidence ?? "", d.createdAt || "", d.isApprovedResource ? "Yes" : "No"].join(",")
      );

      reply.header("Content-Type", "text/csv");
      reply.header("Content-Disposition", `attachment; filename="documents-${request.params.id}.csv"`);
      return header + rows.join("\n");
    }
  );

  // ── CSV: Participants list ──
  app.get<{ Params: { id: string } }>(
    "/projects/:id/participants/export/csv",
    async (request, reply) => {
      const parts = await db.query.participants.findMany({
        where: eq(participants.projectId, request.params.id),
      });

      const header = "Name,Email,Company,Role,Access Level,Confirmed\n";
      const rows = parts.map((p) =>
        [`"${(p.name || "").replace(/"/g, '""')}"`, p.email || "", `"${(p.company || "").replace(/"/g, '""')}"`, p.role || "", p.accessLevel || "", p.roleConfirmed ? "Yes" : "No"].join(",")
      );

      reply.header("Content-Type", "text/csv");
      reply.header("Content-Disposition", `attachment; filename="participants-${request.params.id}.csv"`);
      return header + rows.join("\n");
    }
  );

  // ── JSON: Full project export ──
  app.get<{ Params: { id: string } }>(
    "/projects/:id/export/json",
    async (request, reply) => {
      const project = await db.query.projects.findFirst({
        where: eq(projects.id, request.params.id),
      });
      if (!project) return reply.code(404).send({ error: "Project not found" });

      const [docs, spd, costs, parts] = await Promise.all([
        db.query.documents.findMany({ where: eq(documents.projectId, request.params.id) }),
        db.query.projectDescriptions.findFirst({
          where: eq(projectDescriptions.projectId, request.params.id),
          orderBy: desc(projectDescriptions.createdAt),
        }),
        db.query.costSnapshots.findMany({ where: eq(costSnapshots.projectId, request.params.id) }),
        db.query.participants.findMany({ where: eq(participants.projectId, request.params.id) }),
      ]);

      const exportData = {
        exportedAt: new Date().toISOString(),
        project,
        projectDescription: spd || null,
        documents: docs,
        costSnapshots: costs,
        participants: parts,
      };

      reply.header("Content-Type", "application/json");
      reply.header("Content-Disposition", `attachment; filename="project-${project.name || request.params.id}.json"`);
      return exportData;
    }
  );
}
