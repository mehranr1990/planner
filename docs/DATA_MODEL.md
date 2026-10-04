# Data Model

Source of truth for implemented entities: `prisma/schema.prisma`, migration `20261001110214_init`. Tables and columns are snake_case. **No future-module entity is migrated yet**; everything below "Planned" is design intent.

Classification:
- **IMPLEMENTED:** migrated and used by code.
- **SCHEMA-ONLY:** migrated, but no code path uses it yet.
- **PLANNED:** design agreed and phase assigned.
- **CONCEPTUAL:** required by the spec, but the design still has open questions (see "Open modelling questions").

## 1. Conventions (apply to every future entity)

- Ids are `cuid()`. Timestamps are `timestamptz(3)` in UTC. Floating dates use `date`. Instants plus a source tz are stored as `timestamptz` + IANA `timezone`.
- **Scope:** `scope ∈ {PERSONAL, WORKSPACE}` plus a nullable `workspace_id`, with the CHECK `PERSONAL ⇔ workspace_id IS NULL` on every scoped table.
- **Deletion:** history-bearing rows are archived (`archived_at`) or soft-deleted (`deleted_at`). FKs to users are `RESTRICT`. History tables (`activities`, `audit_events`, approval steps, automation runs, habit logs, time entries, asset assignments) are append-only.
- **Concurrency:** every collaboratively edited entity gets an integer `version` (§69). Only `tasks` has one today.
- **Idempotency:** client-generated mutation ids for creates. Unique natural keys for generated rows (recurrence occurrences, notification `dedupe_key`, automation run keys).
- **Money:** `Decimal(19,4)` plus an ISO-4217 `currency`. Never floats. Totals are computed per currency.
- **Polymorphism rule:**
  - Collaboration primitives (comments, attachments, reactions, watchers) use **one nullable FK per parent type** with a `num_nonnulls(...) = 1` CHECK, as `comments` does today.
  - History and search (activities, audit, notifications, search index) are polymorphic `(entity_type, entity_id)` because they must outlive the entity.

## 2. IMPLEMENTED

