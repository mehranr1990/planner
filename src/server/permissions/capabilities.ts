// Central capability model. Pure — no I/O — so it is unit-testable and shared by every module.
// Modules ask `can(actor, "tasks.assign")`; they never compare role names themselves.

export const CAPABILITIES = [
  "workspace.manage",
  "workspace.delete",
  "members.view",
  "members.invite",
  "members.manage",
  "roles.manage",
  "teams.manage",
  "audit.view",
  "projects.view_all",
  "projects.create",
  "projects.edit",
  "projects.delete",
  "tasks.view_all",
  "tasks.create",
  "tasks.assign",
  "tasks.edit_any",
  "tasks.delete",
  "chat.manage",
  "forms.manage",
  "automations.manage",
  "reports.view",
  "finance.view",
  "finance.manage",
] as const;

export type Capability = (typeof CAPABILITIES)[number];

export type BaseRole = "OWNER" | "ADMIN" | "MANAGER" | "MEMBER" | "GUEST";

export const ROLE_RANK: Record<BaseRole, number> = {
  OWNER: 50,
  ADMIN: 40,
  MANAGER: 30,
  MEMBER: 20,
  GUEST: 10,
};

const ALL = new Set<Capability>(CAPABILITIES);

const DEFAULTS: Record<BaseRole, ReadonlySet<Capability>> = {
  OWNER: ALL,
  ADMIN: new Set(CAPABILITIES.filter((c) => c !== "workspace.delete")),
  MANAGER: new Set<Capability>([
    "members.view",
    "members.invite",
    "teams.manage",
    "projects.view_all",
    "projects.create",
    "projects.edit",
    "tasks.view_all",
    "tasks.create",
    "tasks.assign",
    "tasks.edit_any",
    "tasks.delete",
    "forms.manage",
    "automations.manage",
    "reports.view",
  ]),
  MEMBER: new Set<Capability>(["members.view", "projects.create", "tasks.create", "tasks.assign"]),
  // Guests see only objects they are explicitly part of (object-level rules), nothing workspace-wide.
  GUEST: new Set<Capability>(),
};

/** Capabilities a custom role may never grant: ownership stays with OWNER. */
const OWNER_ONLY: ReadonlySet<Capability> = new Set(["workspace.delete"]);

export interface WorkspaceActor {
  userId: string;
  workspaceId: string;
  role: BaseRole;
  /** Present when the membership uses a custom role; replaces the base role's defaults. */
  customCapabilities?: readonly string[] | null;
  active: boolean;
}

export function capabilitiesOf(actor: WorkspaceActor): ReadonlySet<Capability> {
  if (!actor.active) return new Set();
  if (actor.role === "OWNER") return ALL;
  if (actor.customCapabilities) {
    return new Set(
      actor.customCapabilities.filter(
        (c): c is Capability => ALL.has(c as Capability) && !OWNER_ONLY.has(c as Capability),
      ),
    );
  }
  return DEFAULTS[actor.role];
}

export function can(actor: WorkspaceActor | null | undefined, capability: Capability): boolean {
  return !!actor && capabilitiesOf(actor).has(capability);
}

export function isCapability(value: string): value is Capability {
  return ALL.has(value as Capability);
}

/**
 * Role changes: actor needs members.manage, must outrank the target's current role,
 * and may only grant roles strictly below their own (owners may grant anything, incl. OWNER).
 * Nobody changes their own role through this path (prevents self-escalation / lockout).
 */
export function canChangeRole(
  actor: WorkspaceActor,
  target: { userId: string; role: BaseRole },
  nextRole: BaseRole,
): boolean {
  if (!can(actor, "members.manage")) return false;
  if (actor.userId === target.userId) return false;
  if (actor.role === "OWNER") return true;
  const mine = ROLE_RANK[actor.role];
  return ROLE_RANK[target.role] < mine && ROLE_RANK[nextRole] < mine;
}

export function canRemoveMember(actor: WorkspaceActor, target: { userId: string; role: BaseRole }): boolean {
  if (actor.userId === target.userId) return actor.role !== "OWNER"; // leaving; last-owner check is done server-side
  if (!can(actor, "members.manage")) return false;
  return actor.role === "OWNER" || ROLE_RANK[target.role] < ROLE_RANK[actor.role];
}
