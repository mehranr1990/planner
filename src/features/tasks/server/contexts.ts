import "server-only";
import { can } from "@/server/permissions/capabilities";
import type { Viewer } from "@/server/context";
import type { PlannerScopeFilter } from "../domain/planner-views";

/** Spaces the viewer may create tasks in, for the quick-add picker. Workspace names are user content. */
export function creatableContexts(viewer: Viewer, personalLabel: string) {
  return [
    { value: "personal", label: personalLabel },
    ...viewer.workspaces.filter((w) => can(w.actor, "tasks.create")).map((w) => ({ value: w.id, label: w.name })),
  ];
}

export function defaultCreateContext(viewer: Viewer): string {
  const active = viewer.activeWorkspace;
  return active && can(active.actor, "tasks.create") ? active.id : "personal";
}

/** Parses ?scope= — only workspaces the viewer actively belongs to are accepted. */
export function parseScopeFilter(viewer: Viewer, raw: string | string[] | undefined): PlannerScopeFilter {
  const value = typeof raw === "string" ? raw : undefined;
  if (value === "personal") return { kind: "personal" };
  if (value && viewer.workspaces.some((w) => w.id === value)) return { kind: "workspace", workspaceId: value };
  return { kind: "all" };
}