| Model | Purpose | Key constraints / indexes | Used by |
|---|---|---|---|
| User | Identity + preferences (tz, **locale**, theme, week start, active workspace) | `email` unique (lower-cased); `locale` is a `text` column validated in code against `LOCALES`, not an enum, so new languages need no migration | auth, settings, i18n |
| Session | Hashed session token | `token_hash` unique; idx user, expires | auth |
| Workspace | Tenant | `slug` unique | workspace |
| Membership | User ↔ workspace, base role, optional custom role, status, `is_external` (guest/external collaborator) | unique (workspace, user) | permissions |
| Project | Status, health, priority, visibility, dates | scope CHECK; idx (workspace, status) | projects |
| ProjectMember | LEAD/EDITOR/VIEWER | PK (project, user) | access rules (creator added as LEAD) |
| Task | Task engine (§11). Scheduling shape in §4. `sort_order` (Float, existed since Phase 1/2 for project-list order) is now also the manual-ordering key for Inbox/Someday/All/subtasks (Phase 3 batch 4 drag & drop — `reorderTask`, fractional ranking with a bounded rebalance on collision, see `docs/HANDOFF.md` §2b) | scope / schedule / start≤due / no-self-parent / estimate≥0 CHECKs; unique (series, occurrence_on), unique (created_by, client_mutation_id); idx (owner, scope, sort_order), (workspace, sort_order) — added batch 4 for the now-heavier-use `sort_order` ordering queries | planner, projects |
| ChecklistItem | Ordered checklist | idx (task, sort) | task sheet |
| RecurrenceSeries | Recurrence rule | scope, interval≥1, max_count≥1 CHECKs | recurrence |
| TaskDependency | blocking → blocked | PK pair; no-self CHECK; cycles rejected in domain | `DependencyPicker` (sheet), `addDependency`/`removeDependency` |
| Comment | Comments, one level of replies (single-parent CHECK; only the `task` FK is used so far) | idx (task, created), (project, created) | `CommentsSection` (sheet) |
| Mention | @-mentions parsed from a comment body (`@[Name](userId)` tokens) | unique (comment, mentioned); idx (mentioned) | `MENTIONED` notification, mention autocomplete |
| Reminder | One self-service "remind me" per (task, recipient); `remind_at` always an absolute UTC instant (a "relative to due" reminder is resolved at set-time, see docs/HANDOFF.md); `delivered_at` doubles as the delivery claim | unique (task, user); idx (remind_at, delivered_at) for the due-reminder scan | `ReminderControl` (sheet), `deliverDueReminders()` (Vercel Cron) |
| Activity | Append-only user-facing history | idx (entity, created), (workspace, created) | tasks, projects |
| AuditEvent | Append-only compliance history | idx (workspace, created), (target) | workspace, roles, project status, invitations, teams, members |
| WorkspaceRole | Custom role: name, base role, capabilities[] (owner-only capabilities stripped server-side) | unique (workspace, name) | `/settings/workspace/roles`, member-role assignment |
| Team, TeamMember | Teams and their membership (LEAD/MEMBER) | PK (team, user) | `/team/teams` |
| Invitation | Invite flow: hashed single-use token, 7-day expiry, `is_external`, `accepted_membership_id` | partial unique: one PENDING per (workspace, lower(email)) | `/team/invitations`, `/invite/[token]` |
| Notification | In-app notification generation (`dedupe_key` unique, enforced by `notify()`/`notifyMany()`). `data` (Json, default `{}`, added batch 4) carries structured metadata — bulk-aggregated notifications store `{count, taskIds}` (capped at 50 ids); single-task notifications leave it at its default | idx (recipient, read, created) | invitation accepted, role changed, assignment, @mention, comments, status/due-date changes, dependency-unblocked, reminders, **bulk-aggregated status/due-date/assignment/unblock (batch 4 — 4 additive `NotificationType` values, see `docs/HANDOFF.md` §2b)**; UI: `NotificationBell` (shell) |
| PasswordResetToken | Hashed, single-use, expiring reset token | `token_hash` unique; idx user | `/forgot-password`, `/reset-password/[token]` |

## 3. SCHEMA-ONLY (migrated, not yet used by code)

| Model | Planned use | Phase |
|---|---|---|
| NotificationPreference | per category × channel preferences | 6 |
| Area | life/work areas. Still schema-only after batch 4: a full-codebase audit found **zero creation/assignment UI anywhere** for it (no screen can set `Task.areaId`/`Project.areaId`), so batch 4 deliberately dropped "area" from its otherwise-full advanced-filter set rather than ship a picker with no options — revisit once an Area module ships | 3 |
| ProjectSection | lists/columns — `sort_order` ready for Batch 5's board-column drag & drop (batch 4 shipped the general DnD pattern against `Task.sort_order`; board columns are the next consumer) | 3 |
| TaskAssignee, TaskWatcher | assignment and watching UI. Assignees are already honoured in access rules | 3 |
| Label, TaskLabel | labels (partial unique on lower(name) per owner/workspace) | 3 |
| SavedView | saved planner/project views. Considered for batch 4's advanced filters, not used — URL-persisted filter state already satisfies "filters survive navigation/reload," so building saved presets was deferred rather than invented ahead of a concrete ask | 3 |

## 4. Task scheduling and recurrence (implemented rules)

| Shape | is_all_day | due_on | due_at | timezone |
|---|---|---|---|---|
| Undated | true | null | null | null |
| All-day | true | set | null | null |
| Timed | false | local date of due_at | set | IANA tz |

