import "server-only";
import { can, type WorkspaceActor } from "@/server/permissions/capabilities";

/** Sending a GUEST-role invite needs guests.invite; everything else needs members.invite. */
export function canSendInvitation(actor: WorkspaceActor | null, role: string): boolean {
  if (role === "GUEST") return can(actor, "guests.invite");
  return can(actor, "members.invite");
}

/** Whoever can send invites can also see, revoke and resend them. */
export function canManageInvitations(actor: WorkspaceActor | null): boolean {
  return can(actor, "members.invite");
}
