import "server-only";
import type { NotificationType } from "@/generated/prisma/client";
import type { Tx } from "@/server/db";
import { notify } from "@/server/notifications";

// Batch 4: one bulk action (e.g. "change the due date on 40 tasks") reuses the exact same
// single-task notification calls a single edit already makes — but firing all of them
// individually would mean up to 40 separate notifications for the same watcher. This module
// collects every (recipient, event type) candidate a bulk action's per-task logic would have
// notified, and collapses each recipient's duplicates into ONE notification per event type.
//
// Invariants (enforced here, and verified in src/server/__tests__/notify-bulk.integration.test.ts
// rather than left to convention):
//   - A recipient who would get exactly one notification of a given type keeps the ORIGINAL,
//     non-"_BULK" type and shape — a bulk action that only ends up touching one task (for that
//     recipient) is indistinguishable from a single-task edit.
//   - A recipient who would get more than one gets exactly ONE "_BULK"-typed notification instead
//     — never both the individual ones AND a bulk one.
//   - "_BULK" types are only ever produced by `flush()` here — no single-task service function
//     imports this module.

const BULK_TYPE: Partial<Record<NotificationType, NotificationType>> = {
  TASK_STATUS_CHANGED: "TASK_STATUS_CHANGED_BULK",
  TASK_DUE_DATE_CHANGED: "TASK_DUE_DATE_CHANGED_BULK",
  TASK_ASSIGNED: "TASK_ASSIGNED_BULK",
  TASK_UNBLOCKED: "TASK_UNBLOCKED_BULK",
};

interface Candidate {
  taskId: string;
  title: string;
  workspaceId: string | null;
}

export interface BulkNotifyCandidateInput {
  recipientIds: readonly string[];
  type: NotificationType;
  taskId: string;
  title: string;
  workspaceId: string | null;
}

export class BulkNotifyAccumulator {
  private readonly bulkOpId: string;
  private readonly actorId: string;
  // recipientId -> type -> candidates. A Map (not a plain object) keys safely on arbitrary cuids.
  private readonly byRecipient = new Map<string, Map<NotificationType, Candidate[]>>();

  constructor(bulkOpId: string, actorId: string) {
    this.bulkOpId = bulkOpId;
    this.actorId = actorId;
  }

  /** Queues one event's recipients (already actor-excluded/deduped by `taskNotifiableRecipients`). */
  add({ recipientIds, type, taskId, title, workspaceId }: BulkNotifyCandidateInput): void {
    for (const recipientId of recipientIds) {
      if (recipientId === this.actorId) continue; // belt-and-suspenders actor exclusion
      let byType = this.byRecipient.get(recipientId);
      if (!byType) this.byRecipient.set(recipientId, (byType = new Map()));
      const list = byType.get(type) ?? [];
      // Same task queued twice for the same recipient+type (shouldn't happen — one call site per
      // event per task) would otherwise double-count; de-dupe on taskId defensively.
      if (!list.some((c) => c.taskId === taskId)) list.push({ taskId, title, workspaceId });
      byType.set(type, list);
    }
  }

  /** Writes the collapsed notifications. Call once, inside the bulk action's own transaction. */
  async flush(tx: Tx): Promise<void> {
    for (const [recipientId, byType] of this.byRecipient) {
      for (const [type, candidates] of byType) {
        if (candidates.length === 1) {
          const c = candidates[0];
          await notify(tx, {
            recipientId,
            workspaceId: c.workspaceId,
            actorId: this.actorId,
            type,
            entityType: "task",
            entityId: c.taskId,
            title: c.title,
            deepLink: `/planner/all?task=${c.taskId}`,
            dedupeKey: `task:${c.taskId}:bulk:${this.bulkOpId}:${type}:${recipientId}`,
          });
          continue;
        }
        const bulkType = BULK_TYPE[type];
        if (!bulkType) {
          // No aggregated counterpart defined for this type — fall back to one notification per
          // task rather than silently dropping any. Not expected to happen for the event types
          // bulk.ts actually queues (status/due-date/assigned/unblocked all have one above).
          for (const c of candidates) {
            await notify(tx, {
              recipientId,
              workspaceId: c.workspaceId,
              actorId: this.actorId,
              type,
              entityType: "task",
              entityId: c.taskId,
              title: c.title,
              deepLink: `/planner/all?task=${c.taskId}`,
              dedupeKey: `task:${c.taskId}:bulk:${this.bulkOpId}:${type}:${recipientId}`,
            });
          }
          continue;
        }
        await notify(tx, {
          recipientId,
          workspaceId: candidates[0].workspaceId,
          actorId: this.actorId,
          type: bulkType,
          entityType: "task",
          entityId: `bulk:${this.bulkOpId}`,
          title: String(candidates.length),
          deepLink: "/planner/all",
          data: { count: candidates.length, taskIds: candidates.slice(0, 50).map((c) => c.taskId) },
          dedupeKey: `bulk:${this.bulkOpId}:${type}:${recipientId}`,
        });
      }
    }
  }
}
