# Phase 2b — Workspaces completion, security, onboarding

Gate document per `docs/PHASE_PLAN.md` §3 (steps A–N) and §4 (12-item pre-implementation gate, §100). Written before any Phase 2b code. Product-owner approval for Q-PO-3, Q-PO-4, Q-PO-12 received 2026-10-03 (recorded in `docs/PHASE_PLAN.md` §5).

## A. Scope & sources read

PRODUCT_SPEC.md §5–§7 (tenancy/identity/workspaces), §87 (flows), §90 (regression), §91 (shared services), §98 (no invention), §99, §100; ARCHITECTURE.md (layers, shared services table, decisions log D1–D13); DATA_MODEL.md §3 (schema-only entities), §5 (Phase 2b planned entities), §6 (open modelling questions), §7 (Q-DM index); PERMISSIONS.md §1 (capability table), §2 (planned taxonomy), §4 (Q-PERM index); PAGE_INVENTORY.md §1 (built), §2.1–2.2 (planned); COMPONENT_INVENTORY.md §4–§5; ACCEPTANCE_CRITERIA.md §1 (D1–D24), §4 (AC-* current), §5 (module seeds); COVERAGE_MATRIX.md (Identity & account, Workspaces & team rows); current code: `prisma/schema.prisma`, `src/server/permissions/capabilities.ts`, `src/server/context.ts`, `src/server/auth/session.ts`, `src/server/auth/password.ts`, `src/server/run-action.ts`, `src/server/errors.ts`, `src/server/activity.ts`, `src/features/{workspace,account,auth,projects}/server/*`, `messages/{en,fa}/*.json`.

## B. Module specification

### B.1 Onboarding (Q-PO-3, approved)

4 steps, short/non-blocking/resumable/idempotent/safe-to-retry, never permanently limits product functionality:

1. **Your setup** — name, language, timezone, week start. Prefilled from the account (set at sign-up) and browser-derived values (`Intl.DateTimeFormat().resolvedOptions().timeZone`, `navigator.language`).
2. **Usage context** — Personal, or With a team. Customizes steps 3–4 only.
3. **Workspace setup** — only for "With a team" and not arriving via a valid invitation: workspace name + optional icon. If arriving via a valid invitation token: show the invited workspace, skip creation entirely.
4. **First action**:
   - Personal → create first task (skippable).
   - Team → invite teammates, optionally create first project (skippable).
5. → `/home`.

State: `User.onboardedAt` (nullable timestamp, null = not onboarded) + `User.onboardingStep` (nullable int, current step for resume). Idempotent/safe-to-retry: every step write is a plain `user.update`; re-entering `/onboarding` after a crash resumes at `onboardingStep`; completing step 4 (or skipping it) sets `onboardedAt`. A user who never completes onboarding keeps full product access — `/onboarding` is shown once per session start (middleware/layout check), never a hard gate.

Invitation adaptation: `/onboarding?invite=<token>` (reached from `/invite/[token]` when the visitor has no account) pre-selects "With a team", pre-fills the invited workspace in step 3 and skips its creation, and pre-fills email from the invitation.

### B.2 Email provider (Q-PO-4, approved)

`EmailProvider` interface in `src/server/email/provider.ts`: `send(input: { to: string; template: EmailTemplate; data: Record<string, unknown> }): Promise<void>`. Two adapters:
- `ResendAdapter` (`src/server/email/resend.ts`) — production/staging, picked when `EMAIL_PROVIDER=resend` (or `NODE_ENV=production` default).
- `ConsoleAdapter` (`src/server/email/console.ts`) — dev/test default; logs the send, never calls a network API (matches how E2E already avoids external dependencies, D13).

Selection via `src/server/email/index.ts` reading `process.env.EMAIL_PROVIDER`, exported as a single `emailProvider` instance. Domain/service code (invitations, password reset) depends only on the `EmailProvider` type, never on `resend` directly (D14). A send failure is caught at the call site and never rolled back into the triggering transaction — the invitation/reset token row is the source of truth; email is a best-effort notification of it (so a Resend outage cannot corrupt invitation, membership, password-reset or account state, per Q-PO-4).

### B.3 Workspaces completion (§7)

