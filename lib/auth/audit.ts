import type { AppDatabase } from "../db/client";
import { adminAuditEvents } from "../db/schema";

export function recordAdminAuditEvent(
  db: AppDatabase,
  input: {
    actorUserId: string | null;
    action: string;
    targetType: string;
    targetId?: string | number | null;
    metadata?: unknown;
  },
) {
  return db
    .insert(adminAuditEvents)
    .values({
      actorUserId: input.actorUserId,
      action: input.action,
      targetType: input.targetType,
      targetId: input.targetId == null ? null : String(input.targetId),
      metadataJson: JSON.stringify(input.metadata ?? {}),
      createdAt: new Date(),
    })
    .returning({ id: adminAuditEvents.id })
    .get().id;
}
