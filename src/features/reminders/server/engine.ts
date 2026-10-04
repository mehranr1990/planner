import "server-only";
import { db } from "@/server/db";
import { notify } from "@/server/notifications";

// Reminder-delivery engine (Batch 3 §5). Scoped tightly to reminders — not the generic `Job`
// table docs/ARCHITECTURE.md plans for Phase 4 (reminders, SLA, habit prompts, …). Phase 4 can
// generalize this into that table once a second scheduled-work kind actually needs it; building
// the generic abstraction now, for one caller, would be speculative.
//
// Claim pattern: the due-reminder scan is read-only; each candidate is then claimed with its own
// `UPDATE ... WHERE id = ? AND delivered_at IS NULL` inside the SAME transaction as the
// notification insert. Two workers racing the same row: Postgres serializes the two UPDATEs, so
// exactly one affects a row (the other affects zero and skips notifying) — no duplicate
// delivery, no separate locking primitive needed. If `notify()` throws, the whole transaction
// (claim included) rolls back, so the reminder stays undelivered and is retried next tick —
// "safe retry" without any extra bookkeeping.

const BATCH_LIMIT = 100;

export interface ReminderDeliveryResult {
  scanned: number;
  delivered: number;
  /** Recipient lost standing access (e.g. left the workspace) between set-time and delivery — marked delivered, never notified. */
  skippedInaccessible: number;
}

export async function deliverDueReminders(now: Date = new Date()): Promise<ReminderDeliveryResult> {
  const due = await db.reminder.findMany({
    where: {
      deliveredAt: null,
      remindAt: { lte: now },
      // Respects current task state at delivery time, not set-time (Batch 3 §10): a task
      // completed or soft-deleted since the reminder was set produces no notification.
      task: { deletedAt: null, status: { notIn: ["DONE", "CANCELLED"] } },
    },
    select: {
      id: true,
      taskId: true,
      userId: true,
      updatedAt: true,
      task: { select: { title: true, workspaceId: true, scope: true } },
    },
    orderBy: { remindAt: "asc" },
    take: BATCH_LIMIT,
  });

  let delivered = 0;
  let skippedInaccessible = 0;

  for (const r of due) {
    if (r.task.scope === "WORKSPACE") {
      const stillMember = await db.membership.findFirst({
        where: { workspaceId: r.task.workspaceId!, userId: r.userId, status: "ACTIVE" },
        select: { userId: true },
      });
      if (!stillMember) {
        // Recipient no longer has standing access to this workspace — never notify them about
        // content they can't open, but still mark delivered so this doesn't retry forever.
        await db.reminder.updateMany({ where: { id: r.id, deliveredAt: null }, data: { deliveredAt: now } });
        skippedInaccessible++;
        continue;
      }
    }

    const claimedHere = await db.$transaction(async (tx) => {
      const claim = await tx.reminder.updateMany({ where: { id: r.id, deliveredAt: null }, data: { deliveredAt: now } });
      if (claim.count === 0) return false; // another worker already claimed it
      await notify(tx, {
        recipientId: r.userId,
        workspaceId: r.task.workspaceId,
        actorId: null,
        type: "TASK_DUE_SOON",
        entityType: "task",
        entityId: r.taskId,
        title: r.task.title,
        deepLink: `/planner/all?task=${r.taskId}`,
        // Includes `updatedAt` (not just the reminder id) so an edit-after-delivery — which
        // resets `deliveredAt` to null and bumps `updatedAt` — gets a fresh dedupe key and can
        // notify again; the same delivery of the same generation never double-notifies.
        dedupeKey: `reminder:${r.id}:${r.updatedAt.getTime()}:delivered`,
      });
      return true;
    });
    if (claimedHere) delivered++;
  }

  return { scanned: due.length, delivered, skippedInaccessible };
}