- **Invitations**: send (email + role), revoke, resend, accept. Token: random 32 bytes, SHA-256 hashed at rest (mirrors `Session`/reuses the same `hashToken` shape), single-use, expiring (7 days), one PENDING invite per (workspace, lower(email)) — already enforced by the existing partial unique index. Accept requires the signed-in (or just-registered) user's email to match the invitation's email (case-insensitive); on accept, creates a `Membership` and sets `Invitation.acceptedMembershipId` + `acceptedById`, status → ACCEPTED.
- **Remove / deactivate / reactivate members**: remove deletes the `Membership`; deactivate sets `status = DEACTIVATED` (+`deactivatedAt`); reactivate reverses it. Last-owner guard reused from `changeMemberRole`'s pattern. Removing/deactivating never touches `Session` rows (see D.3 below) — the next request's `getViewer()` re-reads `Membership` and the user simply has no actor for that workspace.
- **Teams**: CRUD (create/rename/archive — soft, matches `archivedAt` convention elsewhere), add/remove member, set lead (`TeamRole`).
- **Guests / external collaborators**: `Membership.isExternal: Boolean @default(false)`. A GUEST-role membership with `isExternal = true` is an external collaborator (DATA_MODEL.md §5 assumption, now implemented). No new capability for "guest" itself — `guests.invite` gates who may create a GUEST membership (via invite with role=GUEST).
- **Custom roles**: CRUD against the existing `WorkspaceRole` model (name, baseRole, capabilities[]). Deleting a role in use reassigns affected memberships to the role's `baseRole` first (guarded, single transaction).
- **Audit log view**: read-only, cursor-paginated list of `AuditEvent` rows, newest first, filterable by action/target type.
- **Settings split (§6)**: `/settings` becomes a sub-nav of `profile | account | appearance | notifications | preferences | security | connections`, plus workspace-scoped `/settings/workspace/{general,roles,audit}`. "Connections" and the real notification-preferences UI are placeholders in 2b (full implementation is Phase 6/12); the page exists with an empty/"coming soon" state so the nav is complete and D7 (empty state) is satisfied without inventing scope.

### B.4 Notification core (in-app only)