Recurrence:
- Each occurrence is a full Task row.
- Completing the **latest** occurrence generates the next one, copying from that occurrence. **[ASSUMPTION]** The spec doesn't say whether edits propagate.
- `FIXED_SCHEDULE` and `AFTER_COMPLETION` modes are supported.
- Month-day 31 skips short months. **[ASSUMPTION]** RFC 5545 skips; some users expect a clamp.
- A Feb-29 yearly series clamps.
- Changing the rule ends the old series.

## 5. PLANNED entities (by phase; not migrated)

### Phase 3 — Task engine completion & projects
- ~~`TaskParticipant`~~ — not built (Q-DM-1 resolved: participants = watchers, no separate relation).
- Assignees/watchers/dependencies/labels: **already modeled** (`TaskAssignee`, `TaskWatcher`, `TaskDependency`, `Label`/`TaskLabel`) — Phase 3 adds the mutation surface and UI only, not a migration.
- `TaskRelation (from, to, kind: RELATES | DUPLICATES)`: related tasks (§11). Not yet scheduled within Phase 3's batches; revisit if needed.
- ~~`Reminder`~~ — done (batch 3), simpler than planned: task-only (`task_id`, not a polymorphic target set — a second target type adds its own nullable FK + CHECK when one is actually needed, following the `Comment` precedent), no `channel` column (in-app only, like every notification so far), `delivered_at` doubles as both the delivery-state flag and the idempotent delivery claim (no separate `dedupe` column). Delivery also shipped in batch 3 (Vercel Cron + an idempotent per-row claim; full lifecycle policy in `docs/HANDOFF.md`) rather than waiting for the Phase 4 job runner.
- `Milestone (project_id, title, due_on, status)`: §13/§15. Phase 3 batch 5. Portfolio and roadmap reuse it later.
- `ProjectTag`: unify with `Label` (Q-DM-2, still open) — Phase 3 ships task-level labels only; project tagging waits for that decision.
- `FileObject (storage_key, provider, mime, size, checksum, uploaded_by, scope)` + `Attachment (file_id, one FK per parent, CHECK)`: §39. Phase 3 batch 3, provider = Vercel Blob (Q-PO-8 resolved).
- ~~`Mention (comment_id, user_id)`~~ — done (batch 2): migrated and wired, §2 above. `message_id` (chat) stays out of scope until Phase 7.
- `Reaction (target FKs, user, emoji)`: §41, reused by chat. Not in Phase 3's approved scope (no reactions requirement) — deferred to Phase 7 (chat).
- `Version` column on `Comment` (`Project` already has optimistic concurrency via other means) — add if/when concurrent-edit conflicts on comments prove to matter; not required by Phase 3's approved scope (comments are append/edit-own, not collaboratively co-edited).

### Phase 4 — Calendar & time
- `Calendar (owner, scope, color, source: internal | external)`
- `CalendarEvent (calendar_id, title, start_at, end_at, all_day, timezone, rrule fields, location, visibility)`
- `EventAttendee`
- `TimeBlock (owner, kind: TASK | MANUAL | FOCUS | MEETING | ROUTINE, task_id?, event_id?, start_at, end_at, series_id?)`. Many per task; never mutates the task.
- `TimeEntry (user, task_id?, project_id?, started_at, ended_at?, duration_seconds, source: TIMER | MANUAL, note)` with a partial unique index guaranteeing **one running entry per user** (`ended_at IS NULL`).
- `FocusSession (user, task_id, time_entry_id, notes, state)`
- `Job (kind, run_at, payload, dedupe_key unique, attempts, status)`: the background-job table (see ARCHITECTURE §Jobs).

