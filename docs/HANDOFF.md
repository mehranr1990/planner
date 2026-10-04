# Handoff — read this first

> **For Claude on a new machine.** This repository was built over several sessions with the product owner. This file states what was done, what is left, the rules that were agreed, and how to set the project up. It is loaded automatically through `CLAUDE.md`.
>
> - **Last updated:** 2026-10-04
> - **Current state:** Phase 2b complete. **Phase 3 approved and in progress — Batch 4 of 6 done.**
> - **Next step:** Phase 3 **Batch 5** (board view, timeline view, milestones — includes board-column drag & drop, deferred from batch 4 since there was no Board UI yet to attach it to). Gate document and full batch plan: `docs/phases/PHASE_3.md`. Continue the batches in order; run the §100 end-of-batch checks (typecheck/lint/test/E2E/build, no regressions) before starting the next one. **Attachments are still unscheduled** (deferred out of batch 3, and batch 4 did not pick them up either — see §2 batch 3/4 rows) — revisit with the product owner before batch 5 starts; Q-PO-8 already resolved it to Vercel Blob, so only scheduling is open.
>
> The product owner writes in **Persian (Farsi)**. Reply in Persian unless they write in English. Code, docs and commit messages are in English.

---

## 1. What this product is

A **personal + company productivity operating system**: planner, tasks, projects, calendar, habits, goals, chat, docs, forms/requests, finance, automation, AI… in one coherent product. It is not a todo app or a clone.

The canonical definition lives in `docs/PRODUCT_SPEC.md` (§0–§100 plus the cross-cutting I18N section P). Everything else in `docs/` is derived from it and **must stay in sync with the code**.

| Document | Purpose |
|---|---|
| `docs/PRODUCT_SPEC.md` | What to build (canonical) |
| `docs/ARCHITECTURE.md` | Stack, layering, shared services, task-creation core, i18n, jobs plan, decisions D1–D13 |
| `docs/DATA_MODEL.md` | Implemented / schema-only / planned / conceptual entities; open modelling questions |
| `docs/PERMISSIONS.md` | Capability model + object rules + planned taxonomy for every module |
| `docs/PAGE_INVENTORY.md` | Built routes + planned routes/states for every module |
| `docs/COMPONENT_INVENTORY.md` | Reusable components with "Used by" (regression rule §90) |
| `docs/DESIGN_SYSTEM.md` | Tokens, type, RTL rules (§12), people pattern (§13), panel headers + forms (§14) |
| `docs/PHASE_PLAN.md` | Phases 0–15, master-area mapping, per-phase workflow, **pre-implementation gate**, **open decisions** |
| `docs/COVERAGE_MATRIX.md` | Feature-level status for every module + traceability for every § |
| `docs/ACCEPTANCE_CRITERIA.md` | Definition of Done D1–D24, phase gates, module seeds |
| `docs/QA.md` | Test strategy, E2E/visual instructions, regression logs |

Visual references: `reference/design/` (primary look: SugarCRM-style shots) and `reference/video/` (behaviour/motion only; see `reference/video/scroll_choreography.md`).

**`reference/` is git-ignored.** The product owner copies it to the new machine manually, into the repo root as `reference/`. If it is missing, ask for it before doing any visual or design work.

---

## 2. What has been done