`notify(tx, input)` in `src/server/notifications.ts`, called inside the same transaction as the triggering mutation (mirrors the `createTask` core pattern, §91): creates a `Notification` row with a computed `dedupeKey`, `ON CONFLICT DO NOTHING` semantics (via `skipDuplicates` on `createMany`, or a caught unique-violation on `create` — see F). Triggers wired in 2b: `INVITATION` (invite sent → notify invited existing user, if any — an invitation to an email with no account yet has nothing to notify), `WORKSPACE_ROLE_CHANGED` (role change → notify the target). No delivery channel, no preferences UI, no email fan-out yet (`NotificationPreference` rows are not read in 2b — that's Phase 6). Listing/reading notifications (for anyone to consume later) is out of 2b's UI scope (Attention Centre is Phase 6); 2b only needs the generation core + the DB rows to exist correctly, since D19 requires any future consumer to reuse this one function.

### B.5 Security settings (Q-PO-12, approved scope)

- **Change password**: requires current password (`verifyPassword` against the session user's hash), validates the new password (same Zod rule as sign-up, min 10 chars), then re-hashes and updates, then revokes all other sessions (keeps the current one — see D.3) and records an audit-less personal action (no `AuditEvent` — that model is workspace-scoped; this is a personal-account action, logged nowhere beyond the password hash change itself, matching how `Session`/`Membership` audit is workspace-only).
- **Forgot / reset password**: `PasswordResetToken` (new model, D.1). Request: always returns the same generic message regardless of whether the email exists (reuses the `dummyPasswordHash`-style timing-equalization idea — see F). Reset: token hash lookup, expiry (1 hour), single-use (`usedAt`), invalidates the user's other outstanding reset tokens on each new request (Q-DM-9, resolved below), and revokes all sessions on successful reset.
- **Active sessions**: list (`Session` rows for the viewer, `userAgent`, `lastSeenAt`, `createdAt`, "current" flag), revoke one (not the current one — a dedicated "sign out" covers that path), "sign out all other sessions".
- **Explicitly out of scope** (do not invent, §98): 2FA/TOTP, passkeys/WebAuthn, recovery codes, trusted devices, login history beyond the sessions list, IP intelligence, suspicious-login detection, email-address change.

## C. Page inventory (finalized; PAGE_INVENTORY.md §2.1/§2.2 made exact)

| Route | Purpose | Key states |
|---|---|---|
| `/onboarding` | 4-step wizard | step transition only; full-screen stepper on mobile |
| `/invite/[token]` | Invite preview + accept; sign-up inline if no account | expired / revoked / already-member / wrong-email / valid |
| `/forgot-password` | Request reset email | generic success message always |
| `/reset-password/[token]` | Set new password | expired/used token, mismatch, success → sign-in |
| `/settings/profile` | name, avatar URL (upload stays out, Q-PO-8) | |
| `/settings/account` | email (read-only), locale | |
| `/settings/appearance` | theme | |
| `/settings/notifications` | placeholder empty state ("Phase 6") | E only |
| `/settings/preferences` | timezone, week start | |
| `/settings/security` | password change, reset-link entry point, sessions list | E (no other sessions), confirm dialogs |
| `/settings/connections` | placeholder empty state ("Phase 12") | E only |
| `/settings/workspace/general` | name, icon, timezone | P if not `workspace.manage` |
| `/settings/workspace/roles` | custom-role editor | E (no custom roles), P |
| `/settings/workspace/audit` | audit log, cursor-paginated | E, P |
| `/team/invitations` | pending/accepted/revoked/expired list + invite dialog | E, P |
| `/team/teams`, `/team/teams/[teamId]` | team CRUD + membership | E, P |
| `/team/guests` | guest/external member list | E, P |

Overlays: invite dialog, member sheet (role/teams/deactivate/remove), custom-role editor sheet, transfer-ownership confirm, sign-out-all-sessions confirm, revoke-session confirm, revoke-invite confirm — all via the new `ConfirmDialog` + existing `Dialog`/`Sheet`.

`/settings` and `/team` (existing combined pages) are split into the above; their current content moves, it is not duplicated.

## D. Data model diff + migration plan

Single expand-only migration (no backfill/contract — every new column is nullable or defaulted):

1. `PasswordResetToken` (new model): `id`, `userId` (FK → User, `onDelete: Cascade`), `tokenHash String @unique`, `expiresAt`, `usedAt?`, `createdAt`. `@@index([userId])`.
2. `Membership.isExternal Boolean @default(false)`.
3. `User.onboardedAt DateTime? @db.Timestamptz(3)`.
4. `User.onboardingStep Int?`.
5. `Invitation.acceptedMembershipId String?` + relation to `Membership` (`onDelete: SetNull`).

No changes to `Session`, `Notification`, `NotificationPreference`, `AuditEvent`, `Team`, `TeamMember`, `WorkspaceRole` — all already correctly shaped for 2b's needs (verified directly against `prisma/schema.prisma`, not just the planning docs).

### D.1 Resolved modelling questions (raised here per §100 item 11, not silently assumed)

- **Q-DM-9 (new, resolved for 2b)**: `PasswordResetToken` — a new request invalidates the user's prior unused tokens (delete or mark used) rather than allowing several valid tokens at once. Simplest correct behaviour; matches "last request wins."
- **Q-DM-10 (new, resolved for 2b)**: "removal revokes sessions' workspace access immediately" (ACCEPTANCE_CRITERIA.md module seed, Workspaces 2b) needs **no new session-revocation mechanism**. `Session` is user-level, not workspace-scoped; `getViewer()` (`src/server/context.ts:28`) already re-reads active `Membership` rows fresh on every request via `cache()` (request-scoped, not cross-request), so the very next request after removal/deactivation already has no actor for that workspace. This criterion is satisfied by existing code; confirmed here rather than silently relied upon.

## E. Permission matrix rows

New capabilities added to `CAPABILITIES` (`src/server/permissions/capabilities.ts`):

| Capability | OWNER | ADMIN | MANAGER | MEMBER | GUEST | Gates |
|---|:-:|:-:|:-:|:-:|:-:|---|
| `members.deactivate` | ✓ | ✓ | | | | deactivate/reactivate a member |
| `guests.invite` | ✓ | ✓ | | | | invite with role=GUEST / external collaborator |

(`members.invite`, `members.manage`, `roles.manage`, `audit.view`, `teams.manage` already exist with the right defaults — PERMISSIONS.md §1.1 — and need no change.)

Personal-ownership (L1) gates, no new capability — each feature's `access.ts` checks the actor is acting on their own record:
- Notifications: `recipientId === viewer.user.id`.
- Security (password, sessions): always the viewer's own `User`/`Session` rows; a session row's `userId` must equal the viewer before it can be revoked.

Confirmed at this gate: **Q-PERM-4** ("can guests see the member directory?") stays **no** for 2b — `members.view` already defaults to an empty set for GUEST, so `/team/guests` and `/team` are unreachable (NOT_FOUND-equivalent empty state) for a GUEST actor; no new logic needed, just confirmed rather than assumed. **Q-PERM-6** (automation ownership on removal) stays open/not-applicable — no automations exist until Phase 12; noted so it isn't lost.

## F. Server / domain operations (service function list)

- `features/invitations/server/{access,service,actions,queries}.ts` — `sendInvitation`, `resendInvitation`, `revokeInvitation`, `acceptInvitation(viewer|null, token, {email if signing up})`, `listInvitations`.
- `features/teams/server/{access,service,actions,queries}.ts` — `createTeam`, `renameTeam`, `archiveTeam`, `addTeamMember`, `removeTeamMember`, `setTeamLead`, `listTeams`.
- `features/roles/server/{access,service,actions,queries}.ts` — `createCustomRole`, `updateCustomRole`, `deleteCustomRole` (reassigns affected memberships to `baseRole` first), `listCustomRoles`.
- `features/workspace/server/service.ts` (extend) — `removeMember`, `deactivateMember`, `reactivateMember`, `updateWorkspaceSettings` (name/icon/timezone), `transferOwnership` (if time allows; otherwise explicitly deferred — see Risks).
- `features/audit/server/queries.ts` — `listAuditEvents` (cursor-paginated, `workspace.manage`-gated via `audit.view`).
- `src/server/notifications.ts` — `notify(tx, {recipientId, workspaceId, actorId, type, entityType, entityId, title, deepLink, dedupeKey})`; dedupe via `create` + catch-unique-violation (Prisma has no portable `ON CONFLICT DO NOTHING` for a single `create`, so this mirrors `isUniqueViolation` already used in `workspace/server/service.ts`).
- `src/server/email/{provider,resend,console,index}.ts` — the `EmailProvider` abstraction (B.2).
- `features/account/server/service.ts` (extend) — `changePassword`, `requestPasswordReset`, `resetPassword`.
- `features/security/server/{access,service,actions,queries}.ts` — `listSessions`, `revokeSession`, `revokeOtherSessions`. (Split from `account` because it's a distinct access pattern — session rows, not user columns — and keeps `account/service.ts` from growing unrelated concerns.)
- `features/onboarding/server/{service,actions,queries}.ts` — `getOnboardingState`, `saveSetupStep`, `saveUsageContext`, `createOnboardingWorkspace` (thin wrapper over `workspace/server/service.createWorkspace`, no duplicated logic — D19), `completeOnboarding` (sets `onboardedAt`, clears `onboardingStep`), `skipStep`.
- `src/server/auth/session.ts` (extend, additive) — `listSessions(userId)`, `revokeSession(userId, sessionId)`, `revokeOtherSessions(userId, currentSessionId)` (the existing `revokeAllSessions` stays for the deactivation path; a new `exceptId`-aware variant is additive, not a replacement — D18). `getSessionUser` needs its `id` exposed (currently destructured away at session.ts:82) so callers can determine "current session" — additive change, same cache semantics.

New `AUDIT_ACTIONS` string constants (centralized, `src/server/activity.ts` or a sibling file) to avoid ad hoc literals: `member.removed`, `member.deactivated`, `member.reactivated`, `invitation.sent`, `invitation.revoked`, `invitation.accepted`, `role.created`, `role.updated`, `role.deleted`, `team.created`, `team.member_added`, `team.member_removed`, `workspace.settings_updated`, `session.revoked`.

## G. Component list (reuse first)

Reused as-is: `Field`/`Input`/`Select` (`src/components/ui/field.tsx`), `Dialog`/`DialogFooter`, `Sheet`, `Panel`/`EmptyState`/`PageTitle` (`surface.tsx`), `Button`/`IconButton`/`IconLink`, `Chip`, `PeopleCluster` (invited-members/team-preview groups only — D24), `Avatar` (single-row lists: team directory, audit actor column, sessions list).

New shared primitives (both flagged "2b" in COMPONENT_INVENTORY.md §5, build once, reuse everywhere after):
- `ConfirmDialog` — destructive confirmation with typed reason; used by remove-member, deactivate, revoke-invite, revoke-session, delete-role.
- `PeoplePicker` — permission-filtered member search, renders selection via `PeopleCluster`; used by invite-recipient picking and team-membership assignment.

## H/I. Backend + UI — covered above (B–G); implementation follows this document.

## J. Loading / empty / error / mobile / permission / archived states

Enumerated per route in section C. General rules applied: every list (invitations, teams, guests, audit, sessions) gets an `EmptyState` with a next action (D7); every workspace-scoped route gets the `P` (permission) state via the existing capability checks returning NOT_FOUND-equivalent (D4, matching `listMembers`'s `return null` pattern); every settings sub-page and `/team/*` page gets a mobile layout per DESIGN_SYSTEM — single column, sub-nav becomes list→detail push (PAGE_INVENTORY §2.1).

## K. Tests (QA §2 risk matrix)

Unit: invitation token hashing/expiry logic, `notify()` dedupe behaviour, password-reset token lifecycle, onboarding step transitions, custom-role capability filtering (reuse of `isCapability`), last-owner guard reused on remove/deactivate.
Integration: invite send→accept (incl. wrong-email rejection, expired, revoked, double-accept), member remove/deactivate/reactivate incl. last-owner guard, custom role CRUD incl. reassignment-on-delete, audit event writes for every new action, change-password incl. other-session revocation, reset-password incl. single-use + expiry + token invalidation-on-new-request, sessions list/revoke-one/revoke-others, onboarding resume-after-partial-completion.
E2E (§87 flows, extend the 16): invite-to-accept end-to-end (new user), onboarding personal path, onboarding team path via invitation, change password, forgot/reset password, revoke a session.

## L–N. typecheck · lint · test · build; manual + visual pass; docs + coverage matrix

Run after implementation; this gate document is written before any code per §100 item 12. Coverage matrix rows to flip ✅ at the end: COVERAGE_MATRIX.md's Identity & account (IDN-08, IDN-09, IDN-11, IDN-12, IDN-14 — **IDN-10, avatar upload, is re-tagged to Phase 3**, it depends on a file-storage decision, Q-PO-8, not yet made, and the approved 2b scope doesn't mention it) and Workspaces & team rows (WS-06…WS-16, WS-19), plus NOT-01 (notification generation only) and the 2b slice of PRM-07.

## §100 gate checklist (items 1–11)

1. **Reusable code audited**: capability model, `getViewer`/`actorIn`, `Session`/password primitives, `runAction`/`DomainError`/`recordActivity`/`recordAudit`, `createWorkspace`/`changeMemberRole` as the pattern template, `Dialog`/`Sheet`/`Field`/`PeopleCluster` — all reused, none duplicated (see F, G).
2. **Spec re-read**: PRODUCT_SPEC §5–§7, §87, §90, §91, §98 (section A).
3. **Coverage matrix rows checked**: Identity & account, Workspaces & team, Notifications (section L).
4. **Page inventory checked and made exact**: section C.
5. **Data model checked**: section D — most of 2b's schema already exists (DATA_MODEL §3); 5 small additive fields/models needed.
6. **Permission taxonomy checked**: section E; 2 new capabilities, rest reused.
7. **Reusable components/services listed**: sections F, G.
8. **Missing functionality listed**: PasswordResetToken, session-list/revoke, email abstraction, onboarding state, isExternal flag, audit-action constants — all in D/F.
9. **Architectural risks**:
   - `getSessionUser`'s id-destructuring change (F) touches a cached, widely-used function — additive only, re-test all E2E flows that depend on auth (regression rule §90).
   - Password-reset and invite-accept are both unauthenticated, token-scoped entry points (PERMISSIONS.md L4) — must not run through `getViewer()`/session middleware; built as dedicated server actions taking the raw token, same posture as the existing `signInAction`/`signUpAction`.
   - Email failures must not roll back DB state (B.2) — send is called after the triggering transaction commits, not inside it.
   - Ownership transfer is listed as a §7 capability but has no acceptance-criteria detail; implemented only if it fits in scope, otherwise explicitly deferred to Phase 3 in the coverage matrix with a reason (not silently dropped).
10. **Migrations required**: one expand-only migration (section D), no backfill/contract.
11. **Unclear business requirements raised as Q-items, not invented**: Q-DM-9, Q-DM-10 resolved in-document (D.1) since they're implementation-detail judgment calls consistent with existing patterns, not product decisions; Q-PERM-4, Q-PERM-6 confirmed/noted (E) rather than silently assumed; transfer-ownership scope flagged as a risk (item 9) rather than guessed.

## 12. Approval

Product owner approved Q-PO-3, Q-PO-4, Q-PO-12 on 2026-10-03 (this conversation). This document constitutes the written gate artifact required before Phase 2b code is written, per §100 item 12 and ACCEPTANCE_CRITERIA.md §2. Baseline verified green immediately before this gate (149/149 unit+integration, 16/16 E2E flows, 22/22 visual, clean typecheck/lint/build) — see commit history / session log for the run.