### Phase 5 — Life & planning
- `Habit (type: BOOLEAN | COUNT | QUANTITY | DURATION | NUMERIC | SCALE, unit, target Decimal, minimum Decimal, ideal Decimal, schedule fields, time_of_day, streak_rule, starts_on, archived_at)`
- `HabitLog (habit_id, on_date, value Decimal, note)`, unique (habit, on_date, seq) **[ASSUMPTION: multiple logs per day are summed]**
- `Routine`, `RoutineItem (routine_id, sort, ref FKs: habit | task | checklist_text | time_block)`, `RoutineRun`, `RoutineRunItem`. Runs reference items; nothing is destroyed.
- `JournalEntry (owner, on_date, body rich, tags)`, `JournalLink`
- `CheckInTemplate (questions JSON schema, cadence, audience)`, `CheckInResponse`
- `Goal (scope, owner, timeframe, status, target, current, unit, progress_mode: MANUAL | CALCULATED, parent_goal_id)`, `KeyResult`, `GoalLink (goal ↔ project | task | goal)`, `GoalCheckpoint` (history)
- `DailyPlan (user, on_date, notes)`, `DailyPlanItem (task_id | habit_id | event_id, sort)`, `Review (user, kind: DAILY | WEEKLY, period, reflection)`. Plans reference tasks; they never copy them.

### Phase 6 — Attention, search, capture
- `AttentionItem` is derived from Notification + open approvals + due items (Q-DM-3: materialized or computed).
- `SearchDocument (entity_type, entity_id, workspace_id, scope, owner_id, acl_hash, tsvector)` **[ASSUMPTION: Postgres FTS first]**
- `CaptureItem (owner, source: TEXT | URL | IMAGE | EMAIL | CHAT | WEB_CLIP, payload, status, result_entity)`. Q-DM-4: is the planner Inbox a list of tasks or capture items?
- `RecentItem (user, entity)`

### Phase 7 — Chat
- `Channel (workspace, kind: PUBLIC | PRIVATE | PROJECT | DM | GROUP_DM, project_id?, name, archived_at)`
- `ChannelMember (role, last_read_message_id, muted, joined_at)`
- `Message (channel_id, author_id, thread_root_id?, body rich, edited_at, deleted_at, version)`
- `MessagePin`, `SavedMessage`; `Reaction` and `Attachment` are shared
- `MessageLink (message_id → task | doc | project | meeting)`: references for §43
- `Presence` is ephemeral (real-time provider), not a table **[ASSUMPTION]**
- `Announcement` / `StatusUpdate` for §56

### Phase 8 — Flexible work, dashboards, reports
- `Board (scope, project_id?, item_type_id)`, `ItemType`, `Item (board_id, parent_item_id, title, version)`
- `CustomField (owner: board | item_type | project | task-scope, type enum of §9 types, config JSON)`, `CustomFieldValue (field_id, one FK per parent, typed value columns: text, number Decimal, date, json)`
- `Relation (field_id, from_item, to_item)`; Mirror = a field config over a Relation, computed at read time; Formula = a stored AST evaluated by a sandboxed interpreter
- `StatusOption` per board (Q-DM-5: relation to task `TaskStatus` categories)
- `Dashboard (scope, owner, layout JSON)`, `Widget (dashboard_id, kind, source config JSON)`
- `ReportDefinition (filters JSON)`
- `UserCapacity` / `WorkingHours (user, weekday, minutes)` for workload, shared with the SLA business calendar

### Phase 9 — Forms, requests, SLA, approvals
- `Form (scope, fields JSON schema, target: TASK | ITEM | REQUEST, target config, is_public, allow_anonymous)`, `FormSubmission (form_id, submitter_id?, data JSON, status, result entity FK)`
- `RequestType (workspace, name, fields, sla_policy_id, approval_policy)`, `Request (type_id, requester, assignee/team, priority, status, version)`
- `SlaPolicy (response_minutes, resolution_minutes, business_calendar_id, pause_statuses)`, `SlaClock (request_id, kind, started_at, paused_at, accrued_seconds, due_at, breached_at)`, `BusinessCalendar (tz, working hours, holidays)`
- `ApprovalRequest (source FKs: request | task | document | finance_entry | workflow_run, policy, status)`, `ApprovalStep (approver, decision, comment, decided_at)`. Append-only.

