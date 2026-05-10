import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import {
  db,
  leistungsverzeichnisse,
  lvPositionen,
  gaebExchangeLog,
  projects,
} from "@tenderfish/db";
import { and, asc, desc, eq } from "drizzle-orm";
import { isObjectStorageConfigured, uploadRawFile } from "../lib/storage";
import {
  importGaebX83,
  importGaebX84,
} from "../services/gaeb-importer";
import {
  exportGaebX81,
  exportGaebX86,
  GaebMathBlockError,
  GaebNotFoundError,
} from "../services/gaeb-exporter";
import { verifyLvMath } from "../services/gaeb-math-verifier";
import { classifyLvPositions } from "../services/din276-classifier";
import { logAudit } from "../utils/audit";

// ─── Helpers ───────────────────────────────────────────────────

const ALLOWED_GAEB_EXT = [".x81", ".x82", ".x83", ".x84", ".x86", ".xml"];

async function readUploadedGaebFile(request: FastifyRequest): Promise<{
  fileName: string;
  buffer: Buffer;
  fields: Record<string, string>;
} | null> {
  const parts = request.parts();
  let fileName: string | null = null;
  const chunks: Buffer[] = [];
  const fields: Record<string, string> = {};

  for await (const part of parts) {
    if (part.type === "file") {
      fileName = part.filename ?? "upload.xml";
      for await (const chunk of part.file) chunks.push(chunk);
    } else {
      fields[part.fieldname] = String(part.value ?? "");
    }
  }

  if (!fileName) return null;
  return { fileName, buffer: Buffer.concat(chunks), fields };
}

async function ensureProjectInWorkspace(
  projectId: string,
  workspaceId: string
): Promise<{ id: string; workspaceId: string } | null> {
  const [row] = await db
    .select({ id: projects.id, workspaceId: projects.workspaceId })
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.workspaceId, workspaceId)))
    .limit(1);
  return row ?? null;
}

// ─── Route plugin ──────────────────────────────────────────────

