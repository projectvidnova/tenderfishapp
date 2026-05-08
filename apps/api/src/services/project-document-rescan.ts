import { db, documents } from "@tenderfish/db";
import { eq } from "drizzle-orm";
import { downloadFileBuffer } from "../lib/storage";
import { processFile } from "./ai-pipeline";
import {
  deleteFactsAttributedToDocument,
  insertFactsFromProcessFileOutput,
} from "./process-file-facts";
import { refreshAndAutoCompleteGates } from "./gate-evaluator";

type VersionRow = {
  version: number;
  filePath: string;
};

/**
 * Re-runs the structured `processFile` AI pipeline for every project document that has a stored
 * S3 `filePath`, rewrites that document's derived `project_facts`, then refreshes gate
 * `criteria.met` from facts (no client-supplied criteria).
 */
export async function rescanAllStoredProjectDocuments(
  projectId: string
): Promise<{
  documentsProcessed: number;
  documentsSkipped: number;
  skippedReasons: string[];
}> {
  const docList = await db.query.documents.findMany({
    where: eq(documents.projectId, projectId),
  });

  const insertedFactKeys = new Set<string>();
  let documentsProcessed = 0;
  let documentsSkipped = 0;
  const skippedReasons: string[] = [];

  for (const doc of docList) {
    const versions = (doc.versions || []) as VersionRow[];
    if (versions.length === 0) {
      documentsSkipped += 1;
      skippedReasons.push(`${doc.name}: no file versions`);
      continue;
    }

    const latest = [...versions].reduce((best, v) =>
      v.version > best.version ? v : best
    );

    if (!latest.filePath?.trim()) {
      documentsSkipped += 1;
      skippedReasons.push(`${doc.name}: no stored file path`);
      continue;
    }

    const buffer = await downloadFileBuffer(latest.filePath.trim());
    if (!buffer || buffer.length === 0) {
      documentsSkipped += 1;
      skippedReasons.push(`${doc.name}: file not available in storage`);
      continue;
    }

    await deleteFactsAttributedToDocument(projectId, doc.id);

    const processed = await processFile({
      project_id: projectId,
      document_id: doc.id,
      file_name: doc.name,
      mime_type: doc.type,
      buffer,
    });

    await insertFactsFromProcessFileOutput(projectId, doc.id, processed, insertedFactKeys);
    documentsProcessed += 1;
  }

  await refreshAndAutoCompleteGates(projectId);

  return {
    documentsProcessed,
    documentsSkipped,
    skippedReasons,
  };
}
