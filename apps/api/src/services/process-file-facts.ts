/**
 * Persists structured facts from {@link processFile} into `project_facts` for gate evaluation.
 * Shared by intake jobs and document re-scan.
 */

import { db, projectFacts } from "@tenderfish/db";
import { and, eq, inArray, like } from "drizzle-orm";
import type { ProcessFileOutput } from "./ai-pipeline";

/** Field names cleared when replacing full intake batch (see jobs intake). */
export const INTAKE_BATCH_DELETE_FIELD_NAMES = [
  "project_summary",
  "cost_item",
  "schedule",
  "stakeholder",
  "standards_mapping",
  "overview_client_name",
  "location",
  "overview_commissioned_phases",
  "overview_building_permit_status",
] as const;

export function createTraceableFactValue(
  payload: Record<string, unknown>,
  documentId: string
): string {
  return JSON.stringify({
    ...payload,
    truth_state: "inferred",
    source_document_id: documentId,
  });
}

export async function deleteIntakeDerivedFactsBatch(projectId: string): Promise<void> {
  await db
    .delete(projectFacts)
    .where(
      and(
        eq(projectFacts.projectId, projectId),
        inArray(projectFacts.fieldName, [...INTAKE_BATCH_DELETE_FIELD_NAMES])
      )
    );
}

/** Removes facts previously attributed to one document (before re-processing that file). */
export async function deleteFactsAttributedToDocument(
  projectId: string,
  documentId: string
): Promise<void> {
  const pattern = `%document_id:${documentId}%`;
  await db
    .delete(projectFacts)
    .where(
      and(eq(projectFacts.projectId, projectId), like(projectFacts.sourceRef, pattern))
    );
}

