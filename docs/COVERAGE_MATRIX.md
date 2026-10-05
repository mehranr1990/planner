# Coverage Matrix

Something counts as **implemented** only when it meets the Definition of Done (§89, ACCEPTANCE_CRITERIA.md). A component existing doesn't count.

Legend:
- **Impl:** ✅ done (meets DoD) · 🟡 partial (named gap) · 🗄 schema only · ⬜ not started
- **Test:** U unit · I DB integration · E browser walkthrough (scripted, not yet in repo) · — none
- **Mob** (mobile requirement): S bottom sheet · C cards instead of table · St stacked · P scrollable pills · F full-screen · — n/a
- **Ref** (visual reference / pattern):
  - D1 = desktop1 journey board
  - V7 = video t07 metric cards
  - M1 = mobile1 (journey list, dark date card)
  - M3 = mobile3 project card
  - TY = typography sheet
  - §96 = no reference; compose Panel/Card/Row/Sheet/Pills
- **Perm:** capabilities in PERMISSIONS.md; "rel" = object relationship rules; "own" = personal ownership

---

## 1. Identity & account (§6)

| ID | Feature | Surface | Backend / domain | Perm | Mob | Ref | Impl | Test | Phase |
|---|---|---|---|---|---|---|---|---|---|
| IDN-01 | Sign up | /sign-up | scrypt hash, unique email, session create | — | St | TY | ✅ | E | 1 |
| IDN-02 | Sign in (timing-safe, generic error) | /sign-in | dummy-hash compare | — | St | TY | ✅ | E | 1 |
| IDN-03 | Sign out | account menu | delete session row | own | ✅ | §96 | ✅ | — | 1 |
| IDN-04 | Sliding session, revocation API | proxy + DAL | hashed token, touch interval | own | — | — | ✅ | — | 1 |
| IDN-05 | Safe `?next=` redirect | auth | `safeNext` | — | — | — | ✅ | E | 1 |
| IDN-06 | Preferences: name, tz, week start, theme | /settings | `updatePreferencesAction` | own | St | §96 | ✅ | E | 1 |
| IDN-07 | Browser tz captured at sign-up | /sign-up | validated IANA | — | — | — | ✅ | E | 1 |
| IDN-08 | Locale preference UI | /settings/account | `LanguageForm` | own | St | §96 | ✅ | E | 2b |
| IDN-09 | Settings split (Profile/Account/Appearance/Notifications/Preferences/Security/Connected) | /settings/* | per-section pages + `SettingsNav` | own | push list | §96 | ✅ | E | 2b |
| IDN-10 | Avatar upload | profile | FileObject (3) | own | S | §96 | ⬜ | — | 3 (needs Q-PO-8) |
| IDN-11 | Sessions list + sign out others | /settings/security | Session rows, `listSessions`/`revokeSession`/`revokeOtherSessions` | own | C | §96 | ✅ | E + I | 2b |
| IDN-12 | Password change / reset | /settings/security, /forgot-password, /reset-password/[token] | `PasswordResetToken`, console/Resend `EmailProvider` | own | St | §96 | ✅ | E + I | 2b |
| IDN-13 | Connected services | settings | IntegrationConnection | own | C | §96 | ⬜ | — | 12 |
| IDN-14 | Onboarding | /onboarding | `User.onboardedAt`/`onboardingStep` | own | F | §96 | ✅ | E | 2b |

## 2. Workspaces & team (§5, §7)

| ID | Feature | Surface | Backend / domain | Perm | Mob | Ref | Impl | Test | Phase |
|---|---|---|---|---|---|---|---|---|---|
| WS-01 | Personal + workspace scope | all | scope CHECKs | — | — | — | ✅ | I | 1 |
| WS-02 | Create workspace (creator = OWNER) | /settings | tx + audit, slug retry | — | St | §96 | ✅ | E | 1 |
| WS-03 | Switch context | top bar | membership re-verified | rel | ✅ | D1 top bar | ✅ | E | 1 |
| WS-04 | Member directory | /team | `listMembers` | members.view | C | §96 | ✅ | E | 1 |
| WS-05 | Change role (rank rules, last-owner guard, audit) | /team | `changeMemberRoleAction` | members.manage | C | §96 | ✅ | U | 1 |
| WS-06 | Invite by email | /team/invitations, invite dialog | `Invitation` + hashed token + `EmailProvider` | members.invite | S | §96 | ✅ | E + I | 2b |
| WS-07 | Invitation state (pending/accepted/revoked/expired) | /team/invitations | status, resend, revoke | members.invite | C | §96 | ✅ | E | 2b |
| WS-08 | Accept invite (incl. new account) | /invite/[token] | token hash, email match | token | St | §96 | ✅ | I | 2b |
| WS-09 | Remove member | `MemberActions` menu | membership delete + audit | members.manage | S | §96 | ✅ | I | 2b |
| WS-10 | Deactivate access | `MemberActions` menu | status DEACTIVATED, `getViewer()` re-reads live | members.deactivate | S | §96 | ✅ | I | 2b |
| WS-11 | Teams CRUD + membership | /team/teams | Team, TeamMember | teams.manage | C | §96 | ✅ | I | 2b |
| WS-12 | Guests | /team/guests | GUEST role, directory hidden from guests (Q-PERM-4) | guests.invite | C | §96 | ✅ | — | 2b |
| WS-13 | External collaborators | invite dialog (external checkbox) | GUEST + `is_external` | guests.invite | — | §96 | ✅ | I | 2b |
| WS-14 | Custom roles UI | /settings/workspace/roles | WorkspaceRole CRUD, owner-only capability stripped | roles.manage | S | §96 | ✅ | I | 2b |
| WS-15 | Audit log view | /settings/workspace/audit | AuditEvent read, cursor-paginated | audit.view | C | §96 | ✅ | — | 2b |
| WS-16 | Workspace settings (name, icon, tz) | /settings/workspace/general | update + audit | workspace.manage | St | §96 | ✅ | I | 2b |
| WS-17 | Workspace activity feed | /team | Activity | members.view | St | §96 | 🟡 write only | — | 6 |
| WS-18 | Team directory | /directory | — | members.view | C | §96 | ⬜ | — | 14 |
| WS-19 | Transfer ownership | settings | tx + audit | OWNER | S | §96 | ⬜ | — | 3 (deferred at the 2b gate — no acceptance-criteria detail existed; see `docs/phases/PHASE_2b.md` §100 item 9) |

## 3. Permissions (§7, §83)

| ID | Feature | Backend | Impl | Test | Phase |
|---|---|---|---|---|---|
| PRM-01 | Central capability model | capabilities.ts | ✅ | U | 1 |
| PRM-02 | Custom-role semantics | capabilities.ts | ✅ | U | 1 |
| PRM-03 | Task object rules | tasks/access.ts | ✅ | I | 1 |
| PRM-04 | Project object rules | projects/access.ts | ✅ | I | 1 |
| PRM-05 | Identical not-found / no-access | NOT_FOUND + notFound() | ✅ | I | 1 |
| PRM-06 | Client ids verified against memberships | context/actions | ✅ | I | 1 |
| PRM-07 | Per-module capability additions | PERMISSIONS §2 | 🟡 `members.deactivate`/`guests.invite` done (2b); rest per phase | U | per phase |
| PRM-08 | Service principal for automations/agents | — | ⬜ | — | 12/13 |

## 4. Planner (§10)

| ID | Feature | Surface | Backend / domain | Perm | Mob | Ref | Impl | Test | Phase |
|---|---|---|---|---|---|---|---|---|---|
| PLN-01 | Inbox | /planner/inbox | `viewWhere` | rel ∧ mine | P | V7 pills | ✅ | I, E | 2 |
| PLN-02 | Today (+ overdue group) | /planner/today | user-tz today | rel ∧ mine | P | V7 | ✅ | I, E | 2 |
| PLN-03 | Upcoming (by date) | /planner/upcoming | | | P | | ✅ | I, E | 2 |
| PLN-04 | Overdue (date or passed time) | /planner/overdue | | | P | | ✅ | I | 2 |
| PLN-05 | Scheduled | /planner/scheduled | | | P | | ✅ | — | 2 |
| PLN-06 | Someday/Later | /planner/someday | | | P | | ✅ | — | 2 |
| PLN-07 | Completed | /planner/completed | | | P | | ✅ | E | 2 |
| PLN-08 | All tasks | /planner/all | | | P | | ✅ | I | 2 |
| PLN-09 | Personal + assigned workspace work together; space filter | ?scope= | `parseScopeFilter` | rel | P | | ✅ | I, E | 2 |
| PLN-10 | Quick natural-language creation | QuickAdd | parser + server re-parse | tasks.create | ✅ | §96 | ✅ | U, I, E | 2 |
| PLN-11 | Drag & drop reorder | lists (Inbox/Someday/All, subtasks) | `Task.sortOrder` fractional, `reorderTask`, bounded rebalance (`domain/ranking.ts`) | edit | long-press / "Move to" | §96 | ✅ | U, I, E | 3 (batch 4) |
| PLN-12 | Drag to reschedule | date groups | updateTask | edit | "Move to" sheet | §96 | ⬜ | — | 3 |
| PLN-13 | Prioritise inline | row menu | updateTask | edit | S | §96 | 🟡 sheet only | — | 3 |
| PLN-14 | Grouping control | FilterBar | query param | — | S | §96 | ⬜ | — | 3 |
| PLN-15 | Sorting control | FilterBar | | — | S | | ⬜ | — | 3 |
| PLN-16 | Filtering (assignee, creator, status, priority, label, due date, overdue, project, completed, delegated, watched — area dropped, see below) | `FilterBar`, URL-persisted | `features/tasks/server/filters.ts` (`parsePlannerFilters`/`plannerFiltersWhere`/`resolveOwnership`) | — (narrows an already-visibility-scoped query) | compact popover + chips | | ✅ | I, E | 3 (batch 4) |
| PLN-17 | Saved filters/views | pills | SavedView | own | P | | 🗄 still unused — batch 4 satisfied "filters survive navigation" via URL state instead, decided with the product owner | — | 3 |
| PLN-18 | Bulk actions | bulk toolbar | `features/tasks/server/bulk.ts`, batched service calls in tx, best-effort/partial | edit/delete per item | compact contextual toolbar | | ✅ | I, E | 3 (batch 4) |
| PLN-19 | Pagination beyond 200 | lists | cursor | — | — | — | 🟡 truncation notice | — | 3 |
| PLN-20 | Delegated/Waiting view | /planner/delegated | owner ∧ assignees ≠ me | rel | P | | ✅ | I | 3 (batch 1) |

## 5. Task engine (§11, §12)

| ID | Feature | Surface | Backend / domain | Perm | Mob | Ref | Impl | Test | Phase |
|---|---|---|---|---|---|---|---|---|---|
| TSK-01 | Title, plain description edit | TaskSheet | version-guarded update | edit | S | §96 | ✅ | I, E | 2 |
| TSK-02 | Rich description (sanitised) | TaskSheet | editor + sanitiser | edit | S | | ⬜ | — | 3 (Q-PO-9) |
| TSK-03 | Status (in progress / blocked / cancelled) UI | TaskSheet | service supports | edit | S | | 🟡 backend only | — | 3 |
| TSK-04 | Priority | TaskSheet, quick add | | edit | S | | ✅ | U, E | 2 |
| TSK-05 | Due date / due time / all-day | TaskSheet, quick add | `normalizeSchedule` | edit | S | | ✅ | U, I, E | 2 |
| TSK-06 | Start date / start time | TaskSheet | columns + CHECK | edit | S | | 🟡 backend only | U | 3 |
| TSK-07 | Assignees / unassign | PeoplePicker | TaskAssignee, `setTaskAssignees` | tasks.assign | S | | ✅ | I | 3 (batch 1) |
| ~~TSK-08~~ | Participants | — | Q-DM-1 resolved: no separate relation — folded into TSK-09 (watchers) | — | — | | n/a | — | — |
| TSK-09 | Followers/watchers | sheet | TaskWatcher, `watchTask`/`unwatchTask` | self + visibility | S | | ✅ | I | 3 (batch 1) |
| TSK-10 | Creator / owner display + owner transfer | sheet | | edit | S | | 🟡 creator shown | — | 3 |
| TSK-11 | Move to project (same space) | TaskSheet | cross-space rejected | edit | S | | ✅ | I | 2 |
| TSK-12 | Board/list (section), area | sheet, Board tab | ProjectSection (`moveTaskToSection`), Area | edit | S | | 🟡 section done, area still 🗄 (no Area UI anywhere) | I | 3 (batch 5) |
| TSK-13 | Labels/tags (task-level) | LabelPicker | Label, `features/labels/*`, `setTaskLabels` | tasks.create (manage: owner/`workspace.manage`) | S | | ✅ | I | 3 (batch 1) |
| TSK-14 | Custom fields on tasks | sheet | CustomField | edit | S | | ⬜ | — | 8 |
| TSK-15 | Subtasks (create/complete/delete) | sheet | parentId, `createSubtask` (one level deep) | edit | S | | 🟡 reorder: `reorderTask` service-ready + integration-tested (batch 4, reuses the same function as top-level lists via `orderingScope`), but **no drag-handle UI in the sheet's subtask list yet** — carry the UI wiring to a later batch | I | 3 (batch 1) |
| TSK-16 | Checklist | sheet | ChecklistItem | edit | S | | ✅ | E | 2 |
| TSK-17 | Dependencies (cycle-safe) | sheet (`DependencyPicker`) | BFS + CHECK, `addDependency`/`removeDependency` | edit | S | | ✅ sheet only, no canvas | U, I | 3 (batch 2) |
| TSK-18 | Blockers display | sheet | `blockedBy`/`blocking` on `TaskDetail`, blocked chip | rel | S | | ✅ | I | 3 (batch 2) |
| TSK-19 | Related tasks | sheet | TaskRelation | edit | S | | ⬜ | — | 3 |
| TSK-20 | Attachments | sheet | FileObject + Attachment | edit | S | | ⬜ | — | 3 (Q-PO-8) |
| TSK-21 | Comments | sheet (`CommentsSection`) | `features/collaboration/*`, one level of replies | rel + author/moderated edit-delete | S | | ✅ | I | 3 (batch 2) |
| TSK-22 | Mentions → notification | inline `@[Name](id)` autocomplete in comment composer | Mention, `MENTIONED` notification | rel (task-visibility-filtered) | S | | ✅ | I | 3 (batch 2) |
| TSK-23 | Reminders | sheet (`ReminderControl`) | `Reminder` model, `features/reminders/*`, Vercel Cron delivery engine | self-service + visibility | S | | ✅ delivery pulled forward from Phase 4 (narrow scheduler, not the generic `Job` table) | I | 3 (batch 3) |
| TSK-24 | Recurrence presets | sheet | RecurrenceSeries | edit | S | | ✅ | U, I, E | 2 |
| TSK-25 | Recurrence custom editor (interval, until, count, weekdays, month days) | RecurrenceEditor | domain supports | edit | S | | 🟡 domain only | U | 3 |
| TSK-26 | After-completion mode | sheet | | edit | S | | ✅ | U | 2 |
| TSK-27 | Recurrence duplication protection | — | unique (series, occurrence) | — | — | — | ✅ | I | 2 |
| TSK-28 | Estimate | sheet | estimateMinutes | edit | S | | 🟡 backend only | — | 3 |
| TSK-29 | Actual tracked time | sheet | TimeEntry sum | rel | S | | ⬜ | — | 4 |
| TSK-30 | Completion info (who / when) | sheet, completed view | completedBy/at | rel | S | | 🟡 stored, not shown | — | 3 |
| TSK-31 | Activity history | sheet | Activity | rel | S | | ✅ | E | 2 |
| TSK-32 | Duplicate | menu | **shared createTask core** | edit | S | | ⬜ | — | 3 |
| TSK-33 | Archive / restore | menu | archivedAt | edit | S | | 🗄 | — | 3 |
| TSK-34 | Soft delete + undo | sheet + banner | deletedAt | delete | ✅ | | ✅ | I | 2 |
| TSK-35 | Optimistic concurrency conflict UI | sheet | version | edit | S | | ✅ | I | 2 |
| TSK-36 | Idempotent create | quick add | clientMutationId | — | — | — | ✅ | I | 2 |
| TSK-37 | Single task-creation service for all sources (§91) | — | `createTask` core + source metadata | — | — | — | ✅ | I (core: scope, idempotency in-tx, labels/assignees, source; Quick Add + recurrence paths) | 2a |
| TSK-38 | Full-page task route | /tasks/[id] | | rel | F | §96 | ⬜ | — | 3 |
| SHR-01 | Direct share of personal task | PeoplePicker | assignee/watcher | own | S | | 🟡 access rule only | I | 3 |
| SHR-02 | Container isolation | — | access rules | — | — | — | ✅ | I | 1 |

## 6. Projects (§13, §44) and portfolio / roadmap / agile / issues (§14–§17)

| ID | Feature | Surface | Backend / domain | Perm | Mob | Ref | Impl | Test | Phase |
|---|---|---|---|---|---|---|---|---|---|
| PRJ-01 | Project list (cards) | /projects | grouped counts | rel | C | V7, M3 | ✅ | E | 2 |
| PRJ-02 | Create (space, colour, privacy) | dialog | tx + LEAD member | projects.create | S | §96 | ✅ | E | 2 |
| PRJ-03 | Detail overview (progress ring, metrics, health) | /projects/[id] | | rel | St | M3 | ✅ | E | 2 |
| PRJ-04 | Status / health edit + audit | controls | audit | projects.edit / LEAD | St | | ✅ | — | 2 |
| PRJ-05 | Archive / restore | controls | archivedAt | edit | St | | ✅ | — | 2 |
| PRJ-06 | Edit name / description / icon / dates / priority / visibility | settings sheet | | edit | S | §96 | ⬜ | — | 3 |
| PRJ-07 | Members management | members sheet | ProjectMember | edit | S | | 🟡 creator only | — | 3 |
| PRJ-08 | Tags, custom fields | sheet | Label / CustomField | edit | S | | ⬜ | — | 3/8 |
| PRJ-09 | Milestones | Milestones tab | Milestone | edit | C | §96 | ✅ | I, E | 3 (batch 5) |
| PRJ-10 | Sections | Board tab | ProjectSection (`sections.ts`) | edit | St | | ✅ | I | 3 (batch 5) |
| PRJ-11 | Tasks tab (list/table) | tab | | rel | C | | 🟡 list only | E | 3 |
| PRJ-12 | Board (kanban) | Board tab | same data (`getBoardData`) | rel | horizontal scroll | D1 columns | ✅ | I, E | 3 (batch 5) |
| PRJ-13 | Timeline / Gantt-like with dependencies | Timeline tab | same data (`getTimelineTasks`) | rel | horizontal scroll (not the agenda-list fallback originally sketched) | D1 connectors | 🟡 read-first (no drag/resize, no dependency connectors — deliberate scope cut, see HANDOFF §2c) | I | 3 (batch 5) |
| PRJ-14 | Project calendar | tab | | rel | agenda | §96 | ⬜ | — | 4 |
| PRJ-15 | Workload view | tab | | reports.view | C | | ⬜ | — | 8 |
| PRJ-16 | Progress view | tab | | rel | St | | ⬜ | — | 8 |
| PRJ-17 | Activity tab | tab | Activity | rel | St | | ⬜ | — | 3 |
| PRJ-18 | Files tab | tab | Attachment | rel | C | | ⬜ | — | 10 |
| PRJ-19 | Docs / notes tab | tab | Document | rel | C | | ⬜ | — | 10 |
| PRJ-20 | Chat tab | tab | Channel PROJECT | rel | F | | ⬜ | — | 7 |
| PRJ-21 | Project comments | overview | Comment | rel | S | | 🗄 | — | 3 |
| PRT-01 | Portfolio CRUD + owner | /portfolio | Portfolio | portfolios.manage | C | §96 | ⬜ | — | 14 |
| PRT-02 | Status / progress / health / deadline / priority roll-up | portfolio | permission-aware aggregates | portfolios.view_all | C | V7 | ⬜ | — | 14 |
| PRT-03 | Portfolio milestones, risks, cross-project report | portfolio | | | C | | ⬜ | — | 14 |
| RMP-01 | Milestones | project, roadmap | Milestone | edit | C | | 🟡 project-level done (batch 5); no cross-project roadmap page yet | I | 3/14 |
| RMP-02 | Roadmap items linked to projects/tasks | /roadmap | RoadmapItem | rel | agenda | D1 | ⬜ | — | 14 |
| RMP-03 | Releases, targets, dependencies, timeline | /roadmap | Release | rel | agenda | | ⬜ | — | 14 |
| AGL-01 | Per-project agile toggle | project settings | flag | edit | — | | ⬜ | — | 14 |
| AGL-02 | Cycles / sprints, start/end, progress | /projects/[id]/cycles | Cycle | edit | C | | ⬜ | — | 14 |
| AGL-03 | Backlog + sprint planning | backlog | Task.cycle_id | edit | C | | ⬜ | — | 14 |
| AGL-04 | Story / task / bug kinds, estimates | sheet | Task.kind | edit | S | | ⬜ | — | 14 |
| ISS-01 | Issue fields (severity, reporter, environment, repro) | issue sheet | on Task (Q-DM-8) | rel | S | | ⬜ | — | 14 |
| ISS-02 | Issue list, history, attachments, comments | /issues | shared infra | rel | C | | ⬜ | — | 14 |

## 7. Calendar, time blocking, time tracking, focus, planning (§18–§21)

| ID | Feature | Surface | Backend / domain | Perm | Mob | Ref | Impl | Test | Phase |
|---|---|---|---|---|---|---|---|---|---|
| CAL-01 | Day view | /calendar/day | | own / rel | ✅ swipe | M1 date card | ⬜ | — | 4 |
| CAL-02 | Week view | /calendar/week | | | desktop | | ⬜ | — | 4 |
| CAL-03 | Month view | /calendar/month | | | desktop | M1 | ⬜ | — | 4 |
| CAL-04 | Agenda view | /calendar/agenda | | | ✅ | | ⬜ | — | 4 |
| CAL-05 | Events CRUD (+ recurring, edit scope) | event sheet | CalendarEvent | own / rel | S | | ⬜ | — | 4 |
| CAL-06 | Tasks and deadlines on calendar | grid | tasks query | rel | ✅ | | ⬜ | — | 4 |
| CAL-07 | Meetings on calendar | grid | Meeting.event | rel | ✅ | | ⬜ | — | 10 |
| CAL-08 | Habits on calendar | grid | Habit schedule | own | ✅ | | ⬜ | — | 5 |
| CAL-09 | Bookings on calendar | grid | Booking | rel | ✅ | | ⬜ | — | 14 |
| CAL-10 | Drag to reschedule | grid | | edit | fields | | ⬜ | — | 4 |
| CAL-11 | Resize blocks/events | grid | | edit | fields | | ⬜ | — | 4 |
| CAL-12 | Quick create on slot | popover | | own | FAB → S | | ⬜ | — | 4 |
| CAL-13 | Filter calendars / types, toggle sources | sidebar | | — | S | | ⬜ | — | 4 |
| CAL-14 | Timezone-correct display (user/workspace/event tz, DST) | all | lib/time | — | — | — | 🟡 lib ready | U | 4 |
| CAL-15 | Team free/busy | grid | | calendar.view_team | — | | ⬜ | — | 4 (Q-PERM-5) |
| TBK-01 | Task → time block (task untouched) | popover | TimeBlock | edit | S | | ⬜ | — | 4 |
| TBK-02 | Manual / focus / meeting / routine blocks | grid | kind enum | own | S | | ⬜ | — | 4 |
| TBK-03 | Recurring blocks | | series | own | S | | ⬜ | — | 4 |
| TBK-04 | Multiple blocks per task | | 1:N | | | | ⬜ | — | 4 |
| TIM-01 | Timer start / pause / resume / stop | TimerPill | TimeEntry | own | pill | §96 | ⬜ | — | 4 |
| TIM-02 | One active timer per user (DB) | — | partial unique | own | — | — | ⬜ | — | 4 |
| TIM-03 | Manual time entry | /time | | own | S | | ⬜ | — | 4 |
| TIM-04 | Estimated vs actual | task sheet | | rel | S | | ⬜ | — | 4 |
| TIM-05 | Daily and project totals | /time | aggregates | own / reports.view | C | | ⬜ | — | 4 |
| FOC-01 | Focus mode (selected task, timer, completion) | /focus | FocusSession | own | F | §96 | ⬜ | — | 4 |
| FOC-02 | Interruption-safe state (reload/resume) | /focus | persisted state | own | F | | ⬜ | — | 4 |
| FOC-03 | Session notes | /focus | | own | F | | ⬜ | — | 4 |
| PLR-01 | Daily plan (references tasks) | /plan/today | DailyPlanItem | own | stepper | §96 | ⬜ | — | 5 |
| PLR-02 | Daily review | /review/today | Review | own | stepper | | ⬜ | — | 5 |
| PLR-03 | Weekly plan | /plan/week | | own | stepper | | ⬜ | — | 5 |
| PLR-04 | Weekly review (+ next-week planning) | /review/week | | own | stepper | | ⬜ | — | 5 |

## 8. Life management (§22–§27)

| ID | Feature | Surface | Backend / domain | Perm | Mob | Ref | Impl | Test | Phase |
|---|---|---|---|---|---|---|---|---|---|
| HAB-01 | Boolean habit | HabitCard | Habit + HabitLog | own | one-tap | §96 (M3 metric style) | ⬜ | — | 5 |
| HAB-02 | Count habit | | Decimal value | own | +/- | | ⬜ | — | 5 |
| HAB-03 | Quantity habit with unit (e.g. water) | | unit + target | own | amount popover | | ⬜ | — | 5 |
| HAB-04 | Duration habit | | seconds | own | | | ⬜ | — | 5 |
| HAB-05 | Numeric habit | | | own | | | ⬜ | — | 5 |
| HAB-06 | Scale habit (mood/energy) | | 1..n | own | | | ⬜ | — | 5 |
| HAB-07 | Schedule: frequency, days, time | sheet | | own | S | | ⬜ | — | 5 |
| HAB-08 | Minimum and ideal targets | sheet | | own | S | | ⬜ | — | 5 |
| HAB-09 | Reminder | sheet | Reminder + jobs | own | S | | ⬜ | — | 5 |
| HAB-10 | Streak rules, best streak, consistency | card + history | domain calc | own | ✅ | | ⬜ | — | 5 |
| HAB-11 | Today / Week / Month views | /habits/* | | own | P | | ⬜ | — | 5 |
| HAB-12 | History and trends | /habits/[id] | | own | St | | ⬜ | — | 5 |
| HAB-13 | Archive / custom habits (no hardcoded catalogue) | | | own | | | ⬜ | — | 5 |
| RTN-01 | Define routine (ordered items → habit/task/checklist/block) | /routines | Routine, RoutineItem | own | St | §96 | ⬜ | — | 5 |
| RTN-02 | Run routine (records preserved) | /routines/[id]/run | RoutineRun | own | F | | ⬜ | — | 5 |
| JRN-01 | Journal entries (rich text, date, tags) | /journal | JournalEntry | own | F | §96 | ⬜ | — | 5 |
| JRN-02 | Links to tasks/projects/goals | entry | JournalLink | own | S | | ⬜ | — | 5 |
| JRN-03 | Searchable history | /journal | SearchDocument | own | — | | ⬜ | — | 6 |
| CHK-01 | Check-in templates (structured questions) | /check-ins | CheckInTemplate | checkins.manage | S | §96 | ⬜ | — | 5 |
| CHK-02 | Recurring prompts | jobs | | — | — | | ⬜ | — | 5 |
| CHK-03 | Responses (status, blockers, achievements, next actions) | respond | CheckInResponse | rel | F | | ⬜ | — | 5 |
| CHK-04 | Team async status and project check-ins | /check-ins/[id] | | rel | C | | ⬜ | — | 5 |
| GOL-01 | Personal / team / workspace goals | /goals | Goal scope | own / goals.create | C | §96 | ⬜ | — | 5 |
| GOL-02 | Goal fields (owner, timeframe, target, unit, status) | sheet | | rel | S | | ⬜ | — | 5 |
| GOL-03 | Key results | detail | KeyResult | rel | C | | ⬜ | — | 5 |
| GOL-04 | Manual progress | check-in dialog | MANUAL | rel | S | | ⬜ | — | 5 |
| GOL-05 | Calculated progress (never mixed) | detail | CALCULATED | rel | — | | ⬜ | — | 5 |
| GOL-06 | Links to goals/projects/tasks, milestones | detail | GoalLink | rel | S | | ⬜ | — | 5 |
| FIN-01 | Income / expense / transfer entries | entry sheet | FinanceEntry Decimal | own / finance.manage | quick FAB | §96 | ⬜ | — | 11 |
| FIN-02 | Categories, account/wallet labels, tags | settings | | | C | | ⬜ | — | 11 |
| FIN-03 | Currency handling | | per-currency totals (Q-DM-7) | | | | ⬜ | — | 11 |
| FIN-04 | Receipts | entry | Attachment | | S | | ⬜ | — | 11 |
| FIN-05 | Recurring entries (idempotent) | | series + unique | | | | ⬜ | — | 11 |
| FIN-06 | Budgets and category budgets | /finance/budgets | Budget | | C | | ⬜ | — | 11 |
| FIN-07 | Monthly summary, breakdown, income vs expense | /finance | aggregates | finance.view | St | V7 rings | ⬜ | — | 11 |
| FIN-08 | Company finance permission isolation | — | finance.* | finance.view | — | — | 🟡 capabilities defined | U | 11 |
| SUB-01 | Subscription record (all §27 fields) | sheet | Subscription | own / finance.manage | S | §96 | ⬜ | — | 11 |
| SUB-02 | Next charge + reminder | | jobs | | | | ⬜ | — | 11 |
| SUB-03 | Active / cancelled | | | | | | ⬜ | — | 11 |
| SUB-04 | Feeds finance reporting | | generated entries | | | | ⬜ | — | 11 |

## 9. Company operations (§28–§31, §52–§56)

| ID | Feature | Surface | Backend / domain | Perm | Mob | Ref | Impl | Test | Phase |
|---|---|---|---|---|---|---|---|---|---|
| MTG-01 | Create meeting (title, time, participants, project) | dialog | Meeting + CalendarEvent | meetings.create | S | §96 | ⬜ | — | 10 |
| MTG-02 | Agenda | tab | rich | rel | P tabs | | ⬜ | — | 10 |
| MTG-03 | Discussion | tab | chat thread | rel | | | ⬜ | — | 10 |
| MTG-04 | Notes | tab | rich, versioned | rel | F | | ⬜ | — | 10 |
| MTG-05 | Files | tab | Attachment | rel | C | | ⬜ | — | 10 |
| MTG-06 | Decisions (stored separately) | tab | Decision | rel | C | | ⬜ | — | 10 |
| MTG-07 | Action items → real tasks | tab | shared createTask | tasks.create | S | | ⬜ | — | 10 |
| MTG-08 | Follow-ups | tab | task / meeting link | rel | | | ⬜ | — | 10 |
| MTG-09 | Join call | header | provider | rel | ✅ | | ⬜ | — | 7/10 (Q-PO-14) |
| BKG-01 | Create booking (resource, user, start/end, notes) | dialog | Booking | bookings.create | S | §96 | ⬜ | — | 14 |
| BKG-02 | Conflict validation (exclusive, DB constraint) | — | EXCLUDE gist | — | — | — | ⬜ | — | 14 |
| BKG-03 | Booking status | list | | rel | C | | ⬜ | — | 14 |
| RES-01 | Resource directory (people/teams/rooms/equipment) | /resources | Resource | resources.manage | C | | ⬜ | — | 14 |
| RES-02 | Capacity and availability | detail | ResourceAvailability | | | | ⬜ | — | 14 |
| RES-03 | Assignments, related projects, workload | detail | | | | | ⬜ | — | 14 |
| AST-01 | Asset record (category, id, status, owner, dates, notes) | /assets | Asset | assets.manage | C | §96 | ⬜ | — | 14 |
| AST-02 | Assign with retained history | dialog | AssetAssignment | assets.manage | S | | ⬜ | — | 14 |
| AST-03 | Asset attachments and history | detail | | assets.view | St | | ⬜ | — | 14 |
| WLD-01 | Workload: count vs estimated vs scheduled vs tracked | /workload | aggregates | workload.view | C | V7 | ⬜ | — | 8 |
| WLD-02 | Capacity / availability input | | WorkingHours | | | | ⬜ | — | 8 |
| RSK-01 | Risks (probability, impact, owner, mitigation, status, date) | /projects/[id]/risks | Risk | rel | C | §96 | ⬜ | — | 14 |
| DEC-01 | Decisions (context, owner, date, project/meeting), searchable | /decisions | Decision | rel | C | | ⬜ | — | 10 |
| DIR-01 | Directory (role, team, tz, presence, current projects) | /directory | permission-aware | members.view | C | §96 | 🟡 /team basic | E | 14 |
| CRM-01 | Contacts, companies | /crm/* | Crm* | crm.view | C | §96 | ⬜ | — | 14 |
| CRM-02 | Leads, deals, pipelines, stages | pipeline kanban | | crm.manage | horizontal | D1 columns | ⬜ | — | 14 |
| CRM-03 | CRM activity linked to tasks/meetings/notes/files | detail | shared infra | | | | ⬜ | — | 14 |
| CRM-04 | Module isolation (no planner contamination) | — | separate tables | — | — | — | ⬜ | — | 14 |
| ASY-01 | Status / project updates | /check-ins, project | StatusUpdate | rel | C | | ⬜ | — | 7 |
| ASY-02 | Announcements | channel / home | Announcement | chat.manage | C | | ⬜ | — | 7 |
| ASY-03 | Structured questions, blockers, action items | check-ins | shared with CHK | rel | | | ⬜ | — | 5/7 |

## 10. Knowledge, capture, files, proofing (§32–§34, §39, §40, §67, §68)

| ID | Feature | Surface | Backend / domain | Perm | Mob | Ref | Impl | Test | Phase |
|---|---|---|---|---|---|---|---|---|---|
| DOC-01 | Documents / wiki pages | /docs | Document | docs.* / rel | F | §96 | ⬜ | — | 10 |
| DOC-02 | Nested hierarchy | tree drawer | parent_id | rel | drawer | | ⬜ | — | 10 |
| DOC-03 | Rich text + sanitisation | editor | Q-PO-9 | rel | F | | ⬜ | — | 10 |
| DOC-04 | Attachments, tags, links | editor | shared | rel | | | ⬜ | — | 10 |
| DOC-05 | Backlinks / relations | panel | DocumentLink | rel | S | | ⬜ | — | 10 |
| DOC-06 | Project / workspace association | settings | | rel | | | ⬜ | — | 10 |
| DOC-07 | Page permissions / sharing | share sheet | | rel | S | | ⬜ | — | 10 |
| DOC-08 | Live embeds (task/project/goal/board/item), per-embed permissions | editor | LiveEmbed | rel per entity | | | ⬜ | — | 10 |
| DOC-09 | Live vs copied distinction in UI | editor | | — | | | ⬜ | — | 10 |
| CAP-01 | Quick capture overlay | global | CaptureItem (Q-DM-4) | own | F | §96 | 🟡 quick add only | E | 6 |
| CAP-02 | Web clipper | endpoint | token auth | own | — | | ⬜ | — | 6 |
| CAP-03 | URL / image / document capture | capture | FileObject | own | S | | ⬜ | — | 6 |
| CAP-04 | Email-in | address | inbound provider | own | — | | ⬜ | — | 6 |
| CAP-05 | Chat message capture | chat menu | MessageLink | rel | S | | ⬜ | — | 7 |
| CAP-06 | Convert → task / note / doc / inbox item (no multi-create) | dialog | shared services | per target | S | | ⬜ | — | 6 |
| CAP-07 | Source reference retained (§68) | — | TaskSource (Q-DM-6) | — | — | — | ⬜ | — | 6 |
| CAP-08 | OCR / extraction with correction before commit | review sheet | AiJob | ai.use | S | | ⬜ | — | 13 |
| FIL-01 | Metadata separate from storage | — | FileObject + provider adapter | — | — | — | ⬜ | — | 3 (Q-PO-8) |
| FIL-02 | Size / type / permission validation | upload | | parent | — | | ⬜ | — | 3 |
| FIL-03 | Attach to tasks/projects/messages/meetings/docs/requests/users | Attachment FKs | CHECK | parent | C | | ⬜ | — | 3→10 |
| FIL-04 | Access follows parent | download route | | parent | — | | ⬜ | — | 3 |
| PRF-01 | Review state and reviewer | review panel | ReviewRequest | rel | S | §96 | ⬜ | — | 10 |
| PRF-02 | Review comments | | ReviewComment | rel | | | ⬜ | — | 10 |
| PRF-03 | Approve / reject (via Approvals) | | shared engine | rel | | | ⬜ | — | 10 |
| PRF-04 | Versions | | FileVersion | rel | | | ⬜ | — | 10 |

## 11. Forms, requests, SLA, approvals (§35–§38)

| ID | Feature | Surface | Backend / domain | Perm | Mob | Ref | Impl | Test | Phase |
|---|---|---|---|---|---|---|---|---|---|
| FRM-01 | Builder: text / long text / number / date / checkbox | /forms/[id]/edit | Form schema | forms.manage | desktop-first | §96 | ⬜ | — | 9 |
| FRM-02 | Builder: select / multi-select / file / people | | | forms.manage | | | ⬜ | — | 9 |
| FRM-03 | Target → task / board item / request / other | mapping | shared services | forms.manage | | | ⬜ | — | 9 |
| FRM-04 | Submissions history, status, linked result | /submissions | FormSubmission | forms.manage | C | | ⬜ | — | 9 |
| FRM-05 | Anonymous / known submitter | public form | | public token | ✅ | | ⬜ | — | 9 |
| FRM-06 | Public form (rate-limited) | /f/[slug] | | forms.publish_public | ✅ | | ⬜ | — | 9 |
| REQ-01 | Configurable request types | settings | RequestType | request_types.manage | C | §96 | ⬜ | — | 9 |
| REQ-02 | Request fields (requester, assignee/team, priority, status, due) | /requests/[id] | Request | rel / requests.* | S | | ⬜ | — | 9 |
| REQ-03 | Queue (mine / assigned / team) | /requests | | rel | C | | ⬜ | — | 9 |
| REQ-04 | From forms | | FRM-03 | | | | ⬜ | — | 9 |
| REQ-05 | Comments, files, activity | detail | shared | rel | | | ⬜ | — | 9 |
| REQ-06 | Approval when required | detail | APR | | | | ⬜ | — | 9 |
| SLA-01 | Target response / resolution | type settings | SlaPolicy | sla.manage | | | ⬜ | — | 9 |
| SLA-02 | Due calculation (business calendar) | — | deterministic domain | — | — | — | ⬜ | — | 9 |
| SLA-03 | Paused states | — | SlaClock | — | — | — | ⬜ | — | 9 |
| SLA-04 | Breach detection + notification | jobs | | — | — | — | ⬜ | — | 9 |
| SLA-05 | SLA reporting | /reports/requests | | reports.view | C | | ⬜ | — | 9 |
| APR-01 | Generic approval engine (sources: request/task/doc/expense/workflow) | ApprovalPanel | ApprovalRequest | rel | S | §96 | ⬜ | — | 9 |
| APR-02 | States Pending / Approved / Rejected / Cancelled | | | | | | ⬜ | — | 9 |
| APR-03 | Records approver, time, comment, source | | ApprovalStep | | | | ⬜ | — | 9 |
| APR-04 | Append-only history | | | | | | ⬜ | — | 9 |
| APR-05 | /approvals inbox | /approvals | | rel | explicit buttons | | ⬜ | — | 9 |

## 12. Collaboration, chat, attention, notifications, search, command (§41–§49)

| ID | Feature | Surface | Backend / domain | Perm | Mob | Ref | Impl | Test | Phase |
|---|---|---|---|---|---|---|---|---|---|
| COL-01 | Comments + replies (shared component) | `CommentsSection` | Comment (single-parent CHECK) | parent | S | §96 | 🟡 task-only so far (`features/collaboration/*`); project parent type unused until a second caller needs it | I | 3 (batch 2) |
| COL-02 | Edited / deleted state and history policy | sheet | editedAt / deletedAt (soft delete, body retained) | author (delete: author or moderator) | | | ✅ | I | 3 (batch 2) |
| COL-03 | Mentions → notification | inline mention autocomplete | Mention | parent (visibility-filtered) | | | ✅ | I | 3 (batch 2) |
| COL-04 | Reactions | ReactionBar | Reaction | parent | | | ⬜ | — | 3/7 |
| COL-05 | Followers / watchers | sheet | TaskWatcher (task-only; generic polymorphic followers deferred until a second parent type needs it) | self + visibility | | | ✅ | I | 3 (batch 1) |
| COL-06 | Presence / status | avatars | real-time | members.view | | | ⬜ | — | 7 |
| CHT-01 | Public channels | /chat | Channel PUBLIC | chat.create_public | list → push | §96 | ⬜ | — | 7 |
| CHT-02 | Private channels | | PRIVATE + members | chat.create_private / rel | | | ⬜ | — | 7 |
| CHT-03 | Direct messages | | DM | chat.dm | | | ⬜ | — | 7 |
| CHT-04 | Group DMs | | GROUP_DM | chat.dm | | | ⬜ | — | 7 |
| CHT-05 | Project channels | project tab | PROJECT ↔ project members | rel | F | | ⬜ | — | 7 |
| CHT-06 | Send / edit / delete (policy) | composer, menu | Message version | author / chat.manage | composer above keyboard | | ⬜ | — | 7 |
| CHT-07 | Replies and threads | thread panel | thread_root_id | rel | S | | ⬜ | — | 7 |
| CHT-08 | Reactions | | Reaction | rel | long-press | | ⬜ | — | 7 |
| CHT-09 | Mentions → notification | | Mention | rel | | | ⬜ | — | 7 |
| CHT-10 | Unread / read state | list badges | last_read_message_id | rel | | | ⬜ | — | 7 |
| CHT-11 | Pinned messages | drawer | MessagePin | rel | S | | ⬜ | — | 7 |
| CHT-12 | Saved / bookmarked messages | /chat/saved | SavedMessage | own | | | ⬜ | — | 7 |
| CHT-13 | Attachments | composer | Attachment | rel | | | ⬜ | — | 7 |
| CHT-14 | Links (safe URL handling, previews) | message | URL sanitiser | — | | | ⬜ | — | 7 |
| CHT-15 | Typing state | composer | real-time | rel | | | ⬜ | — | 7 |
| CHT-16 | Presence / online | avatars | real-time | members.view | | | ⬜ | — | 7 |
| CHT-17 | Message search | search | SearchDocument | rel | F | | ⬜ | — | 7 |
| CHT-18 | Guest / external permissions | — | channel membership | L4 | — | — | ⬜ | — | 7 |
| CHT-19 | Federation-ready identifiers | — | design only | — | — | — | ⬜ | — | 7 |
| CHT-20 | Mobile chat behaviour | — | — | — | push nav + sheet thread | | ⬜ | — | 7 |
| CHT-21 | Channel archive / moderation | settings | | chat.manage | S | | ⬜ | — | 7 |
| C2W-01 | Message → task (by reference) | message menu | shared createTask + MessageLink | tasks.create | S | | ⬜ | — | 7 |
| C2W-02 | Message → follow-up | | | | | | ⬜ | — | 7 |
| C2W-03 | Message → note | | | | | | ⬜ | — | 7 |
| C2W-04 | Reference in document | | LiveEmbed | | | | ⬜ | — | 10 |
| C2W-05 | Attach to project | | | | | | ⬜ | — | 7 |
| C2W-06 | Meeting-related action | | | | | | ⬜ | — | 10 |
| CLL-01 | 1:1 voice/video | provider | CallSession | rel | ✅ | | ⬜ | — | 7 (Q-PO-14) |
| CLL-02 | Group calls | | | | | | ⬜ | — | 7 |
| CLL-03 | Screen sharing | | | | desktop | | ⬜ | — | 7 |
| ATT-01 | Attention list (action-required) separate from activity | /attention | derived (Q-DM-3) | own | swipe done | §96 | ⬜ | — | 6 (Q-PO-6) |
| ATT-02 | Sources: mentions, replies, assignments, comments, approvals, meetings, deadlines, overdue, invitations, workflow events | | notification + derived | own | | | 🟡 most task/collab sources notify (batches 1–3); approvals/meetings/workflow events ⬜ (not built); the dedicated /attention list itself ⬜ | — | 6 |
| NOT-01 | Notification generation service (dedupe) | — | `notify()`/`notifyMany()`, `Notification.dedupe_key`, wired from invites, role changes, assignment, mentions, comments, status/due-date changes, dependency-unblocked, reminders | — | — | — | ✅ | I | 2b / 3 (batch 3 events) |
| NOT-02 | Read / unread, type, source, entity ref, actor, deep link | bell popover (`NotificationBell`) | `features/notifications/*` | own | F | | ✅ pulled forward from Phase 6 (preferences UI, email channel, search/command palette still Phase 6) | I | 3 (batch 3) |
| NOT-03 | Inline action buttons | item | | own | | | ⬜ | — | 6 |
| NOT-04 | Preferences per category × channel | settings | NotificationPreference | own | | | 🗄 | — | 6 |
| NOT-05 | Email channel | — | provider + jobs | own | — | | ⬜ | — | 6 |
| SRC-01 | Search tasks / projects / items / messages / docs / file metadata / people / goals / meetings / requests | ⌘K, /search | SearchDocument | per-entity ACL | F | §96 | ⬜ | — | 6 (+ each module indexes itself) |
| SRC-02 | No cross-tenant leakage | — | ACL in query | — | — | — | ⬜ | — | 6 |
| SRC-03 | Type filters, recents, navigation | | RecentItem | own | | | ⬜ | — | 6 |
| CMD-01 | Command palette (create task/project/note/meeting, start timer, open calendar/project/chat, search person) via services | ⌘K | existing services | per action | F | §96 | ⬜ | — | 6 |
| HUB-01 | Project communication hub (chat / files / docs inside project) | project tabs | | rel | P tabs | | ⬜ | — | 7/10 |

## 13. Dashboards, reports, home (§50, §51, §79)

| ID | Feature | Surface | Backend / domain | Perm | Mob | Ref | Impl | Test | Phase |
|---|---|---|---|---|---|---|---|---|---|
| DSH-01 | Personal and company dashboards | /dashboards | Dashboard config | own / dashboards.create_workspace | St | V7, D1 | ⬜ | — | 8 |
| DSH-02 | Multi-source (projects, boards, goals, habits, tasks, finance, requests) | widgets | per-widget permission | viewer | | | ⬜ | — | 8 |
| DSH-03 | Widgets: KPI, progress, chart, calendar, workload, table, activity, goal, task, habit, custom | Widget | | viewer | St | | ⬜ | — | 8 |
| DSH-04 | Drag / rearrange, layout stored as config | edit mode | layout JSON | owner | read-only | | ⬜ | — | 8 |
| RPT-01 | Reports: tasks / projects / workload / time / goals / habits / requests / finance / activity | /reports/[kind] | reproducible queries | reports.view (+ finance.view) | St | | ⬜ | — | 8 |
| RPT-02 | Filters: date range, project, team, user, status, priority, category | FilterBar | | | S | | ⬜ | — | 8 |
| HOM-01 | Personal home: today, next up, counts, projects | /home | | own | St | M1, M3 | ✅ | E | 2 |
| HOM-02 | Personal home: upcoming, habits, calendar, goals, focus, activity, metrics | /home | | own | St | | ⬜ | — | 4–6 |
| HOM-03 | Company home: assigned work, projects, team, deadlines, mentions, meetings, approvals, workload | /home | | rel | St | | 🟡 work + projects | E | 6–9 |

## 14. Flexible work management (§9)

| ID | Feature | Surface | Backend / domain | Perm | Mob | Ref | Impl | Test | Phase |
|---|---|---|---|---|---|---|---|---|---|
| BRD-01 | Custom boards | /boards | Board | boards.create | C | §96 | ⬜ | — | 8 |
| BRD-02 | Custom item types | | ItemType | boards.manage_fields | | | ⬜ | — | 8 |
| BRD-03 | Subitems | | parent_item_id | rel | | | ⬜ | — | 8 |
| BRD-04 | Field types: text, long text, number, URL, email, phone, checkbox | FieldEditor | CustomFieldValue | boards.manage_fields | S | | ⬜ | — | 8 |
| BRD-05 | Field types: status, priority, select, multi-select, tags, progress | | | | | | ⬜ | — | 8 |
| BRD-06 | Field types: people, date, date range, time | | | | | | ⬜ | — | 8 |
| BRD-07 | File field | | Attachment | | | | ⬜ | — | 8 |
| BRD-08 | Relation (within and across boards) | picker | Relation | rel both sides | | | ⬜ | — | 8 |
| BRD-09 | Mirror (derived, never stale) | | read-time | rel source | | | ⬜ | — | 8 |
| BRD-10 | Formula (safe AST interpreter, no code exec) | formula builder | sandbox | | | | ⬜ | — | 8 |
| BRD-11 | Board views: table / kanban / calendar / timeline on one data set | /boards/[id] | | rel | C | D1 | ⬜ | — | 8 |

## 15. Automation, workflows, playbooks, templates, AI, integrations (§57–§66)

| ID | Feature | Surface | Backend / domain | Perm | Mob | Ref | Impl | Test | Phase |
|---|---|---|---|---|---|---|---|---|---|
| AUT-01 | Triggers: task created/updated/status, due reached/approaching, item created, form submitted, request created, approval changed, habit event, schedule, project change | builder | event bus + jobs | automations.manage | read-only | D1 journey | ⬜ | — | 12 |
| AUT-02 | Typed conditions (no code) | | condition AST | | | | ⬜ | — | 12 |
| AUT-03 | Actions: update field, assign, move, create task/item, notify, create approval, post message, follow-up, external action | | shared services | author principal | | | ⬜ | — | 12 |
| AUT-04 | Idempotent runs (dedupe key) | — | AutomationRun unique | — | — | — | ⬜ | — | 12 |
| AUT-05 | Loop prevention (depth / causality) | — | | — | — | — | ⬜ | — | 12 |
| AUT-06 | Execution logs | /runs | AutomationRunStep | automations.manage | C | | ⬜ | — | 12 |
| WFB-01 | Visual builder: trigger / condition-branch / action nodes | /automations/[id] | Workflow graph | automations.manage | read-only | D1 | ⬜ | — | 12 |
| WFB-02 | Human approval node | | APR | | | | ⬜ | — | 12 |
| WFB-03 | Safe delays / waits | | jobs | | | | ⬜ | — | 12 |
| WFB-04 | Failed-run status, retry strategy | | | | | | ⬜ | — | 12 |
| WFB-05 | Enable / disable, run history | | | | | | ⬜ | — | 12 |
| PBK-01 | Playbook definitions (tasks, stages, checklists, approvals, assignments, meetings, docs) | /playbooks | Playbook | templates.publish_workspace | C | D1 stages | ⬜ | — | 12 |
| PBK-02 | Traceable playbook runs | | PlaybookRun | rel | | | ⬜ | — | 12 |
| TPL-01 | Templates: task, project, board, document, form, routine, dashboard, playbook | /templates | Template | per kind | C | §96 | ⬜ | — | 12 |
| AI-01 | Summarization (meeting, project, chat, document) | inline | AiJob + provenance | ai.use | S | §96 | ⬜ | — | 13 |
| AI-02 | Task and action-item extraction | review sheet | | ai.use | S | | ⬜ | — | 13 |
| AI-03 | Categorization, labels, field extraction, sentiment | | | ai.use | | | ⬜ | — | 13 |
| AI-04 | Translation, writing assistance, generation | editor | | ai.use | | | ⬜ | — | 13 |
| AI-05 | Suggested priorities, plan, schedule | planner | | ai.use | | | ⬜ | — | 13 |
| AI-06 | AI fields as jobs (never per render) | boards | AiFieldValue | ai.use | | | ⬜ | — | 13 |
| AI-07 | AI workflow nodes (extract, classify, summarize, draft, suggest) + human approval | builder | | automations.manage | | | ⬜ | — | 13 |
| AI-08 | Scoped agents (tools, context, boundaries, history, approvals) | /ai/agents | Agent, AgentRun | ai.agents.manage | C | | ⬜ | — | 13 |
| AI-09 | Reviewable AI changes + provenance | AiReviewSheet | AiResult.applied_by | — | S | | ⬜ | — | 13 |
| INT-01 | Integration layer (validate, log, retry, dedupe) | — | IntegrationConnection, ExternalActionRun | integrations.manage | — | — | ⬜ | — | 12 |
| INT-02 | MCP-like external tool actions | — | | | | | ⬜ | — | 12/13 |
| INT-03 | Webhooks (dedupe) | — | WebhookDelivery | | | | ⬜ | — | 12 |

## 16. Platform qualities, design, process (§69–§77, §80–§91)

| ID | Feature | Backend / approach | Impl | Test | Phase |
|---|---|---|---|---|---|
| OFF-01 | Installable PWA + cached shell | manifest + SW | ⬜ | — | 15 |
| OFF-02 | Read cached data | SW cache | ⬜ | — | 15 |
| OFF-03 | Offline capture + mutation queue | ClientMutation | ⬜ | — | 15 |
| OFF-04 | Conflict resolution UI (never overwrite newer) | version on entities | 🟡 tasks have version + conflict | I | 15 |
| OFF-05 | "Synced" only after server confirmation | SyncStatus | ⬜ | — | 15 |
| MOB-01 | Purposeful mobile shell (tab bar, FAB, bottom sheets) | shell | ✅ | E | 1 |
| MOB-02 | Tables → cards | DataTable/RecordCards | 🟡 no tables yet | — | 3 |
| DSN-01 | Semantic tokens (light / dark) | globals.css | ✅ | E | 1 |
| DSN-02 | Typography hierarchy (Lufga stand-in) | DESIGN_SYSTEM §3 | ✅ | E | 1 |
| DSN-03 | Radii / pills / circular controls / nested surfaces | primitives | ✅ | E | 1 |
| DSN-04 | Workflow visuals for real relationships | WorkflowCanvas | ⬜ | — | 3 |
| DSN-05 | Icon rail + tooltips + grouping | Rail | 🟡 grouping pending more modules | E | 1/6 |
| DSN-06 | Calm top bar (context, search, command, attention, notifications, quick add, avatar) | AppShell | 🟡 search / attention / command palette missing (notifications ✅ batch 3) | E | 6 |
| DSN-07 | Motion per video choreography + reduced motion | globals.css | ✅ | — | 1 |
| DSN-08 | Visual regression loop (§88) | `e2e/visual.spec.ts`, 22 baselines | ✅ | E (visual) | 2a |
| DSN-09 | Unseen-page composition rule (§96) | DESIGN_SYSTEM §10 | ✅ documented | — | all |
| DSN-10 | Standard people pattern (`PeopleCluster`: overlap/spaced/strip, photo or pastel initials, real count badges, +N) | DESIGN_SYSTEM §13; adopted on every built people surface | ✅ | U (people helpers), E (en/fa, desktop/mobile, dark) | 2 + every phase |
| DSN-10c | Real assignee totals for "+N" in task rows/sheet/Next-up (preview of 4 + `assigneeCount`; stable order) | queries.ts | ✅ (bug found by E2E, fixed) | E | 2a |
| DSN-10b | Task-allocation badges on project cards (open assigned tasks per member) | grouped SQL in `listProjects` | ✅ | E | 2 |
| STA-01 | Loading / empty / error / not-found on built pages | (app) files | ✅ | E | 1 |
| STA-02 | Archived / permission / partial-data components | ArchivedBanner etc. | 🟡 inline only | — | 3 |
| A11Y-01 | Icon-button names, skip link, focus, dialog semantics, reduced motion | primitives | ✅ | E (partial) | 1 |
| A11Y-02 | Keyboard menus (arrow keys) | Menu | ⬜ | — | 3 |
| A11Y-03 | Full audit (contrast, screen reader) | — | ⬜ | — | 15 |
| PERF-01 | No N+1 on lists | grouped counts | ✅ | — | 1 |
| PERF-02 | Cursor pagination, virtualization, lazy modules | — | ⬜ | — | 3+ |
| SEC-01 | Authn / authz / tenant isolation / IDOR | access + DAL | ✅ | I | 1 |
| SEC-02 | Input validation, mass assignment | Zod pick lists | ✅ | — | 1 |
| SEC-03 | Rich-text sanitisation, URL safety | — | ⬜ | — | 3/7 |
| SEC-04 | Upload validation | — | ⬜ | — | 3 |
| SEC-05 | Rate limiting (auth, public forms) | — | ⬜ | — | 2b/9 |
| SEC-06 | No sensitive data in logs | messages only | ✅ | — | 1 |
| AUD-01 | Role change, project status audited | AuditEvent | ✅ | — | 1 |
| AUD-02 | Member removal, reassignment, approvals, request status, finance change, automation execution | AuditEvent | ⬜ | — | 2b–12 |
| MIG-01 | Migration policy (create-only + hand SQL + review; expand/contract) | DATA_MODEL §8 | ✅ | — | all |
| QAP-01 | Risk-based tests (§86) | QA §2 | 🟡 see QA | U, I | all |
| QAP-02 | E2E high-value flows in repo (§87) | Playwright `e2e/*.spec.ts` (16 flows) | ✅ for executable flows | E (in repo) | 2a |
| QAP-03 | Definition of Done enforced (§89) | ACCEPTANCE | ✅ documented | — | all |
| QAP-04 | Regression rule (§90) | COMPONENT_INVENTORY used-by | ✅ documented | — | all |
| QAP-05 | Shared domain services (§91) | ARCHITECTURE §Shared services; all actions → services via `runAction` | ✅ | I | 2a |
| QAP-06 | Phase workflow and gate (§93, §100) | PHASE_PLAN §3–4 | ✅ documented | — | all |

---

## 16b. Internationalization (I18N, cross-cutting)

| ID | Feature | Backend / approach | Impl | Test | Phase |
|---|---|---|---|---|---|
| I18N-01 | en + fa locales, registry, no-migration growth | `i18n/config.ts`, `User.locale` text | ✅ | U | 2i |
| I18N-02 | Clean URLs (no `[locale]`) | next-intl request config | ✅ | E | 2i |
| I18N-03 | Resolution user → cookie → Accept-Language → en; unsupported ignored | `i18n/resolve.ts` | ✅ | U, E | 2i |
| I18N-04 | Persisted preference; in-place switch keeps route, workspace, session | account + cookie, `router.refresh()` | ✅ | E | 2i |
| I18N-05 | Namespaced catalogs, semantic keys, ICU plurals/select/rich | 10 namespaces × 2 locales | ✅ | U (parity, ICU, args, tags) | 2i |
| I18N-06 | No hardcoded UI copy on built screens | audit + typed keys | ✅ | U (typed), E | 2i |
| I18N-07 | Language-neutral domain (error codes) | DomainError / ScheduleError / RecurrenceError codes | ✅ | U (code coverage scan), I | 2i |
| I18N-08 | RTL document direction + logical CSS + icon mirroring | layout `dir`, logical utilities | ✅ | E (desktop + mobile, light + dark) | 2i |
| I18N-09 | Persian typography (Vazirmatn), no tracking, mixed-script stacks | layout font stack | ✅ | E | 2i |
| I18N-10 | Locale ≠ timezone; Gregorian display | `lib/format.ts` | ✅ | U | 2i |
| I18N-11 | Intl numbers, percent, dates, times, relative day | `lib/format.ts`, `useFormat` | ✅ | U, E | 2i |
| I18N-11b | Currency and duration formatting helpers | Intl NumberFormat currency / unit | ⬜ (first used in Phases 4 and 11) | — | 4/11 |
| I18N-12 | Quick Add English-only, documented; Persian titles untouched | parser + UI note | ✅ | U | 2i |
| I18N-12b | Persian keyword grammar | locale parser dispatcher | ⬜ | — | decision Q-I18N-2 |
| I18N-13 | Unicode-safe storage (ZWNJ round-trip) | Postgres UTF-8 | ✅ | I | 2i |
| I18N-13b | Unicode-safe search normalisation | search index config | ⬜ | — | 6 |
| I18N-14 | Persian design parity | visual loop both directions | ✅ (built screens) | E | 2i + every phase |
| I18N-15 | Localized auth validation and errors | `fieldErrorsOf`, `localizeError` | ✅ | E | 2i |
| I18N-16 | Localized page titles (metadata) | `generateMetadata` + catalogs | ✅ | — | 2i |
| I18N-17 | Localized timezone / IANA names in pickers | Intl.DisplayNames (not available for zones) | ⬜ shown as IANA ids (LTR) | — | decision Q-I18N-4 |
| I18N-18 | Localized emails / notifications | catalogs per recipient locale | ⬜ | — | 2b/6 |

## 17. Reconciliation notes (gaps found during the §86–§100 integration)

| # | Finding | Severity | Action |
|---|---|---|---|
| R1 | ~~Task rows created in two code paths~~ | — | ✅ Resolved in Phase 2a (`createTask` core) |
| R2 | ~~Business logic inline in project/workspace actions~~ (auth and account too) | — | ✅ Resolved in Phase 2a (services + `runAction`) |
| R3 | ~~E2E outside the repo~~ | — | ✅ Resolved in Phase 2a (`e2e/`, Playwright Test) |
| R4 | No notification generation exists although schema is ready; §86 requires tests for it | Expected (planned 2b) | 2b |
| R5 | shadcn/ui listed in the §3 stack but not used | Low | Q-PO-10 |
| R6 | Planner "Inbox" (§10) vs Attention "Inbox" (§46) naming collision | Low | Q-PO-6 |
| R7 | §87 flow 1 requires onboarding, which the spec doesn't define | Product gap | Q-PO-3 |

No finding is a critical production defect; no code was changed in this pass.

---

## 18. Spec traceability (every § has a destination)

| § | Topic | Destination |
|---|---|---|
| 0 | Source-of-truth priority | PRODUCT_SPEC A; DESIGN_SYSTEM §1 |
| 1 | Inspect repo + video, frame extraction | Phase 0 done (frames provided); ffmpeg gap Q-PO-11 |
| 2 | Permanent docs | docs/* (QAP-03…06) |
| 3 | Stack | ARCHITECTURE; R5 |
| 4 | Engineering rules | ARCHITECTURE; SEC-*, MIG-01, TSK-35/36 |
| 5 | Personal + workspace | WS-01…03 |
| 6 | Identity | IDN-01…14 |
| 7 | Workspaces / roles / capabilities | WS-04…19, PRM-01…08 |
| 8 | Universal object model | DATA_MODEL §2–§6 |
| 9 | Flexible work management | BRD-01…11 |
| 10 | Planner | PLN-01…20 |
| 11 | Task engine | TSK-01…38 |
| 12 | Sharing | SHR-01…02, TSK-07…09 |
| 13 | Projects | PRJ-01…21 |
| 14 | Portfolios | PRT-01…03 |
| 15 | Roadmaps / milestones / releases | RMP-01…03 |
| 16 | Agile | AGL-01…04 |
| 17 | Issues | ISS-01…02 |
| 18 | Calendar | CAL-01…15 |
| 19 | Time blocking | TBK-01…04 |
| 20 | Time tracking / focus | TIM-01…05, FOC-01…03 |
| 21 | Daily / weekly planning | PLR-01…04 |
| 22 | Habits | HAB-01…13 |
| 23 | Routines | RTN-01…02 |
| 24 | Journal / check-ins | JRN-01…03, CHK-01…04 |
| 25 | Goals | GOL-01…06 |
| 26 | Finance | FIN-01…08 |
| 27 | Subscriptions | SUB-01…04 |
| 28 | Meetings | MTG-01…09 |
| 29 | Bookings | BKG-01…03 |
| 30 | Resources | RES-01…03 |
| 31 | Assets | AST-01…03 |
| 32 | Knowledge / wiki | DOC-01…07 |
| 33 | Live documents | DOC-08…09, C2W-04 |
| 34 | Capture | CAP-01…07 |
| 35 | Forms | FRM-01…06 |
| 36 | Requests | REQ-01…06 |
| 37 | SLA | SLA-01…05 |
| 38 | Approvals | APR-01…05 |
| 39 | Files | FIL-01…04, TSK-20 |
| 40 | Proofing | PRF-01…04 |
| 41 | Collaboration | COL-01…06 |
| 42 | Chat | CHT-01…21 |
| 43 | Chat ↔ work | C2W-01…06 |
| 44 | Project hub | HUB-01, PRJ-18…20 |
| 45 | Voice / video | CLL-01…03 |
| 46 | Attention centre | ATT-01…02 |
| 47 | Notifications | NOT-01…05 |
| 48 | Search | SRC-01…03 |
| 49 | Command palette | CMD-01 |
| 50 | Dashboards | DSH-01…04 |
| 51 | Reporting | RPT-01…02 |
| 52 | Workload | WLD-01…02 |
| 53 | Risks / decisions | RSK-01, DEC-01 |
| 54 | Directory | DIR-01, WS-18 |
| 55 | CRM | CRM-01…04 |
| 56 | Async work | ASY-01…03, CHK-* |
| 57 | Automation engine | AUT-01…06 |
| 58 | Workflow builder | WFB-01…05 |
| 59 | Playbooks | PBK-01…02 |
| 60 | Templates | TPL-01 |
| 61 | AI rule | AI-09, PERMISSIONS §3 AI |
| 62 | AI features | AI-01…05 |
| 63 | AI fields | AI-06 |
| 64 | AI workflow | AI-07 |
| 65 | AI agents | AI-08, PRM-08 |
| 66 | Integrations / MCP | INT-01…03 |
| 67 | Smart capture | CAP-08 |
| 68 | Email / chat → task | CAP-04, CAP-07, C2W-01 |
| 69 | Offline / PWA | OFF-01…05 |
| 70 | Mobile | MOB-01…02 + Mob column throughout |
| 71–75 | Visual design, tokens, type, geometry, workflow visuals | DSN-01…04, DESIGN_SYSTEM |
| 76–77 | Navigation, top bar | DSN-05…06, PAGE_INVENTORY §3 |
| 78 | Information architecture | PAGE_INVENTORY §3; Q-PO-7 |
| 79 | Home | HOM-01…03 |
| 80 | States | STA-01…02, PAGE_INVENTORY legend |
| 81 | Accessibility | A11Y-01…03 |
| 82 | Performance | PERF-01…02 |
| 83 | Security | SEC-01…06 |
| 84 | Audit | AUD-01…02 |
| 85 | Migrations | MIG-01, DATA_MODEL §8 |
| 86 | Testing strategy | QAP-01, QA §2 |
| 87 | E2E flows | QAP-02, QA §3 |
| 88 | Visual regression | DSN-08, QA §5 |
| 89 | Definition of done | QAP-03, ACCEPTANCE_CRITERIA §1 |
| 90 | Regression rule | QAP-04, COMPONENT_INVENTORY |
| 91 | No duplicated domain logic | QAP-05, ARCHITECTURE, R1/R2 |
| 92 | Phase mapping | PHASE_PLAN §2 |
| 93 | Per-phase workflow | QAP-06, PHASE_PLAN §3 |
| 94 | Page inventory requirement | PAGE_INVENTORY |
| 95 | Component inventory requirement | COMPONENT_INVENTORY |
| 96 | Design consistency for unseen pages | DSN-09, DESIGN_SYSTEM §10 |
| 97 | Don't limit to video | PRODUCT_SPEC A; this matrix |
| 98 | Don't overbuild | PHASE_PLAN §5 (Q-items, AS-items) |
| 99 | Final quality target | ACCEPTANCE_CRITERIA §3 |
| 100 | Pre-implementation gate | PHASE_PLAN §4 |
| I18N | Internationalization (cross-cutting) | I18N-01…18; PRODUCT_SPEC P; ARCHITECTURE §Internationalization; DESIGN_SYSTEM §12 |
