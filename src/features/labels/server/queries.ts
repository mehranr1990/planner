import "server-only";
import { db } from "@/server/db";
import { actorIn, type Viewer } from "@/server/context";
import type { LabelContext } from "./access";

export async function listLabels(viewer: Viewer, context: LabelContext) {
  if (context.scope === "WORKSPACE" && !actorIn(viewer, context.workspaceId)) return [];
  return db.label.findMany({
    where:
      context.scope === "PERSONAL"
        ? { scope: "PERSONAL", ownerId: viewer.user.id, archivedAt: null }
        : { scope: "WORKSPACE", workspaceId: context.workspaceId, archivedAt: null },
    orderBy: { name: "asc" },
    select: { id: true, name: true, color: true },
  });
}