export async function insertFactsFromProcessFileOutput(
  projectId: string,
  documentRecordId: string,
  processed: ProcessFileOutput,
  insertedFactKeys: Set<string>
): Promise<void> {
  const baseSourceRef = `document_id:${documentRecordId} | ${processed.source_reference}`;

  const summaryKey = `project_summary|${processed.structured.project_summary.trim().toLowerCase()}`;
  if (
    processed.structured.project_summary.trim().length > 0 &&
    !insertedFactKeys.has(summaryKey)
  ) {
    insertedFactKeys.add(summaryKey);
    await db.insert(projectFacts).values({
      projectId,
      fieldName: "project_summary",
      value: createTraceableFactValue(
        {
          summary: processed.structured.project_summary.trim(),
          source_reference: baseSourceRef,
        },
        documentRecordId
      ),
      dataState: "DERIVED",
      sourceRef: baseSourceRef,
    });
  }

  const overview = processed.structured.project_overview;

  if (overview.client_name) {
    const clientKey = `overview_client_name|${overview.client_name.toLowerCase()}`;
    if (!insertedFactKeys.has(clientKey)) {
      insertedFactKeys.add(clientKey);
      await db.insert(projectFacts).values({
        projectId,
        fieldName: "overview_client_name",
        value: createTraceableFactValue(
          {
            client_name: overview.client_name,
            source_reference: baseSourceRef,
          },
          documentRecordId
        ),
        dataState: "DERIVED",
        sourceRef: baseSourceRef,
      });
    }
  }

  if (overview.location?.trim()) {
    const place = overview.location.trim();
    const locKey = `location|${place.toLowerCase()}`;
    if (!insertedFactKeys.has(locKey)) {
      insertedFactKeys.add(locKey);
      await db.insert(projectFacts).values({
        projectId,
        fieldName: "location",
        value: createTraceableFactValue(
          { location: place, source_reference: baseSourceRef },
          documentRecordId
        ),
        dataState: "DERIVED",
        sourceRef: baseSourceRef,
      });
    }
  }

  if (overview.commissioned_phases.length > 0) {
    const phaseToken = overview.commissioned_phases.join(",");
    const commissionedKey = `overview_commissioned_phases|${phaseToken}`;
    if (!insertedFactKeys.has(commissionedKey)) {
      insertedFactKeys.add(commissionedKey);
      await db.insert(projectFacts).values({
        projectId,
        fieldName: "overview_commissioned_phases",
        value: createTraceableFactValue(
          {
            commissioned_phases: overview.commissioned_phases,
            source_reference: baseSourceRef,
          },
          documentRecordId
        ),
        dataState: "DERIVED",
        sourceRef: baseSourceRef,
      });
    }
  }

  if (overview.building_permit_status) {
    const permitKey = `overview_building_permit_status|${overview.building_permit_status.toLowerCase()}`;
    if (!insertedFactKeys.has(permitKey)) {
      insertedFactKeys.add(permitKey);
      await db.insert(projectFacts).values({
        projectId,
        fieldName: "overview_building_permit_status",
        value: createTraceableFactValue(
          {
            building_permit_status: overview.building_permit_status,
            source_reference: baseSourceRef,
          },
          documentRecordId
        ),
        dataState: "DERIVED",
        sourceRef: baseSourceRef,
      });
    }
  }

  if (processed.structured.current_hoai_phase !== null) {
    const hoaiKey = `current_hoai_phase|${processed.structured.current_hoai_phase}`;
    if (!insertedFactKeys.has(hoaiKey)) {
      insertedFactKeys.add(hoaiKey);
      await db.insert(projectFacts).values({
        projectId,
        fieldName: "current_hoai_phase",
        value: createTraceableFactValue(
          {
            hoai_phase: processed.structured.current_hoai_phase,
            source_reference: baseSourceRef,
          },
          documentRecordId
        ),
        dataState: "DERIVED",
        sourceRef: baseSourceRef,
      });
    }
  }

  for (const costItem of processed.structured.cost_items) {
    const key = `cost_item|${costItem.description.toLowerCase()}|${costItem.din276_code}|${costItem.quantity ?? "null"}|${costItem.amount ?? "null"}|${costItem.unit ?? "null"}`;
    if (insertedFactKeys.has(key)) continue;
    insertedFactKeys.add(key);
    await db.insert(projectFacts).values({
      projectId,
      fieldName: "cost_item",
      value: createTraceableFactValue(
        {
          ...costItem,
          source_reference: costItem.source_reference || processed.source_reference,
        },
        documentRecordId
      ),
      dataState: "DERIVED",
      sourceRef: `document_id:${documentRecordId} | ${costItem.source_reference || processed.source_reference}`,
    });
  }

  for (const scheduleItem of processed.structured.schedule) {
    const key = `schedule|${scheduleItem.task.toLowerCase()}|${scheduleItem.hoai_phase}`;
    if (insertedFactKeys.has(key)) continue;
    insertedFactKeys.add(key);
    await db.insert(projectFacts).values({
      projectId,
      fieldName: "schedule",
      value: createTraceableFactValue(
        {
          ...scheduleItem,
          source_reference: scheduleItem.source_reference || processed.source_reference,
        },
        documentRecordId
      ),
      dataState: "DERIVED",
      sourceRef: `document_id:${documentRecordId} | ${scheduleItem.source_reference || processed.source_reference}`,
    });
  }

  for (const stakeholder of processed.structured.stakeholders) {
    const key = `stakeholder|${stakeholder.name.toLowerCase()}|${stakeholder.role.toLowerCase()}`;
    if (insertedFactKeys.has(key)) continue;
    insertedFactKeys.add(key);
    await db.insert(projectFacts).values({
      projectId,
      fieldName: "stakeholder",
      value: createTraceableFactValue(
        {
          ...stakeholder,
          source_reference: stakeholder.source_reference || processed.source_reference,
        },
        documentRecordId
      ),
      dataState: "DERIVED",
      sourceRef: `document_id:${documentRecordId} | ${stakeholder.source_reference || processed.source_reference}`,
    });
  }

  for (const mapping of processed.structured.standards_mapping) {
    const key = `standards_mapping|${mapping.finding.toLowerCase()}|${mapping.hoai_service_phase ?? "null"}|${mapping.din276_cost_group ?? "null"}`;
    if (insertedFactKeys.has(key)) continue;
    insertedFactKeys.add(key);
    await db.insert(projectFacts).values({
      projectId,
      fieldName: "standards_mapping",
      value: createTraceableFactValue(
        {
          ...mapping,
          source_reference: mapping.source_reference || processed.source_reference,
        },
        documentRecordId
      ),
      dataState: "DERIVED",
      sourceRef: `document_id:${documentRecordId} | ${mapping.source_reference || processed.source_reference}`,
    });
  }
}
