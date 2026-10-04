import "server-only";
import type { NotificationType } from "@/generated/prisma/client";
import { isUniqueViolation, type Tx } from "@/server/db";

// §91 shared service: every notification write goes through this one function, so dedupe_key
// (one notification per event+recipient) is enforced in exactly one place. In-app generation
// only — delivery channels and preferences arrive in Phase 6.

export interface NotifyInput {
  recipientId: string;
  workspaceId?: string | null;
  actorId?: string | null;
  type: NotificationType;
  entityType: string;
  entityId: string;
  title: string;
  deepLink: string;
  /** Unique per (event, recipient); a repeat call with the same key is a no-op. */
  dedupeKey: string;
}

export async function notify(tx: Tx, input: NotifyInput): Promise<void> {
  try {
    await tx.notification.create({
      data: {
        recipientId: input.recipientId,
        workspaceId: input.workspaceId ?? null,
        actorId: input.actorId ?? null,
        type: input.type,
        entityType: input.entityType,
        entityId: input.entityId,
        title: input.title,
        deepLink: input.deepLink,
        dedupeKey: input.dedupeKey,
      },
    });
  } catch (e) {
    if (!isUniqueViolation(e)) throw e; // already notified for this event — not an error
  }
}

/**
 * Fans the same event out to several recipients (a "watcher policy" notification — status
 * changes, new comments, dependency unblocks…). `dedupeKeyFor` must vary per recipient (and
 * usually per event occurrence, e.g. by including the entity's post-mutation version) so the
 * same event notifies each recipient exactly once, and a repeat of the *same* event is a no-op.
 */
export async function notifyMany(tx: Tx, recipientIds: readonly string[], input: Omit<NotifyInput, "recipientId" | "dedupeKey"> & { dedupeKeyFor: (recipientId: string) => string }): Promise<void> {
  for (const recipientId of recipientIds) {
    await notify(tx, { ...input, recipientId, dedupeKey: input.dedupeKeyFor(recipientId) });
  }
}
