import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import type { Tx } from "@/server/db";

// Activity = user-facing history; AuditEvent = security/compliance history. Both append-only.

export interface ActivityInput {
  workspaceId: string | null;
  actorId: string;
  entityType: "task" | "project" | "workspace" | "membership" | "milestone";
  entityId: string;
  action: string;
  data?: Prisma.InputJsonValue;
}

export function recordActivity(tx: Tx, input: ActivityInput) {
  return tx.activity.create({ data: { ...input, data: input.data ?? {} } });
}

export interface AuditInput {
  workspaceId: string;
  actorId: string;
  action: string;
  targetType: string;
  targetId: string;
  before?: Prisma.InputJsonValue;
  after?: Prisma.InputJsonValue;
}

export function recordAudit(tx: Tx, input: AuditInput) {
  return tx.auditEvent.create({ data: input });
}
