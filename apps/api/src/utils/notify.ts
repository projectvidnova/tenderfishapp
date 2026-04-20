import { db, notifications, users } from "@tenderfish/db";
import { eq, ne } from "drizzle-orm";

type NotificationType = typeof notifications.type.enumValues[number];

interface NotifyEntry {
  workspaceId: string;
  userId: string;
  projectId?: string | null;
  type: NotificationType;
  title: string;
  body?: string;
  entityType?: string;
  entityId?: string;
}

/**
 * Create a notification for a specific user.
 */
export async function createNotification(entry: NotifyEntry): Promise<void> {
  await db.insert(notifications).values({
    workspaceId: entry.workspaceId,
    userId: entry.userId,
    projectId: entry.projectId ?? null,
    type: entry.type,
    title: entry.title,
    body: entry.body ?? null,
    entityType: entry.entityType ?? null,
    entityId: entry.entityId ?? null,
  });
}

/**
 * Broadcast a notification to all workspace members except the actor.
 */
export async function broadcastNotification(
  entry: Omit<NotifyEntry, "userId"> & { actorId: string },
): Promise<void> {
  const members = await db.query.users.findMany({
    where: (u, { and }) => and(
      eq(u.workspaceId, entry.workspaceId),
      ne(u.id, entry.actorId),
    ),
    columns: { id: true },
  });

  if (members.length === 0) return;

  await db.insert(notifications).values(
    members.map((m) => ({
      workspaceId: entry.workspaceId,
      userId: m.id,
      projectId: entry.projectId ?? null,
      type: entry.type,
      title: entry.title,
      body: entry.body ?? null,
      entityType: entry.entityType ?? null,
      entityId: entry.entityId ?? null,
    })),
  );
}