### Phase 10 — Meetings & knowledge
- `Meeting (event_id?, project_id?, title, agenda rich, notes rich, status)`, `MeetingParticipant`
- `Decision (meeting_id?, project_id?, title, decision, context, owner, decided_on)`
- `ActionItem` = Task with `source_meeting_id` (Q-DM-6: column on Task vs a link table)
- `Document (scope, parent_id, title, body rich JSON, project_id?, version)`, `DocumentLink` (backlinks), `LiveEmbed (document_id, entity ref)`
- `FileVersion`, `ReviewRequest`, `ReviewComment` (proofing)
- `CallSession (provider, external_id, meeting_id?)`

### Phase 11 — Finance
- `FinanceAccount (label, scope)`, `FinanceCategory (kind: INCOME | EXPENSE | TRANSFER)`
- `FinanceEntry (amount Decimal, currency, occurred_on, category, account, notes, recurring_series_id?, version)`, receipts as `Attachment`
- `Budget (period, category?, amount, currency)`
- `Subscription (service, amount, currency, frequency, next_charge_on, owner, category, payment_source_label, status)`, which generates FinanceEntries idempotently
- `ExchangeRate` (Q-DM-7)

### Phase 12 — Automation & templates
- `Automation (scope, trigger JSON, conditions JSON (typed AST), actions JSON, enabled, version)`, `AutomationRun (automation_id, trigger_event_id, dedupe_key unique, status, depth, started_at, finished_at, error)`, `AutomationRunStep`
- `Workflow` + `WorkflowNode` + `WorkflowEdge` (builder), `WorkflowRun`
- `Playbook`, `PlaybookRun` (traceable instances)
- `Template (kind, source snapshot JSON, scope)`
- `IntegrationConnection (provider, scope, encrypted credentials ref)`, `ExternalActionRun (dedupe, status, log)`, `WebhookDelivery`

### Phase 13 — AI
- `AiJob (kind, input refs, model, status, provenance, created_by)`, `AiResult (job_id, output JSON, applied_at, applied_by)`
- `AiFieldValue` (for AI custom fields), `Agent (scope, allowed_tools[], policy)`, `AgentRun`, `AgentToolCall`, `AgentApproval`

### Phase 14 — Company operations
- `Portfolio`, `PortfolioProject`
- `Release`, `RoadmapItem (links to project | milestone | task)`
- `Cycle (project_id, starts_on, ends_on, status)`, `Task.cycle_id`
- Issue fields on Task: `kind: TASK | STORY | BUG`, `severity`, `reporter_id`, `environment`, `repro` (Q-DM-8: columns on Task vs an extension table)
- `Risk (project_id, title, probability, impact, owner, mitigation, status, raised_on)`
- `Resource (kind: ROOM | EQUIPMENT | PERSON | TEAM | OTHER, capacity, exclusive)`, `ResourceAvailability`, `Booking (resource_id, user_id, during tstzrange, status)` with `EXCLUDE USING gist (resource_id WITH =, during WITH &&) WHERE exclusive AND status <> 'CANCELLED'`
- `Asset (category, identifier unique per workspace, status, owner_id, purchased_on)`, `AssetAssignment (asset_id, user_id, from_at, to_at)`. Append-only history.
- CRM module (separate schema namespace or prefixed tables): `CrmContact`, `CrmCompany`, `CrmLead`, `CrmDeal`, `CrmPipeline`, `CrmStage`, `CrmActivity`

### Phase 15 — Offline
- `ClientMutation (user, client_mutation_id, entity, op, received_at, result)` for queued replay, plus `version` on all editable entities.

## 6. Missing concepts the spec implies but never names

