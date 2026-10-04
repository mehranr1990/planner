import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { DomainError } from "@/server/errors";
import { notify } from "@/server/notifications";
import { listSessions, revokeOtherSessions, revokeSession } from "@/server/auth/session";
import type { Viewer } from "@/server/context";
import * as auth from "@/features/auth/server/service";
import * as invitations from "@/features/invitations/server/service";
import * as onboarding from "@/features/onboarding/server/service";
import * as roles from "@/features/roles/server/service";
import * as teams from "@/features/teams/server/service";
import * as workspaces from "@/features/workspace/server/service";
import { fixtureRun, hasDatabase } from "./helpers";

const suite = hasDatabase ? describe : describe.skip;
const f = fixtureRun();

const code = (p: Promise<unknown>) =>
  p.then(
    () => "resolved",
    (e) => (e instanceof DomainError ? e.code : `unexpected: ${e instanceof Error ? e.message : String(e)}`),
  );

let owner: Viewer;
let manager: Viewer;
let member: Viewer;
let outsider: Viewer;
let workspaceId: string;

suite("Phase 2b service layer (integration)", () => {
  beforeAll(async () => {
    const [o, mg, m, x] = await Promise.all([f.makeUser("owner"), f.makeUser("manager"), f.makeUser("member"), f.makeUser("outsider")]);
    const ws = await f.makeWorkspace(o.id, [
      { userId: mg.id, role: "MANAGER" },
      { userId: m.id, role: "MEMBER" },
    ]);
    workspaceId = ws.id;
    [owner, manager, member, outsider] = await Promise.all([f.viewerFor(o.id), f.viewerFor(mg.id), f.viewerFor(m.id), f.viewerFor(x.id)]);
  });
  afterAll(() => f.cleanup());

  describe("invitations", () => {
    it("sends a hashed, expiring, single-use token and rejects a duplicate pending invite", async () => {
      const email = `invitee-${f.run}@test.local`;
      const { id } = await invitations.sendInvitation(owner, { workspaceId, email, role: "MEMBER" });
      const row = await db.invitation.findUniqueOrThrow({ where: { id } });
      expect(row.tokenHash).toHaveLength(64); // sha256 hex
      expect(row.status).toBe("PENDING");
      expect(row.expiresAt.getTime()).toBeGreaterThan(Date.now());

      expect(await code(invitations.sendInvitation(owner, { workspaceId, email, role: "GUEST" }))).toBe("invitationAlreadyPending");
    });

    it("members.invite is required; guests.invite is required for a GUEST invite", async () => {
      expect(await code(invitations.sendInvitation(member, { workspaceId, email: `x-${f.run}@test.local`, role: "MEMBER" }))).toBe("invitationForbidden");
      expect(await code(invitations.sendInvitation(manager, { workspaceId, email: `g-${f.run}@test.local`, role: "GUEST" }))).toBe("invitationForbidden");
      const { id } = await invitations.sendInvitation(owner, { workspaceId, email: `g2-${f.run}@test.local`, role: "GUEST", isExternal: true });
      const row = await db.invitation.findUniqueOrThrow({ where: { id } });
      expect(row.isExternal).toBe(true);
    });

    it("acceptInvitation rejects an expired token and a revoked token", async () => {
      const invitee = await f.makeUser("invitee-accept");
      const { hashToken, generateToken } = await import("@/server/auth/token");

      // The partial unique index allows only one PENDING invite per (workspace, email); an
      // already-expired row would itself be marked EXPIRED by then, so it doesn't collide.
      const expiredToken = generateToken();
      await db.invitation.create({
        data: { workspaceId, email: invitee.email, role: "MEMBER", tokenHash: hashToken(expiredToken), invitedById: owner.user.id, expiresAt: new Date(Date.now() - 1000), status: "EXPIRED" },
      });
      expect(await code(invitations.acceptInvitation(expiredToken, invitee.id))).toBe("invitationExpired");

      const revokedToken = generateToken();
      const revoked = await db.invitation.create({
        data: { workspaceId, email: invitee.email, role: "MEMBER", tokenHash: hashToken(revokedToken), invitedById: owner.user.id, expiresAt: new Date(Date.now() + 86_400_000) },
      });
      await invitations.revokeInvitation(owner, revoked.id);
      expect(await code(invitations.acceptInvitation(revokedToken, invitee.id))).toBe("invitationRevoked");

      expect((await invitations.previewInvitation("no-such-token")).state).toBe("invalid");
    });

    it("acceptInvitation enforces email match and creates a membership atomically", async () => {
      const invitee = await f.makeUser("invitee2");
      // Mint a token the same way the service does, bypassing the email channel.
      const { hashToken, generateToken } = await import("@/server/auth/token");
      const token = generateToken();
      const inv = await db.invitation.create({
        data: {
          workspaceId,
          email: invitee.email,
          role: "MEMBER",
          tokenHash: hashToken(token),
          invitedById: owner.user.id,
          expiresAt: new Date(Date.now() + 86_400_000),
        },
      });

      expect(await code(invitations.acceptInvitation(token, outsider.user.id))).toBe("invitationEmailMismatch");

      const result = await invitations.acceptInvitation(token, invitee.id);
      expect(result.workspaceId).toBe(workspaceId);
      const membership = await db.membership.findUniqueOrThrow({ where: { workspaceId_userId: { workspaceId, userId: invitee.id } } });
      expect(membership.role).toBe("MEMBER");
      const updatedInv = await db.invitation.findUniqueOrThrow({ where: { id: inv.id } });
      expect(updatedInv.status).toBe("ACCEPTED");
      expect(updatedInv.acceptedMembershipId).toBe(membership.id);

      // Single-use: accepting again fails.
      expect(await code(invitations.acceptInvitation(token, invitee.id))).toBe("invitationInvalid");
    });
  });

  describe("notification core", () => {
    it("one notification per (event, recipient) via dedupeKey", async () => {
      const recipient = await f.makeUser("notif-recipient");
      const dedupeKey = `test:${f.run}:dup`;
      await db.$transaction((tx) =>
        notify(tx, { recipientId: recipient.id, workspaceId, type: "INVITATION", entityType: "invitation", entityId: "x", title: "t", deepLink: "/team", dedupeKey }),
      );
      await db.$transaction((tx) =>
        notify(tx, { recipientId: recipient.id, workspaceId, type: "INVITATION", entityType: "invitation", entityId: "x", title: "t", deepLink: "/team", dedupeKey }),
      );
      expect(await db.notification.count({ where: { dedupeKey } })).toBe(1);
    });
  });

  describe("member lifecycle", () => {
    it("deactivate then reactivate; the last owner can't be deactivated", async () => {
      const target = await f.makeUser("deactivate-me");
      await db.membership.create({ data: { workspaceId, userId: target.id, role: "MEMBER" } });
      await workspaces.deactivateMember(owner, { workspaceId, userId: target.id });
      expect((await db.membership.findFirstOrThrow({ where: { workspaceId, userId: target.id } })).status).toBe("DEACTIVATED");
      await workspaces.reactivateMember(owner, { workspaceId, userId: target.id });
      expect((await db.membership.findFirstOrThrow({ where: { workspaceId, userId: target.id } })).status).toBe("ACTIVE");

      expect(await code(workspaces.deactivateMember(owner, { workspaceId, userId: owner.user.id }))).toBe("lastOwner");
    });

    it("removeMember deletes the membership and is audited", async () => {
      const target = await f.makeUser("remove-me");
      await db.membership.create({ data: { workspaceId, userId: target.id, role: "MEMBER" } });
      await workspaces.removeMember(owner, { workspaceId, userId: target.id });
      expect(await db.membership.findFirst({ where: { workspaceId, userId: target.id } })).toBeNull();
      expect(await db.auditEvent.count({ where: { workspaceId, action: "member.removed", targetType: "membership" } })).toBeGreaterThan(0);
    });
  });

  describe("custom roles", () => {
    it("never grants workspace.delete even if requested; deleting a role reassigns members to its base role", async () => {
      const { id: roleId } = await roles.createCustomRole(owner, { workspaceId, name: `Custom-${f.run}`, baseRole: "MEMBER", capabilities: ["workspace.delete", "members.view"] });
      const role = await db.workspaceRole.findUniqueOrThrow({ where: { id: roleId } });
      expect(role.capabilities).toEqual(["members.view"]);

      const target = await f.makeUser("custom-role-member");
      await db.membership.create({ data: { workspaceId, userId: target.id, role: "MEMBER", customRoleId: roleId } });
      await roles.deleteCustomRole(owner, roleId);
      const membership = await db.membership.findFirstOrThrow({ where: { workspaceId, userId: target.id } });
      expect(membership.customRoleId).toBeNull();
      expect(membership.role).toBe("MEMBER");
    });
  });

  describe("teams", () => {
    it("creates a team, adds/removes members and sets a lead", async () => {
      const { id: teamId } = await teams.createTeam(owner, { workspaceId, name: `Core-${f.run}` });
      await teams.addTeamMember(owner, { teamId, userId: member.user.id });
      await teams.setTeamLead(owner, { teamId, userId: member.user.id, isLead: true });
      expect((await db.teamMember.findUniqueOrThrow({ where: { teamId_userId: { teamId, userId: member.user.id } } })).role).toBe("LEAD");
      await teams.removeTeamMember(owner, { teamId, userId: member.user.id });
      expect(await db.teamMember.findFirst({ where: { teamId, userId: member.user.id } })).toBeNull();
    });
  });

  describe("password reset", () => {
    it("issues a single-use, expiring token; a new request invalidates the previous one; reset revokes all sessions", async () => {
      const user = await f.makeUser("reset-me");
      await db.session.create({ data: { tokenHash: `sh-${f.run}-a`, userId: user.id, expiresAt: new Date(Date.now() + 86_400_000) } });

      await auth.requestPasswordReset(user.email);
      const first = await db.passwordResetToken.findFirstOrThrow({ where: { userId: user.id } });

      await auth.requestPasswordReset(user.email); // second request invalidates the first
      expect(await db.passwordResetToken.findUnique({ where: { id: first.id } })).toBeNull();

      // Unknown email is silently a no-op (never reveals existence).
      await expect(auth.requestPasswordReset(`nobody-${f.run}@test.local`)).resolves.toBeUndefined();

      expect(await code(auth.resetPassword("not-a-real-token", "a brand new password"))).toBe("resetTokenInvalid");

      // Exercise the real stored token via the DB (the raw token never leaves requestPasswordReset).
      const { hashToken, generateToken } = await import("@/server/auth/token");
      const token = generateToken();
      const record = await db.passwordResetToken.create({ data: { userId: user.id, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + 3_600_000) } });
      await auth.resetPassword(token, "a brand new password");
      expect((await db.passwordResetToken.findUniqueOrThrow({ where: { id: record.id } })).usedAt).not.toBeNull();
      expect(await db.session.count({ where: { userId: user.id } })).toBe(0); // all sessions revoked
      expect(await code(auth.resetPassword(token, "another one"))).toBe("resetTokenInvalid"); // single-use
    });
  });

  describe("sessions", () => {
    it("lists sessions and revokes one or all-but-one", async () => {
      const user = await f.makeUser("sessions-user");
      const a = await db.session.create({ data: { tokenHash: `sh-${f.run}-1`, userId: user.id, expiresAt: new Date(Date.now() + 86_400_000), userAgent: "Chrome" } });
      const b = await db.session.create({ data: { tokenHash: `sh-${f.run}-2`, userId: user.id, expiresAt: new Date(Date.now() + 86_400_000), userAgent: "Firefox" } });
      const c = await db.session.create({ data: { tokenHash: `sh-${f.run}-3`, userId: user.id, expiresAt: new Date(Date.now() + 86_400_000), userAgent: "Safari" } });

      expect(await listSessions(user.id)).toHaveLength(3);
      await revokeSession(user.id, a.id);
      expect(await db.session.findUnique({ where: { id: a.id } })).toBeNull();

      await revokeOtherSessions(user.id, b.id);
      expect(await db.session.findUnique({ where: { id: b.id } })).not.toBeNull();
      expect(await db.session.findUnique({ where: { id: c.id } })).toBeNull();
    });
  });

  describe("onboarding", () => {
    it("saves the setup step and completion is idempotent", async () => {
      const user = await f.makeUser("onboarding-user");
      const viewer = await f.viewerFor(user.id);
      expect(viewer.user.isOnboarded).toBe(false);

      await onboarding.saveSetupStep(viewer, { name: "New Name", timezone: "Europe/Berlin", weekStartsOn: 0 });
      let row = await db.user.findUniqueOrThrow({ where: { id: user.id } });
      expect(row).toMatchObject({ name: "New Name", timezone: "Europe/Berlin", weekStartsOn: 0, onboardingStep: 2 });

      await onboarding.completeOnboarding(viewer);
      row = await db.user.findUniqueOrThrow({ where: { id: user.id } });
      expect(row.onboardedAt).not.toBeNull();
      expect(row.onboardingStep).toBeNull();

      // Calling it again is a harmless no-op (idempotent).
      await expect(onboarding.completeOnboarding(viewer)).resolves.toBeUndefined();
    });
  });

  describe("workspace settings", () => {
    it("only workspace.manage can update general settings, and the change is audited", async () => {
      expect(await code(workspaces.updateWorkspaceSettings(member, { workspaceId, name: "Nope" }))).toBe("roleChangeForbidden");
      await workspaces.updateWorkspaceSettings(owner, { workspaceId, name: `Renamed-${f.run}`, timezone: "UTC" });
      const ws = await db.workspace.findUniqueOrThrow({ where: { id: workspaceId } });
      expect(ws.name).toBe(`Renamed-${f.run}`);
      expect(await db.auditEvent.count({ where: { workspaceId, action: "workspace.settings_updated" } })).toBeGreaterThan(0);
    });
  });
});
