import "server-only";
import { can, type WorkspaceActor } from "@/server/permissions/capabilities";

export function canManageRoles(actor: WorkspaceActor | null): boolean {
  return can(actor, "roles.manage");
}