1. **Background jobs / scheduler.** A generic, DB-backed, multi-kind job runner is still planned as `Job` (Phase 4) for SLA breaches, recurring habits, subscription charges, scheduled automations, AI jobs and email delivery. Reminder delivery (the one instance of this that Phase 3 needed) shipped narrowly in batch 3 instead — Vercel Cron + `Reminder.delivered_at` as the claim, not the generic table — so it doesn't block on Phase 4; see `docs/HANDOFF.md` for the design and the deliberate choice not to generalize it yet.
2. **Business calendar / working hours.** Needed by SLA (§37) and workload/capacity (§52).
3. ~~**Reminder** as a shared entity (§11, §22, §27)~~ — done (batch 3) for tasks; habits/subscriptions/meetings extend it with their own FK when built.
4. **Mention** as a stored entity (§41, §42), to drive notifications.
5. **Search index** (§48), permission-aware.
6. **FileObject vs Attachment** split (§39 "metadata separate from storage").
7. **Task participants** (§12), distinct from assignees and watchers.
8. ~~**Onboarding state**~~ — **done (2b):** `User.onboardedAt` + `User.onboardingStep` (Q-PO-3 resolved).
9. **Exchange rates** for multi-currency budgets (§26).
10. **Email ingestion address** per user/workspace (§34, §68).
11. **Data export / account deletion.** Not in the spec; flagged only, not planned (§98).

## 7. Open modelling questions (also in PHASE_PLAN.md → Open decisions)

| ID | Question |
|---|---|
| ~~Q-DM-1~~ | Are "participants" (§12) a role distinct from watchers? — **resolved 2026-10-04 (Phase 3 gate, docs/phases/PHASE_3.md §C): no.** Phase 3 ships Watchers only (existing `TaskWatcher`); no `TaskParticipant` table. Revisit only if a future spec explicitly needs a role distinct from "gets notified." |
| Q-DM-2 | Are Tag and Label (§8) one concept? (Proposed: one `Label` concept, displayed as "tags".) |
| Q-DM-3 | Attention items: computed view or materialized table? |
| Q-DM-4 | Planner Inbox: tasks without a date or project (current), or a separate CaptureItem inbox? |
| Q-DM-5 | Custom board statuses vs the fixed task status categories |
| Q-DM-6 | Meeting action items: a `source_meeting_id` column on Task, or a generic `TaskSource` link table (shared with chat, email, forms, capture)? |
| Q-DM-7 | Multi-currency: report per currency only, or convert with stored rates? |
| Q-DM-8 | Issue/bug fields: columns on Task, or an extension table? |
| ~~Q-DM-9~~ | **Resolved (2b, `docs/phases/PHASE_2b.md` §D.1):** `PasswordResetToken` — a new request invalidates the user's prior unused tokens rather than allowing several valid at once. |
| ~~Q-DM-10~~ | **Resolved (2b, `docs/phases/PHASE_2b.md` §D.1):** "removal revokes sessions' workspace access immediately" needs no new session-revocation mechanism — `getViewer()` already re-reads active `Membership` rows fresh on every request. |

## 8. Migration policy

- Generate with `prisma migrate dev --create-only`.
- Append hand-written SQL (CHECKs, partial/exclusion indexes) to the same file.
- Review, then apply.
- Major changes go **expand → backfill → contract** across releases, with a written rollback note.
- Never edit an applied migration. Never reset shared databases. Never reuse an enum value with a new meaning.

## 9. Text and internationalization

- PostgreSQL text columns are UTF-8, so Persian/Arabic text (including ZWNJ U+200C) round-trips exactly. This is covered by an integration test.
- User content is stored once, as entered, and never translated or copied per language. Only the product UI is translated (`messages/`).
- Business values stay canonical: enums (`HIGH`), ISO dates, UTC instants, decimal money. Locale-specific formatting is never persisted.
- Future search indexing (Phase 6) must use a Unicode-aware configuration (`simple` dictionary or ICU collation) and normalisation that keeps ZWNJ and folds Arabic ي/ك into Persian ی/ک only in the *index*, never in stored content.