export async function gaebRoutes(app: FastifyInstance) {
  // ─── List LVs ────────────────────────────────────────────────

  app.get(
    "/projects/:id/lv",
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      if (!request.auth) return reply.status(401).send({ error: "Unauthorized" });

      const project = await ensureProjectInWorkspace(request.params.id, request.auth.workspaceId);
      if (!project) return reply.status(404).send({ error: "Project not found" });

      const rows = await db
        .select()
        .from(leistungsverzeichnisse)
        .where(eq(leistungsverzeichnisse.projectId, request.params.id))
        .orderBy(desc(leistungsverzeichnisse.createdAt));

      return { data: rows };
    }
  );

  // ─── Get LV detail (with positions) ──────────────────────────

  app.get(
    "/projects/:id/lv/:lvId",
    async (
      request: FastifyRequest<{ Params: { id: string; lvId: string } }>,
      reply: FastifyReply
    ) => {
      if (!request.auth) return reply.status(401).send({ error: "Unauthorized" });
      const project = await ensureProjectInWorkspace(request.params.id, request.auth.workspaceId);
      if (!project) return reply.status(404).send({ error: "Project not found" });

      const [lv] = await db
        .select()
        .from(leistungsverzeichnisse)
        .where(
          and(
            eq(leistungsverzeichnisse.id, request.params.lvId),
            eq(leistungsverzeichnisse.projectId, request.params.id)
          )
        )
        .limit(1);
      if (!lv) return reply.status(404).send({ error: "LV not found" });

      const positions = await db
        .select()
        .from(lvPositionen)
        .where(eq(lvPositionen.lvId, lv.id))
        .orderBy(asc(lvPositionen.ordnungszahl));

      return { data: { lv, positions } };
    }
  );

  // ─── Import X83 ──────────────────────────────────────────────

  app.post(
    "/projects/:id/lv/import-gaeb",
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      if (!request.auth) return reply.status(401).send({ error: "Unauthorized" });
      if (!["architect_admin", "document_controller"].includes(request.auth.role)) {
        return reply.status(403).send({ error: "Forbidden" });
      }

      const project = await ensureProjectInWorkspace(request.params.id, request.auth.workspaceId);
      if (!project) return reply.status(404).send({ error: "Project not found" });

      const upload = await readUploadedGaebFile(request);
      if (!upload) return reply.status(400).send({ error: "No file uploaded" });
      const ext = upload.fileName.toLowerCase().match(/\.[a-z0-9]+$/)?.[0] ?? "";
      if (!ALLOWED_GAEB_EXT.includes(ext)) {
        return reply.status(400).send({ error: `Unsupported file type: ${ext}` });
      }

      const fileRef = isObjectStorageConfigured()
        ? await uploadRawFile(request.auth.workspaceId, upload.fileName, upload.buffer, "application/xml")
        : `(in-memory) ${upload.fileName}`;

      const result = await importGaebX83({
        projectId: request.params.id,
        packageId: upload.fields.packageId || null,
        userId: request.auth.userId,
        fileName: upload.fileName,
        fileBuffer: upload.buffer,
        fileRef,
        fileSize: upload.buffer.length,
      });

      // Best-effort post-import enrichment. Failures are logged into errorLog
      // by the verifier itself; classifier failures we just swallow.
      let classification = { updated: 0, ruleHits: 0, aiHits: 0, skipped: 0 };
      try {
        classification = await classifyLvPositions(result.lvId);
      } catch (err) {
        request.log.warn({ err }, "din276 classification failed during import");
      }

      let mathReport: Awaited<ReturnType<typeof verifyLvMath>> | null = null;
      try {
        mathReport = await verifyLvMath(result.lvId);
      } catch (err) {
        request.log.warn({ err }, "math verification failed during import");
      }

      await logAudit({
        workspaceId: request.auth.workspaceId,
        projectId: request.params.id,
        userId: request.auth.userId,
        action: "gaeb.import",
        entityType: "leistungsverzeichnisse",
        entityId: result.lvId,
        afterState: {
          phase: result.daPhase,
          positions: result.positionsImported,
          warnings: result.warnings.length,
          mathPassed: mathReport?.passed ?? null,
        },
      });

      return reply.status(201).send({
        data: {
          ...result,
          classification,
          mathReport,
        },
      });
    }
  );

  // ─── Import X84 (correction → new LV row, parent_lv_id = current) ────

  app.post(
    "/projects/:id/lv/:lvId/import-x84",
    async (
      request: FastifyRequest<{ Params: { id: string; lvId: string } }>,
      reply: FastifyReply
    ) => {
      if (!request.auth) return reply.status(401).send({ error: "Unauthorized" });
      if (request.auth.role !== "architect_admin") {
        return reply.status(403).send({ error: "Forbidden" });
      }

      const project = await ensureProjectInWorkspace(request.params.id, request.auth.workspaceId);
      if (!project) return reply.status(404).send({ error: "Project not found" });

      const upload = await readUploadedGaebFile(request);
      if (!upload) return reply.status(400).send({ error: "No file uploaded" });

      const fileRef = isObjectStorageConfigured()
        ? await uploadRawFile(request.auth.workspaceId, upload.fileName, upload.buffer, "application/xml")
        : `(in-memory) ${upload.fileName}`;

      const result = await importGaebX84({
        projectId: request.params.id,
        packageId: null,
        userId: request.auth.userId,
        fileName: upload.fileName,
        fileBuffer: upload.buffer,
        fileRef,
        fileSize: upload.buffer.length,
        parentLvId: request.params.lvId,
      });

      let classification = { updated: 0, ruleHits: 0, aiHits: 0, skipped: 0 };
      try {
        classification = await classifyLvPositions(result.lvId);
      } catch (err) {
        request.log.warn({ err }, "din276 classification failed during X84 import");
      }

      let mathReport: Awaited<ReturnType<typeof verifyLvMath>> | null = null;
      try {
        mathReport = await verifyLvMath(result.lvId);
      } catch (err) {
        request.log.warn({ err }, "math verification failed during X84 import");
      }

      return reply.status(201).send({ data: { ...result, classification, mathReport } });
    }
  );

  // ─── Verify math ─────────────────────────────────────────────

  app.post(
    "/projects/:id/lv/:lvId/verify-math",
    async (
      request: FastifyRequest<{ Params: { id: string; lvId: string } }>,
      reply: FastifyReply
    ) => {
      if (!request.auth) return reply.status(401).send({ error: "Unauthorized" });
      const project = await ensureProjectInWorkspace(request.params.id, request.auth.workspaceId);
      if (!project) return reply.status(404).send({ error: "Project not found" });

      try {
        const report = await verifyLvMath(request.params.lvId);
        return { data: report };
      } catch (err) {
        if (err instanceof Error && err.name === "GaebMathError_NotFound") {
          return reply.status(404).send({ error: err.message });
        }
        throw err;
      }
    }
  );

  // ─── Re-classify DIN 276 (manual trigger) ────────────────────

  app.post(
    "/projects/:id/lv/:lvId/classify-din276",
    async (
      request: FastifyRequest<{ Params: { id: string; lvId: string } }>,
      reply: FastifyReply
    ) => {
      if (!request.auth) return reply.status(401).send({ error: "Unauthorized" });
      if (request.auth.role !== "architect_admin") {
        return reply.status(403).send({ error: "Forbidden" });
      }
      const project = await ensureProjectInWorkspace(request.params.id, request.auth.workspaceId);
      if (!project) return reply.status(404).send({ error: "Project not found" });

      const summary = await classifyLvPositions(request.params.lvId);
      return { data: summary };
    }
  );

  // ─── Export X81 / X86 ────────────────────────────────────────

  app.post(
    "/projects/:id/lv/:lvId/export-gaeb",
    async (
      request: FastifyRequest<{
        Params: { id: string; lvId: string };
        Body: { phase: "x81" | "x86"; awardedBidderId?: string };
      }>,
      reply: FastifyReply
    ) => {
      if (!request.auth) return reply.status(401).send({ error: "Unauthorized" });
      if (request.auth.role !== "architect_admin") {
        return reply.status(403).send({ error: "Forbidden" });
      }

      const project = await ensureProjectInWorkspace(request.params.id, request.auth.workspaceId);
      if (!project) return reply.status(404).send({ error: "Project not found" });

      const phase = request.body?.phase;
      if (phase !== "x81" && phase !== "x86") {
        return reply.status(400).send({ error: "phase must be 'x81' or 'x86'" });
      }

      try {
        const result =
          phase === "x81"
            ? await exportGaebX81(request.params.lvId)
            : await exportGaebX86({
                lvId: request.params.lvId,
                awardedBidderId: request.body.awardedBidderId ?? "",
              });

        await logAudit({
          workspaceId: request.auth.workspaceId,
          projectId: request.params.id,
          userId: request.auth.userId,
          action: `gaeb.export.${phase}`,
          entityType: "leistungsverzeichnisse",
          entityId: request.params.lvId,
          afterState: { fileName: result.fileName, fileSize: result.xml.length },
        });

        return reply
          .header("Content-Type", "application/xml; charset=utf-8")
          .header("Content-Disposition", `attachment; filename="${result.fileName}"`)
          .send(result.xml);
      } catch (err) {
        if (err instanceof GaebMathBlockError) {
          return reply.status(422).send({
            error: err.message,
            report: err.report,
          });
        }
        if (err instanceof GaebNotFoundError) {
          return reply.status(404).send({ error: err.message });
        }
        throw err;
      }
    }
  );

  // ─── Exchange log (audit history) ────────────────────────────

  app.get(
    "/projects/:id/gaeb/log",
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      if (!request.auth) return reply.status(401).send({ error: "Unauthorized" });
      const project = await ensureProjectInWorkspace(request.params.id, request.auth.workspaceId);
      if (!project) return reply.status(404).send({ error: "Project not found" });

      const rows = await db
        .select()
        .from(gaebExchangeLog)
        .where(eq(gaebExchangeLog.projectId, request.params.id))
        .orderBy(desc(gaebExchangeLog.createdAt));

      return { data: rows };
    }
  );
}
