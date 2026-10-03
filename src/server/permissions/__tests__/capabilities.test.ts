import { describe, expect, it } from "vitest";
import { can, canChangeRole, canRemoveMember, capabilitiesOf, type WorkspaceActor } from "../capabilities";

const actor = (role: WorkspaceActor["role"], extra: Partial<WorkspaceActor> = {}): WorkspaceActor => ({
  userId: `u-${role}`,
  workspaceId: "w1",
  role,
  active: true,
  ...extra,
});

describe("capabilities", () => {
  it("grants owners everything and admins all but deletion", () => {
    expect(can(actor("OWNER"), "workspace.delete")).toBe(true);
    expect(can(actor("ADMIN"), "workspace.delete")).toBe(false);
    expect(can(actor("ADMIN"), "finance.manage")).toBe(true);
  });

  it("keeps finance away from managers and members by default", () => {
    expect(can(actor("MANAGER"), "finance.view")).toBe(false);
    expect(can(actor("MEMBER"), "finance.view")).toBe(false);
  });

  it("gives guests no workspace-wide capabilities", () => {
    expect(capabilitiesOf(actor("GUEST")).size).toBe(0);
  });

  it("deactivated members have nothing", () => {
    expect(can(actor("ADMIN", { active: false }), "members.view")).toBe(false);
    expect(can(null, "tasks.create")).toBe(false);
  });

  it("custom roles replace defaults, drop unknown strings and cannot grant owner-only powers", () => {
    const custom = actor("MEMBER", { customCapabilities: ["finance.view", "workspace.delete", "nonsense"] });
    expect(can(custom, "finance.view")).toBe(true);
    expect(can(custom, "tasks.create")).toBe(false);
    expect(can(custom, "workspace.delete")).toBe(false);
  });
});

describe("role management", () => {
  it("prevents self role changes", () => {
    const owner = actor("OWNER");
    expect(canChangeRole(owner, { userId: owner.userId, role: "OWNER" }, "MEMBER")).toBe(false);
  });

  it("admins manage lower roles but cannot mint admins or touch peers", () => {
    const admin = actor("ADMIN");
    expect(canChangeRole(admin, { userId: "x", role: "MEMBER" }, "MANAGER")).toBe(true);
    expect(canChangeRole(admin, { userId: "x", role: "MEMBER" }, "ADMIN")).toBe(false);
    expect(canChangeRole(admin, { userId: "x", role: "ADMIN" }, "MEMBER")).toBe(false);
  });

  it("members cannot manage anyone", () => {
    expect(canChangeRole(actor("MEMBER"), { userId: "x", role: "GUEST" }, "MEMBER")).toBe(false);
    expect(canRemoveMember(actor("MEMBER"), { userId: "x", role: "GUEST" })).toBe(false);
  });

  it("removal follows rank; owners cannot simply leave", () => {
    expect(canRemoveMember(actor("ADMIN"), { userId: "x", role: "MANAGER" })).toBe(true);
    expect(canRemoveMember(actor("ADMIN"), { userId: "x", role: "OWNER" })).toBe(false);
    expect(canRemoveMember(actor("OWNER"), { userId: "u-OWNER", role: "OWNER" })).toBe(false);
    expect(canRemoveMember(actor("MEMBER"), { userId: "u-MEMBER", role: "MEMBER" })).toBe(true);
  });
});
