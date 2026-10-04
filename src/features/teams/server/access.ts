import "server-only";
import { can, type WorkspaceActor } from "@/server/permissions/capabilities";

export function canManageTeams(actor: WorkspaceActor | null): boolean {
  return can(actor, "teams.manage");
}
