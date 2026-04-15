import { db, auditLogs } from "@tenderfish/db";

interface AuditLogEntry {
  workspaceId: string;
  projectId?: string | null;
  userId: string;
  action: string;
  entityType: string;
  entityId: string;
  beforeState?: Record<string, unknown> | null;
  afterState?: Record<string, unknown> | null;
}

/**
 * Write an audit log entry for a state-changing action.
 */
export async function logAudit(entry: AuditLogEntry): Promise<void> {
  await db.insert(auditLogs).values({
    workspaceId: entry.workspaceId,
    projectId: entry.projectId || null,
    userId: entry.userId,
    action: entry.action,
    entityType: entry.entityType,
    entityId: entry.entityId,
    beforeState: entry.beforeState || null,
    afterState: entry.afterState || null,
  });
}