| Phase | Content | Status |
|---|---|---|
| 0 | Discovery, reference analysis, all permanent docs | ✅ |
| 1 | Foundation: Next.js 16 App Router, Prisma 7 + Postgres, design tokens/primitives, app shell (rail, top bar, mobile tab bar + FAB), email/password auth with DB sessions, personal + workspace tenancy, central capability model, core schema with CHECK constraints, activity + audit | ✅ |
| 2 | Planner (8 views) + task engine: natural-language Quick Add (English keywords), task sheet, recurrence (one successor, race-safe), checklist, soft delete/undo, optimistic concurrency, dependency service (no UI yet), projects list/detail/status/archive, team page with role changes, settings | ✅ (some items deferred to Phase 3, see §3) |
| 2i | **Internationalization:** next-intl (no locale in URLs), English + **Persian RTL**; resolution order account → cookie → Accept-Language → en; 10 namespaces per locale; services emit error *codes* translated at the action boundary; Vazirmatn + Plus Jakarta Sans with an explicit per-direction font stack; Gregorian dates in Persian | ✅ |
| — | **PeopleCluster:** the one standard component for small groups of users (overlap / spaced / strip, photo or pastel initials, real count badges, `+N` from real totals, RTL, accessible) | ✅ |
| 2a | **Quality gate:** a single `createTask` core used by Quick Add and recurrence (§91); all action logic moved into services + a shared `runAction`; in-repo Playwright E2E (16 flows) + visual baseline (22 screenshots); `IconLink`/`IconButton`/`Dialog` consolidation | ✅ |
| — | **Reference alignment** (product-owner feedback): planner view pills centred in the panel header; single-column forms with labels at the start; white pill inputs with select chevrons; dialog divider + two equal footer buttons; E2E DB-connection hardening | ✅ |
| 2b | **Workspaces completion:** invitations (hashed single-use token, email match, resend/revoke), member remove/deactivate/reactivate, teams, guests/external collaborators, custom-roles UI (owner-only capabilities stripped), audit-log view; **settings split** into Profile/Account/Appearance/Notifications/Preferences/Security/Connections; **notification core** (`notify()`, `dedupe_key`, wired from invites + role changes); **onboarding** (4-step wizard, resumable, never blocks other routes); **security settings** (change password, forgot/reset password, active-sessions list/revoke); **email provider abstraction** (console adapter for dev/test, Resend adapter for prod, selected by `EMAIL_PROVIDER`). Gate document: `docs/phases/PHASE_2b.md`. Deferred with a reason (see COVERAGE_MATRIX.md): transfer ownership, avatar upload (→ Phase 3) | ✅ |
| — | **Neon + Vercel migration** (infrastructure, not a product phase; this session is Phase 2b's regression baseline, unchanged): removed every local-database (PGlite) assumption from app code, config, scripts and docs; `prisma.config.ts` resolves a direct (unpooled) Neon connection for the CLI with no silent fallback to the pooled runtime URL; `src/server/db.ts` runtime unchanged (`@prisma/adapter-pg`, now against Neon's pooled endpoint); production-safety guards added before any destructive test setup (`APP_ENV=test` required, `VERCEL_ENV=production` an absolute refusal); `GET /api/health`; `.github/workflows/ci.yml` + `vercel.json` added. **Actual Neon project/branches and the Vercel project/integration still need to be provisioned from their dashboards — see §8 below; nothing has been deployed yet.** | 🟡 code/config ready, provisioning pending |
| — | **Top-shell redesign** (visual only, product-owner reference): desktop left icon rail replaced by a single horizontal header (logo + context switcher start, primary nav as centred text pills with a black active pill, quick add/theme toggle/avatar end), matching a reference top-bar composition. Mobile/tablet unchanged (floating bottom tab bar + FAB). See `docs/QA.md` §3f, `docs/DESIGN_SYSTEM.md` §7. All 22 visual baselines re-recorded | ✅ |
| — | **Contextual left sub-nav** (`SubNav`, follow-up to the top-shell redesign): the reference's left icon rail came back, but as *contextual sub-navigation* for the active top-level module, not a second primary nav — currently only Planner has one (its 8 views). Renders nothing for modules without real sub-views (Home/Projects/Team), by design, not an oversight. See `docs/QA.md` §3f follow-up | ✅ |
| 3 batch 1 | **Task engine collaboration primitives** (gate: `docs/phases/PHASE_3.md`): assignees (`setTaskAssignees`, workspace-aware, `TASK_ASSIGNED` notification), watchers (self-service follow/unfollow), subtasks (`createSubtask` via the shared `createTask` core, one level deep — reorder deferred to batch 4's DnD work), labels (new `features/labels/*`, case-insensitive dedupe, task tagging), and a 9th planner view **Delegated** (owner ∧ assigned-to-someone-else ∧ not done). Resolved Q-PO-8 (**Vercel Blob**, unblocks attachments/avatar upload later) and Q-PO-17 (**yes**, build the delegated view) with the product owner; resolved Q-DM-1 (no separate `TaskParticipant` — folds into watchers) as an implementation-detail call, documented in the gate doc. Zero migrations — the schema already had `TaskAssignee`/`TaskWatcher`/`Label`/`Task.parentId` from earlier phases, schema-only until now | ✅ |
| 3 batch 2 | **Dependencies, comments, mentions** (gate: `docs/phases/PHASE_3.md`): `removeDependency` (mirrors `addDependency`'s "edit rights on the blocked task" permission shape) + a compact `DependencyPicker` (blocked-by/blocking lists, debounced same-scope task search, blocked-state chip) in the sheet; a new `features/collaboration/*` feature for task comments (`Comment.task` — the `project` FK stays unused until a second caller needs it) with one level of replies, author-only edit, author-**or**-`canDeleteTask`-moderator delete, soft delete (body hidden, row retained); @mentions stored as inline `@[Name](userId)` tokens (parsed by regex, not by name-matching — two people can share a first name) inserted by a lightweight in-sheet autocomplete reading a new `getMentionCandidates` query that mirrors `visibleTasksWhere`'s rules member-by-member (a **deviation** from the gate doc's "no live autocomplete yet" — the product owner asked for it directly in the batch 2 brief, superseding that technical note). One migration: new `Mention` model (`comment_id, mentioned_id`, unique pair). Activity vocabulary gained `dependency_removed`/`comment_created`/`comment_edited`/`comment_deleted` | ✅ |
| 3 batch 3 | **Reminders, notification execution, notification inbox, activity hardening** (gate: `docs/phases/PHASE_3.md`): new `features/reminders/*` — one self-service reminder per (task, viewer), explicit date/time or "N days before due" (resolved to an absolute UTC instant at set-time via the existing `zonedToUtc`, never re-floats — full due-date-interaction policy in §2a below), `ReminderControl` in the sheet. **Delivery shipped too** (pulled forward from Phase 4, scoped narrowly — see §2a): a new `/api/cron/reminders` route + `deliverDueReminders()`, claimed per-row inside the same transaction as the notification insert (no separate lock primitive), triggered by `vercel.json`'s new `crons` entry. **Notification execution audited and extended**: `notifyMany()` added alongside `notify()` for fan-out; new `TASK_STATUS_CHANGED`/`TASK_DUE_DATE_CHANGED`/`TASK_UNBLOCKED` types; watcher-policy notifications (owner+assignees+watchers, deduped, actor excluded) now fire on status changes, due-date changes, new comments (`TASK_COMMENTED`, never doubling up with a `MENTIONED` ping for the same comment), and on a dependency's last blocker completing. **Notification inbox built from scratch** (none existed) — `features/notifications/*` (list/mark-read/mark-all-read/unread-count, all scoped server-side to the caller) + `NotificationBell` in the shell header (same `<details>` popover pattern as `AccountMenu`/`ContextSwitcher`). **Activity hardened**: `updateTask` now records distinct `status_changed`/`schedule_changed` events (previously folded into a generic `updated`), plus `reminder_created`/`reminder_updated`/`reminder_removed`. One migration: new `Reminder` model + 3 new `NotificationType` values. **Deviation: attachments were in scope for this batch per the original gate doc but were explicitly excluded by the batch 3 brief** — still not started, carry into a later batch. | ✅ |
| 3 batch 4 | **Advanced filters, bulk actions, drag & drop** (gate: `docs/phases/PHASE_3.md`): a new `features/tasks/server/filters.ts` — one shared `PlannerFilters` shape + `plannerFiltersWhere`/`resolveOwnership`, URL-persisted (`?assignee=&creator=&status=&priority=&label=&project=&dueBefore=&dueAfter=&overdue=&completed=&delegated=&watched=`), composing with every existing planner view (not just the dedicated Delegated view — `delegated`/`watched` *replace* a view's default ownership scoping rather than ANDing on top of it, since "mine" and "delegated" are mutually exclusive by construction; a bug the new integration tests caught before merge). Compact `FilterBar` popover + removable chips, no new UI library. **Bulk selection**: per-row checkboxes, a "select all visible" toggle, both reset on any view/filter change. **Bulk actions** (`features/tasks/server/bulk.ts`): complete/reopen, priority, due date, labels (add/remove — additive, unlike single-task `setTaskLabels`'s replace shape), assignees (add/remove, same reasoning), move to project, delete — every one permission-checked **per task** (best-effort/partial, not atomic — see the gate doc's §13 batch-4 entry for why) and returning `{updatedIds, skippedIds}`. **Bulk notifications collapse per recipient** (`src/server/notify-bulk.ts` + 4 additive `..._BULK` `NotificationType` values + a new `Notification.data` JSON column) — a recipient touched by one task keeps the ordinary single-task notification unchanged; touched by several gets exactly one aggregated notification, never both. **Drag & drop reorder** reuses the existing `Task.sortOrder` Float column (already present; previously only driving project-list order) via a new `reorderTask` service function — entirely server-side rank computation from the two neighbor ids the client's own optimistic reorder supplies, with a *bounded* (±10 siblings, cursor-paginated) rebalance on rank collision, never a full-list renumber. Ships for Inbox/Someday/All/subtasks (the views already `sortOrder`-ordered); the computed-order views (Today/Upcoming/etc.) get no drag handle. New dependency: `@dnd-kit/core` + `@dnd-kit/sortable` + `@dnd-kit/utilities` (keyboard-sortable by default, satisfying the accessibility requirement without extra work). One migration: 2 new `Task` indexes (`sortOrder`-covering) + 4 `NotificationType` values + `Notification.data`. **Deviations** (all decided with the product owner at batch-4 approval, detailed in the gate doc): board-column DnD deferred to batch 5 (no Board UI yet); the `area` filter dropped (zero creation/assignment UI exists for `Area` anywhere in the product); `SavedView` stays unused (URL state already satisfies "filters survive navigation"). | ✅ |

Verified state at handoff (against the pre-existing local dev database — see §8 for why Neon itself isn't yet verified):
- `npm run typecheck` ✅ · `npm run lint` ✅ · `npm test` **278/278** ✅ (244 + 34 new Phase 3 batch 4 tests: 11 ranking-domain unit + 23 filters/bulk/notification-invariant/reorder integration) · `npm run build` ✅ (built into a separate `NEXT_DIST_DIR` to avoid touching the product owner's running `next dev`'s `.next`)
- `npx playwright test` **46/46** ✅ (24 flows — 21 existing + 3 new batch-4 flows covering filter narrowing, bulk multi-select completion, and drag-reorder persistence — + 22 visual, with only the Planner-page baselines changed across locale/theme/viewport and reviewed by hand before recording), with PW_CHANNEL=msedge on Windows
- **Known environment flakiness (not a regression, same as noted after batches 2 and 3):** the local `prisma dev` daemon intermittently drops connections under heavy sequential load; clears up with a restart (kill the process, clear its lock files, `npx prisma dev` again — see the "Known pitfalls" list below for the exact commands). Recurred during this batch too; same root cause, same fix, not investigated further as it doesn't reproduce against a real Neon branch. **One new pitfall found this batch: the daemon's lock files live under `Data/<project>/` where `<project>` is whatever name `prisma dev` assigned (often literally `default`, not the repo name) — clearing the wrong path leaves a stale lock and the restart fails with "Lock file is already being held." Worse, if the daemon's entire `Data/<project>` directory is deleted (not just the `.lock` files) instead of only the lock files, the local database is wiped and every migration must be reapplied (`npx prisma migrate deploy`) before tests will pass again — this happened once during this batch and was recovered this way with no lasting harm, since this local instance only ever holds disposable test fixtures, but it's a sharp edge worth calling out explicitly: delete lock files only, never the project's data directory.**
- **A second, unrelated build flake surfaced and was resolved this batch:** a stale/partial `.next` build directory (left behind by an interrupted build) caused a spurious Turbopack `next/font/google` resolution error (`"next/font/google queries have exactly one entry"`) on every subsequent build attempt. Fix: delete `.next` (or `.next-e2e`) entirely and rebuild — never trust a retry on top of a partial build directory for either tool. A separate, milder flake was Turbopack/Next occasionally serving a stale compiled chunk for a shared layout on a subset of routes within one `next build && next start` cycle (symptom: the new header icon appeared on some pages but not others from the *same* build); re-running `test:visual:update` against a from-scratch `.next-e2e` (and, if needed, also clearing `node_modules/.cache`) converged to a correct, verified-by-hand result every time it was tried.

## 2a. Reminder lifecycle, scheduler design, and notification policy (Phase 3 batch 3)

**Due-date interaction policy** (the batch brief asked for explicit, predictable rules — no ambiguous edge cases):

| Event | Effect on an existing reminder |
|---|---|
| Task's due date changes | **Unchanged.** A reminder is always an absolute UTC instant, fixed at set-time — editing the due date never silently moves a reminder the user already confirmed. (If it was set "N days before due", that offset was resolved into a fixed instant once, at creation/edit time, and is not recomputed.) |
| Task completed | The pending (undelivered) reminder is **deleted**, not just skipped. Completion is a deliberate, usually-permanent state — nobody needs reminding about a done task. |
| Task reopened | **Not restored.** The reminder is gone (see above); the user re-adds one if they still want it. Predictable over clever: resurrecting a stale reminder on reopen would be a surprise. |
| Task soft-deleted | **Kept**, but the delivery engine's live query (`task.deletedAt: null`) skips it while deleted. Unlike completion, soft-delete is an accidental-action safety net (the undo banner), so losing the reminder to a delete-then-undo click would be the more surprising outcome. |
| Task restored | The kept reminder becomes eligible again. If it elapsed during the (normally brief) deleted window, it fires on the next cron tick — accepted as a rare, benign edge case given how short that window usually is. |
| Reminder edited (including after it already fired) | Replaces the single row for that (task, viewer) pair and resets `delivered_at` to null, so it becomes live again at the new time — "edit" most plausibly means "remind me again, at this new time." |
| `remind_at` is already in the past when set | **Allowed, not rejected.** The next cron tick delivers it almost immediately — useful for "remind me in 5 minutes," and simpler than adding a validation rule nothing asked for. |

**Watcher/assignee notification policy** — which task events actually notify people, and which don't (the brief asked for "do not spam… use a documented event-to-notification policy"):

- **Recipients** for every watcher-policy event: task owner + assignees + watchers, deduped into one set, **actor always excluded** (`taskNotifiableRecipients()` in `tasks/server/access.ts`, shared by every call site below so the computation happens exactly once, consistently).
- **Notifies:** status changes (`TASK_STATUS_CHANGED` — covers both `setTaskCompletion`'s complete/reopen and `updateTask`'s other status transitions), due-date changes (`TASK_DUE_DATE_CHANGED`), new comments (`TASK_COMMENTED`, deduped against anyone already getting a `MENTIONED` ping for that same comment), a dependency's last open blocker completing (`TASK_UNBLOCKED` — the one dependency event judged to carry real value; "a dependency was added" does not notify anyone).
- **Does not notify:** title/description/priority/estimate/someday/project-move edits (still recorded as a plain `updated` activity, just no notification — editing a task shouldn't spam its watchers over every minor field), a dependency being *added* (only *resolving* one is notable).
- **Dedupe keys** for the three new event-driven types include the task's post-mutation `version` (`task:{id}:v{version}:status:{userId}`, etc.) so each genuinely new event gets its own notification while an accidental duplicate call for the *same* mutation attempt still collapses to one row, same mechanism `TASK_ASSIGNED` already relied on.
- `TASK_OVERDUE` stays unused, same as before this batch — a "daily digest of overdue tasks" is a Phase 6 (attention centre) concern, not something this batch's per-event model fits naturally.

**Reminder delivery engine** (`src/features/reminders/server/engine.ts`, called from `src/app/api/cron/reminders/route.ts`):

1. Reads up to 100 reminders where `delivered_at IS NULL AND remind_at <= now()`, joined to a live check that the task is not deleted and not `DONE`/`CANCELLED` — this re-evaluates *current* state at delivery time, not whatever was true when the reminder was set, per the brief's requirement.
2. For a workspace-scoped task, also checks the recipient still has an **ACTIVE** membership in that workspace before notifying (skips and marks delivered, never notifies, if they've left) — the one additional "inaccessible user" check added on top of the live task-state filter, since losing workspace access is the realistic way a reminder's recipient stops being allowed to see it.
3. For each candidate, claims it with `UPDATE reminders SET delivered_at = now() WHERE id = ? AND delivered_at IS NULL` **inside the same transaction** as the `notify()` insert. Two workers racing the same row: Postgres serializes the two `UPDATE`s, so exactly one affects a row; the other affects zero and skips notifying — no duplicate delivery, no `FOR UPDATE SKIP LOCKED` or other explicit lock needed for this scale. If `notify()` throws, the whole transaction (claim included) rolls back, so the reminder stays undelivered and is retried next tick — "safe retry" falls out of the transaction boundary for free.
4. The notification's `dedupeKey` includes the reminder's `updated_at` timestamp, not just its id — because editing a reminder after it already fired resets `delivered_at` (see the policy table above), and without `updated_at` in the key the second delivery's `notify()` call would collide with the first one's now-reused dedupe key and silently no-op.

**Why a narrow scheduler, not the Phase 4 `Job` table:** `docs/ARCHITECTURE.md`'s "Background jobs (planned, Phase 4)" section already designs a generic `Job` table (`run_at`, `dedupe_key`, attempts, status) for SLA breaches, habit prompts, subscription charges, automations, AI jobs and email delivery — reminders were explicitly listed as one future consumer of it. This batch's brief asked to use "the smallest appropriate architecture" and not build a queue system prematurely, so reminders got their own tight `Reminder` table + cron route instead of standing up the generic table for its first and only caller. This also happens to resolve Q-PO-13 ("background-job runtime on Vercel: Cron + DB queue, or an external queue") **for this one use case** — Vercel Cron + an idempotent DB-claim — without closing the broader question for Phase 4's other consumers, which may still want the fuller `Job` abstraction once there's more than one kind of scheduled work to generalize over.

**Vercel configuration required** (also see §8 below):
- `vercel.json` now has a `crons` entry: `{"path": "/api/cron/reminders", "schedule": "*/5 * * * *"}`. **Vercel's Hobby plan limits cron jobs to once per day** — if the product owner is on Hobby, this schedule will silently run far less often than every 5 minutes; either upgrade to Pro or accept daily reminder delivery until then.
- Set a `CRON_SECRET` environment variable in the Vercel project. When set, the route requires `Authorization: Bearer <CRON_SECRET>` — which Vercel's own Cron trigger sends automatically once the env var exists, so no other wiring is needed. Left unset locally on purpose (`npm run dev`/tests call the route with no auth header and it's allowed through), so don't set it in local `.env`.

## 2b. Filters, bulk actions, and ordering (Phase 3 batch 4)

**Filter state model:** URL search params, server-parsed — the same mechanism `?scope=`/`?task=`/`?deleted=` already used in `src/app/(app)/planner/[view]/page.tsx`, extended rather than replaced. `parsePlannerFilters(sp)` (`features/tasks/server/filters.ts`) turns `?priority=URGENT,HIGH&label=id1,id2&overdue=1…` into a typed `PlannerFilters` object; every id-valued dimension (assignee/creator/label/project) is validated only for *shape* (looks like a cuid), never for the viewer's access — because every fragment `plannerFiltersWhere` builds is ANDed with the existing `visibleTasksWhere`, a bogus or inaccessible id can only narrow a query to nothing extra, never expose anything new. No client-side filter state beyond the popover's own open/closed `<details>`; every control writes straight to the URL on change via the same `URLSearchParams`-cloning idiom `task-row.tsx` already used for `?task=`.

**Ownership-scoping bug found and fixed during this batch's own integration tests:** `delegated`/`watched` cannot be ANDed on top of a non-Delegated view's default "mine" scoping (`mineWhere`) — `mineWhere` and `delegatedWhere` are mutually exclusive by construction (delegated requires having assignees I'm *not* one of; mine requires the opposite), so "today + delegated" would silently always return zero rows. Fixed by having those two filters *replace* the view's ownership fragment instead of narrowing it (`resolveOwnership` in `filters.ts`): `watched` wins if both are somehow set. `ownershipWhere` (the view's own default, ignoring any filter) stays separately exported for `getPlannerCounts`'s nav-badge counts, which intentionally stay unfiltered.

**Bulk-mutation semantics — best-effort/partial, not atomic:** every function in `features/tasks/server/bulk.ts` loads the requested task ids via a new batched `findVisibleTasks`, partitions them into "allowed" (passes `canEditTask`/`canDeleteTask` individually) and "skipped," and only ever mutates the allowed subset — one shared task a caller can't touch never blocks the rest of a broad multi-select. Every function returns `{updatedIds, skippedIds}`, and the `BulkToolbar` UI surfaces a literal "Updated N · skipped M (no permission)" message rather than pretending every selected task was touched. Each function opens exactly **one** `db.$transaction` for its whole allowed batch (not one per task); where a mutation's side effects are complex enough to risk duplicating business rules (recurrence regeneration, reminder-clearing, dependency-unblock notifications on completion), the existing single-task service logic was refactored to expose a reusable `tx`-scoped core (`completeTaskCore` in `tasks/server/service.ts`) that both the single-task action and the bulk one call — not two implementations of "what happens when a task completes." Bulk mutations are **not** version-guarded (no optimistic-concurrency check against `task.version`), matching the precedent `setTaskAssignees`/`setTaskLabels` already set for relation-changing operations — requiring an exact version match across an entire multi-select would make bulk actions fail constantly in any workspace with concurrent edits. Label/assignee bulk ops are genuinely additive/subtractive (`bulkAddLabels`/`bulkRemoveLabels`, `bulkAddAssignees`/`bulkRemoveAssignees`) — a deliberately different shape from single-task `setTaskLabels`/`setTaskAssignees`'s "replace the whole set," since "add this label to 40 tasks" must never silently strip each task's other labels.

**Bulk notifications collapse per recipient, never duplicate, never spam beyond what the existing policy already allows:** `src/server/notify-bulk.ts`'s `BulkNotifyAccumulator` collects every `(recipient, event type, task)` candidate a bulk action's per-task logic would have generated (the exact same calls `updateTask`/`setTaskCompletion`/`setTaskAssignees` already make for a single task), then flushes once per bulk call, inside the same transaction: a recipient touched by exactly one task in the batch gets the **identical, unchanged single-task notification** (same type, same deep link); a recipient touched by more than one gets **exactly one** aggregated notification instead, using one of 4 new additive `NotificationType` values (`TASK_STATUS_CHANGED_BULK`, `TASK_DUE_DATE_CHANGED_BULK`, `TASK_ASSIGNED_BULK`, `TASK_UNBLOCKED_BULK`) with a new `Notification.data` JSON column carrying `{count, taskIds}` (capped at 50 ids). Never both the individual and the aggregated form for the same recipient/event. This is intentionally *not* new spam-suppression logic layered on top of the existing policy — bulk label/priority/move mutations still notify nobody, exactly as their single-task equivalents don't, because the accumulator only ever receives the same candidates the existing watcher policy already produces. Verified by `batch4.integration.test.ts`'s "bulk notification invariants" block (6 explicit cases: single-task → single type; bulk-of-one → identical to single-task; bulk-of-many → one aggregated row per recipient/type; no duplicates; actor always excluded; a user without visibility is never notified).

**Ordering model:** reuses `Task.sortOrder` (`Float`, already in the schema, already written by recurrence-copy and already driving project-list order — no new column). `reorderTask(viewer, taskId, {beforeId, afterId})` computes the new rank **entirely server-side, inside one transaction** — the client (`TaskListWithSelection`'s optimistic reorder) only ever sends the two visible neighbor ids, never a computed value. `domain/ranking.ts`'s `rankBetween`/`needsRebalance`/`reseedRun` are pure math, never touch the database and are never evaluated client-side. On a rank collision (`needsRebalance` true — the common case is several siblings still at the Float column's `0` default, though in practice `createTask` seeds new rows with `Date.now()`, so true collisions are rarer than that default alone would suggest), `fetchNeighborhood` reseeds only a **bounded** window — up to 10 siblings on each side of the drop point, fetched via Prisma cursor pagination (`cursor: {id}, take: ±10`) rather than loading the whole collection — matching the real view order (`sortOrder` asc, `createdAt` desc tiebreak, same as `queries.ts`'s `viewOrder`) so the reseed never silently reshuffles siblings relative to each other beyond resolving the collision. A full-list renumber is never triggered. DnD ships only where `viewOrder` already sorts by `sortOrder` — Inbox, Someday, All, and subtasks (reusing the same `orderingScope` helper, which picks "siblings under the same parent" vs. "my own personal/workspace top-level list" from the dragged task itself) — the computed-order views (Today/Upcoming/Overdue/Scheduled/Delegated/Completed) get no drag handle, consistent with their ordering having no independent meaning to preserve. Reordering inside a filtered subset of an orderable view is well-defined and safe for the same reason the bounded rebalance is: a drag only ever reads/writes the two visible neighbors (and, on collision, their immediate surroundings) — tasks hidden by an active filter are never touched. New dependency: `@dnd-kit/core` + `@dnd-kit/sortable` + `@dnd-kit/utilities`; `KeyboardSensor` gives arrow-key reordering for free.

---

## 3. What is left (in order)

1. **Phase 3 — approved, in progress.** Batched per `docs/phases/PHASE_3.md`; batches 1–4 done (§2/§2a/§2b above). Remaining:
   - **Attachments** — unscheduled since batch 3 excluded them; batch 4 did not pick them up either. Needs a decision with the product owner on which batch picks it up (Vercel Blob — Q-PO-8 already resolved, so no new product decision is needed, just scheduling).
   - **Batch 5** (next): board view, timeline view, milestones — **including board-column drag & drop**, deferred from batch 4 since there was no Board UI yet to attach it to (the reorder service pattern and `ProjectSection.sortOrder` are both already in place for it).
   - **Batch 6:** transfer ownership (carried over from the 2b gate), avatar upload (carried over from the 2b gate, Vercel Blob), final integration pass
2. **Phases 4–15:**
   - **4:** calendar and time blocks, timers and focus, background job runner
   - **5:** habits, routines, journal, check-ins, goals, daily/weekly review
   - **6:** attention centre and notifications, search, command palette, capture
   - **7:** chat
   - **8:** boards, custom fields, dashboards, reports
   - **9:** forms, requests, SLA, approvals
   - **10:** meetings, docs/wiki, files, proofing
   - **11:** finance
   - **12:** automation, workflows, playbooks, templates
   - **13:** AI
   - **14:** company operations and CRM
   - **15:** PWA/offline and hardening

   Feature-level rows are in `docs/COVERAGE_MATRIX.md`; routes and states in `docs/PAGE_INVENTORY.md`.

All open product decisions (Q-PO-*, Q-DM-*, Q-PERM-*, Q-I18N-*, and the assumptions AS-1…AS-7 already in code) are listed in `docs/PHASE_PLAN.md` §5. **Never invent answers to them (§98). Ask.**

---

## 4. How to work here (rules agreed with the product owner)

1. **Phase discipline:** before any major phase, run the **pre-implementation gate** (`docs/PHASE_PLAN.md` §4) and write `docs/phases/PHASE_<n>.md`. Implement only the approved phase, stop, and report.
2. **Definition of Done** (`docs/ACCEPTANCE_CRITERIA.md` D1–D24):
   - Server-side authorization; Zod validation; tenant scoping.
   - Loading, empty, error, permission and archived states; mobile and RTL checked.
   - Tests added; typecheck, lint, tests, build and E2E all green.
   - **Docs and coverage matrix updated.**
3. **Layering:** `actions.ts` (validate → `getViewer()` → service → `runAction`) → `service.ts` (business rules, transactions, audit) → `access.ts` (object permissions) → domain (pure, unit-tested). No DB access or business logic in actions. Services are **language-neutral** and throw `DomainError(code)`.
4. **§91 shared services:** every task insert goes through `src/features/tasks/server/create.ts` (`createTask`); never add a second insert path. Activity and audit go through `src/server/activity.ts`.
5. **i18n is mandatory for every change:**
   - every string goes into `messages/en/*.json` **and** `messages/fa/*.json`, with semantic keys and ICU plurals
   - logical CSS only (`ms/me/ps/pe/start/end`); mirror directional icons; `dir="auto"` on user content
   - format numbers and dates with `useFormat`/`getFormat`
   - Quick Add parsing stays English-only (I18N-12)
6. **People:** any small group of users uses `PeopleCluster` (DESIGN_SYSTEM §13). Never hand-roll avatar rows; never bring back `AvatarGroup`.
7. **Design:**
   - Follow `docs/DESIGN_SYSTEM.md` and the references; pages without a reference are composed from existing patterns (§96).
   - Panel header = title at the start, selectable pills **centred**, actions at the end.
   - Forms are **single column, labels at the start**, white pill fields, and dialog footers with two equal buttons (§14).
   - `cn()` does not resolve Tailwind conflicts: set sizes on wrappers, not by overriding a primitive's classes.
8. **Regression rule (§90):** before changing a shared component, check COMPONENT_INVENTORY "Used by" and re-run the affected flows. After intentional UI changes, re-record and **review** the visual baselines.
9. **Next.js 16 is newer than your training data:** read `node_modules/next/dist/docs/` before using an API (`AGENTS.md`). `proxy.ts` replaces middleware; request APIs are async.
10. **Don't touch the owner's running `npm run dev`:** E2E builds into `.next-e2e`, and you must not delete `.next` while their dev server runs.
11. Commit or push only when asked. Commit messages end with the co-author trailer the harness provides.

---

## 5. Setting up on a new machine

Requirements: **Node 22+** and npm. No Docker, no local database — the database is always a hosted Neon Postgres branch (see `docs/ARCHITECTURE.md` → "Database (Neon)"). Ask whoever manages the Neon project for a connection string to the **Development** branch (or create your own personal branch from it).

```bash
git clone https://github.com/mehranr1990/planner.git
cd planner
# copy the reference/ folder here manually (not in git)
npm install                      # runs `prisma generate` (client goes to src/generated, git-ignored)
cp .env.example .env             # fill in DATABASE_URL + DIRECT_URL for your Neon Development branch
npm run db:deploy                # applies prisma/migrations (via DIRECT_URL)
npm run dev                      # http://localhost:3000
```

Checks:

```bash
npm run typecheck && npm run lint && npm test && npm run build
npx playwright install chromium  # if the CDN is blocked (it was, from Iran — HTTP 403), skip it and use PW_CHANNEL
PW_CHANNEL=msedge npm run test:e2e        # or PW_CHANNEL=chrome; 21 flows
PW_CHANNEL=msedge npm run test:visual     # 22 screenshots
```

Point `DATABASE_URL` at a **disposable** branch for E2E (it deletes and recreates `@e2e.local`/`@e2e.test` fixtures) — not your personal Development branch, and never Production. `playwright.config.ts` sets `APP_ENV=test` automatically for local runs; the seeding step refuses to run without it.

**Visual baselines are per platform and browser** (`e2e/__screenshots__/<platform>-<browser>/`). Only `win32-msedge` is committed. On another OS or browser, run `npm run test:visual:update` once, **review the images**, and commit them as that platform's baseline. CI (`.github/workflows/ci.yml`) runs on `ubuntu-latest`/chromium and does not yet run `test:visual` for the same reason — a `linux-chromium` baseline needs generating once from that runner before it can be enabled there.

### Known pitfalls

- **Prisma is pinned to 7.10.0:** npm `latest` pointed at an 8.0 RC. Prisma 7 needs `prisma.config.ts` and the `@prisma/adapter-pg` driver adapter.
- **`DATABASE_URL` vs `DIRECT_URL`:** the app runtime only ever uses `DATABASE_URL` (Neon's pooled endpoint); `prisma.config.ts` (migrations, `prisma studio`) only ever uses `DIRECT_URL`/`DATABASE_URL_UNPOOLED` (unpooled). There is no fallback between them — the CLI fails with a clear error if the direct one is missing, rather than silently migrating through the pooler. `prisma generate` needs neither (it never connects).
- **Never set a manual `DIRECT_URL` scoped to Vercel Preview** (or at all, ideally) — it would override the Neon integration's per-deployment `DATABASE_URL_UNPOOLED` and point every Preview's migrations at the wrong branch. See `docs/ARCHITECTURE.md`.
- **Turbopack ignores `adjustFontFallback: false`.** The explicit font stack in `src/app/layout.tsx` exists because of this; don't "simplify" it back to the font variables.
- **Native date/time inputs** follow the browser's locale; dates are stored and shown in Gregorian (Jalali is Q-I18N-1).
- **The seed only touches e2e accounts:** E2E global setup deletes and recreates `@e2e.local` / `@e2e.test` accounts only, and refuses to run at all without `APP_ENV=test` or against `VERCEL_ENV=production`.
- **Email provider defaults to Resend under `next start`** (`NODE_ENV=production`), which throws if `RESEND_API_KEY`/`EMAIL_FROM` aren't set. The provider is built lazily (only on first actual send), so this never breaks `next build`'s page-data collection — but set `EMAIL_PROVIDER=console` in your env (already done for E2E's `webServer`, `playwright.config.ts`, and CI) if you run a local production build without Resend credentials and plan to exercise invite/reset flows.
- **PGlite is gone (2026-10).** If you see references to it in old regression-log entries (`docs/QA.md` §3c/3e) or git history, that's historical — it described a local-only workflow this project no longer uses.
- **Local `prisma dev` daemon flakiness (seen in Phase 3 batches 2–3):** under heavy sequential load (the full `vitest` integration suite, or several Playwright runs back to back) the daemon can start dropping connections ("Connection terminated unexpectedly" / "Server has closed the connection"), on files it had nothing to do with. Fix: kill it, clear its lock files, start it again —
  ```bash
  PID=$(netstat -ano | grep LISTENING | grep <port> | awk '{print $5}' | head -1); taskkill //F //PID "$PID"
  rm -f "$LOCALAPPDATA/prisma-dev-nodejs/Data/<project>/.lock" "$LOCALAPPDATA/prisma-dev-nodejs/Data/durable-streams/<project>/server.lock"*
  npx prisma dev &   # note the new port it prints and update .env's DATABASE_URL/DIRECT_URL if it changed
  ```
  Not seen against a real Neon branch — don't spend time hardening this further, just restart it.
- **A stale/partial `next build` output can poison subsequent builds** (seen once in batch 3): deleting `.next` or `.next-e2e` mid-build and letting Turbopack retry against the partial result produced a spurious `next/font/google` resolution error on every later attempt. If a build fails strangely and you can't explain it from the diff, delete the dist dir (`.next` or `.next-e2e`) fully and rebuild from scratch before assuming it's a real regression.

---

## 6. Map of the code

```
src/app/(auth)/…            sign-in, sign-up, forgot-password, reset-password/[token]
src/app/(public)/…          invite/[token] (reachable signed in or signed out, unlike (auth))
src/app/(app)/…             home, onboarding, planner/[view], projects, projects/[id], team(+invitations/teams/guests),
                             settings/{profile,account,appearance,notifications,preferences,security,connections,
                             workspace/{general,roles,audit}}, loading/error/not-found
src/components/ui/          button (IconButton/IconLink), surface, field, dialog, confirm-dialog, sheet, avatar,
                             people-cluster, people-picker, data-viz
src/components/shell/       app-shell, rail, mobile-tab-bar, context-switcher, theme-toggle, nav
src/features/<module>/      components/, domain/ (pure), server/{actions,service,access,queries}.ts
                             (2b added: invitations, teams, roles, audit, security, onboarding)
src/features/tasks/server/create.ts   the single task-creation core
src/features/tasks/server/{filters,bulk}.ts   advanced-filter query builder; bulk-action service (Batch 4)
src/features/tasks/domain/ranking.ts  fractional-index ordering (rankBetween/needsRebalance), pure, DB-free
src/server/                 db, auth/{session,password,token}, context (Viewer), permissions/capabilities,
                             activity, errors, run-action, notifications.ts (notify(), §91 core), notify-bulk.ts
                             (bulk-notification aggregation, Batch 4), email/ (EmailProvider + console/resend adapters)
src/i18n/                   config, resolve, request (next-intl), messages registry, errors, use-format/get-format
src/lib/                    time (tz + calendar maths), format (Intl), cn, action-result
messages/{en,fa}/*.json     UI copy (13 namespaces)
prisma/                     schema.prisma + migrations (init includes hand-written CHECKs/partial indexes)
e2e/                        Playwright specs, support/ (seed, fixtures, test helpers), __screenshots__/
docs/                       permanent product + engineering documentation (start with this file)
docs/phases/                per-phase §100 gate documents (PHASE_2b.md is the first)
reference/                  design + video references (git-ignored; copied manually)
```

---

## 7. Suggested first message on a new machine or a fresh session

> "Read docs/HANDOFF.md, verify the setup (typecheck, lint, test, build, E2E), and report status."

This file (and `AGENTS.md`) load automatically via `CLAUDE.md` at the start of every session — a fresh session does not need anything pasted into it beyond what it's actually being asked to do next. If Phase 3 is still the active phase (check §2/§3 above and the "Next step" line at the top), the natural continuation is:

> "Continue Phase 3 from docs/phases/PHASE_3.md — start Batch 5."

Only start a **new** phase (4+) with the product owner's explicit approval and the §100 gate (`docs/PHASE_PLAN.md` §4), same as every phase so far.

---

## 8. Neon + Vercel provisioning (manual, pending — no dashboard access from here)

The repository is ready for the Neon + Vercel architecture described in `docs/ARCHITECTURE.md` → "Database (Neon)" / "Deployment (Vercel + Neon)", but none of the following has actually been done — it all requires the product owner's Neon/Vercel accounts:

1. Create (or confirm) a Neon project, with a production/main branch.
2. Create a long-lived **Development** branch; put its pooled + unpooled connection strings in a local `.env` (`DATABASE_URL`, `DIRECT_URL`) to actually work on the app.
3. Create a dedicated, disposable **Test** branch for CI and local E2E; its credentials go in GitHub Actions secrets as `NEON_TEST_DATABASE_URL` / `NEON_TEST_DIRECT_URL` (read by `.github/workflows/ci.yml`).
4. Connect the GitHub repo to a Vercel project; install the official Neon ↔ Vercel integration so it auto-creates an isolated Neon branch per Preview deployment and injects `DATABASE_URL`/`DATABASE_URL_UNPOOLED` per deployment automatically.
5. In Vercel's project settings, set for every environment (Production, Preview, Development): `APP_URL` (the deployment's own URL — without it, invite/reset emails link to `localhost`), and the email vars (`EMAIL_PROVIDER=resend`, `RESEND_API_KEY`, `EMAIL_FROM`) for Production/Preview only — leave them unset for local dev so the console adapter is used.
6. **Do not** add a manual `DIRECT_URL` Vercel env var scoped to Preview (see the ARCHITECTURE.md warning) — let the integration's `DATABASE_URL_UNPOOLED` flow through.
7. **New since Phase 3 batch 3:** set `CRON_SECRET` (Production at minimum; Preview too if reminders should fire there) so `vercel.json`'s `/api/cron/reminders` entry is actually authenticated — see §2a above for the full reminder-delivery design and the Hobby-plan cron-frequency caveat.
8. First deploy: push to `main`. `vercel-build` runs `prisma migrate deploy` against the fresh Production branch (applying the full existing migration history) and then `next build`. Watch the deploy log for the migration step before trusting the deployment.
9. After that first deploy, do the verifications `docs/QA.md` → "Neon/Vercel migration" describes and were **not yet performed**: Preview-vs-Production isolation (create a throwaway record in a Preview deployment, confirm it's absent from Production, then delete it), and a production smoke test (sign up, sign in, create a task, sign out, sign back in, data persists) — clean up any records the smoke test creates. Once deployed, also confirm the cron is actually invoked (Vercel's Cron Jobs dashboard shows recent runs) and that `/api/cron/reminders` returns `{scanned, delivered, skippedInaccessible}` rather than 401.

Until this is done, continue using whatever Postgres connection you already have for `DATABASE_URL`/`DIRECT_URL` locally — the code no longer assumes PGlite specifically, but it still just needs a reachable Postgres via those two env vars, hosted or not.
