# Product Specification — Personal + Company Productivity OS

> Canonical product definition, §0–§100, plus cross-cutting requirement **I18N** (internationalization, added 2026-10-01). If code and this document disagree, one of them is a bug.
>
> - **Source:** master specification §0–§85 (supplied 2026-10-01) and §86–§100 (supplied 2026-10-01, second delivery).
> - **Condensed:** the text is condensed, but every requirement keeps its § tag so it can be traced. `COVERAGE_MATRIX.md → Spec traceability` maps every § to code, a coverage row, or a planned phase.
> - **Assumptions:** where this document records an assumption the spec does not settle, it is marked **[ASSUMPTION]** and listed in PHASE_PLAN.md → Open decisions.
> - **Known gap:** §85 arrived truncated after "For major changes: plan migrati…". The surviving text, and the reasonable reading of the cut-off clause, are recorded in §85 below.

The product is a unified **personal + company productivity operating system**: planning, tasks,
projects, calendar, habits, goals, time, collaboration, chat, knowledge, meetings, requests, forms,
reporting, company operations, automation, AI and selected life management in one coherent system.
It is not a todo app, not only a planner, and not a clone of Monday, Notion, Slack, ClickUp or
SugarCRM.

---

## A. Sources of truth and working method (§0–§2, §93, §97, §98, §100)

| Source | Responsible for |
|---|---|
| This spec | Features, business logic, entities, relationships, permissions, pages, workflows (**defines coverage**) |
| Repository | Implemented behaviour, architecture, migrations, routes. Never destroy working functionality unnecessarily |
| Video (`reference/video/`) | Existing flows, interaction patterns, motion, IA. **Not** visual style and **not** the feature list (§97) |
| Design refs (`reference/design/`) | Visual language, geometry, spacing, type, colour, navigation, responsive behaviour |

- §0: Never copy SugarCRM branding, logo, people, content or product language.
- §1: Before feature work, inspect the repository and the whole video. Extract frames at changes of page, modal, drawer, menu, filter, calendar, task, responsive or workflow state, then de-duplicate. `/reference` is never bundled.
- §2: Keep the permanent docs below in sync with code. Never rely on conversation memory. "Implemented" means it meets §89, not that a component exists.
  - PRODUCT_SPEC
  - ARCHITECTURE
  - DATA_MODEL
  - PERMISSIONS
  - PAGE_INVENTORY
  - COMPONENT_INVENTORY
  - DESIGN_SYSTEM
  - PHASE_PLAN
  - COVERAGE_MATRIX
  - ACCEPTANCE_CRITERIA
  - QA
- §97: The video is incomplete. Everything in this spec is in scope whether or not it appears there.
- §98: Do not invent large unrelated features because competitors have them. When uncertain:
  1. Consult the spec, the repo and the architecture.
  2. Document the uncertainty.
  3. Make the smallest architecture-safe assumption.

  Never invent business rules silently.
- §93: Per-phase workflow, steps A–N:
  - read the docs
  - write the module spec
  - write the page inventory
  - update the data model
  - write the permission matrix
  - define the server/domain operations
  - list the components
  - build the backend
  - build the UI
  - add loading, empty, error, mobile and permission states
  - add tests
  - run typecheck, lint, tests and build
  - inspect manually
  - update the docs and the coverage matrix

  Only then start the next phase.
- §100: Pre-implementation gate for each major phase. Audit existing code, then re-read the spec sections, coverage, pages, data model and permissions. Identify:
  - reusable parts
  - gaps
  - risks
  - migrations
  - unclear requirements

  Produce the phase plan. Plan before building any major module.

## B. Engineering ground rules (§3, §4, §82, §83, §85, §90, §91)

- §3 stack:
  - Next.js App Router, TypeScript, PostgreSQL, Prisma, Tailwind, Zod, lucide-react
  - shadcn/ui only as low-level primitives
  - Vercel-compatible
  - feature-oriented structure; no restructuring for cosmetics
  - no unnecessary state managers, abstraction layers, or duplicate UI/date/form libraries
  - no new package without a concrete reason
- §4 layering and integrity:
  - Layers: UI → application → domain → data access. Prisma never reaches client components. Every mutation is validated.
  - Never trust client values for user id, workspace id, permissions, ownership, prices, computed financial fields, role or status transitions. **Authorization is server-side.**
  - Tenant queries are always scoped. Use transactions where atomicity matters.
  - Be explicit about FKs, unique constraints, indexes and cascade/delete behaviour. Prefer archive or soft delete where history matters.
  - Be idempotent for races, double submits, retries, duplicate webhooks, recurring duplication and automation duplication.
  - Timestamps are consistent (UTC + user tz + workspace tz + DST). Money is decimal. `any` is forbidden unless documented.
- §82 performance: avoid loading whole datasets, N+1 queries, giant bundles, thousands of DOM rows, global state and needless re-renders. Paginate with cursors, virtualize genuinely large lists, lazy-load heavy modules, and index from real query patterns.
- §83 security, check for:
  - authn and authz
  - tenant isolation and object ownership
  - file permissions and upload validation
  - input validation and rich-text sanitisation
  - unsafe URLs, injection and mass assignment
  - privilege escalation and IDOR
  - sensitive data in logs

  A client workspace id is never proof of access.
- §85 migrations:
  - Every schema change goes through a Prisma migration.
  - Never reset production data, delete migrations casually, silently change enum meanings, or ship destructive migrations without review.
  - "For major changes: plan migration…" (truncated). Interpreted as: plan major changes (expand → backfill → contract), with review and a rollback note **[ASSUMPTION]**.
- §90 regression: before changing a working shared component, identify every usage (COMPONENT_INVENTORY → "Used by"). Prefer additive, compatible changes, and re-test dependent flows afterwards.
- §91 no duplicated domain logic:
  - Task creation from Planner, Project, Calendar, Chat, Meeting, Automation (and Forms, Capture, AI, Playbooks, Recurrence) **calls one task-creation domain service**.
  - Notifications, permissions, files, comments, activities and approvals are shared infrastructure.
  - There is never a second task system.

## C. Tenancy & identity (§5–§7)

- §5:
  - **Personal mode** and **Workspace/company mode** share one product and one design language.
  - A user has personal data, belongs to many workspaces, switches context, and creates personal and team work.
  - Every scoped entity has an explicit scope (`PERSONAL` | `WORKSPACE`). Personal ownership is never confused with workspace ownership.
- §6 identity:
  - Concepts: User, Profile, Avatar, account preferences, locale, timezone, theme, notification preferences, active workspace, sessions, memberships.
  - Settings are split into **Personal Profile · Account · Appearance · Notifications · Preferences · Security · Connected services**.
  - Support the current auth method, structured for growth. Identity is never duplicated per module.
- §7 workspaces:
  - Capabilities:
    - create, settings, avatar/icon
    - member invitation with invitation state
    - remove member, deactivate access
    - teams/groups, guests, external collaborators
    - role assignment, permission management
    - member directory, team directory
    - workspace activity, audit history
  - Base roles: **Owner, Admin, Manager, Member, Guest**.
  - Authorization is a centralized capability model (`workspace.manage`, `members.manage`, `projects.create|edit|delete`, `tasks.create|assign|delete`, `chat.manage`, `forms.manage`, `automations.manage`, `reports.view`, `finance.view|manage`, …). Custom roles must be possible without rewriting modules.

## D. Universal object model (§8, §9)

- §8 core concepts:
  - User, Workspace, Membership, Team, Area, Project, Board, Item, Task, Subtask
  - Comment, Attachment, Tag, Label, Status, Priority, CustomField, CustomFieldValue, Relation, Milestone
  - Goal, Habit, HabitLog, CalendarEvent, TimeBlock, TimeEntry, Meeting, Channel, Message, Thread
  - Document, Form, Submission, Request, Approval, Automation, Notification, Activity
  - FinanceEntry, Budget, Subscription, Resource, Asset, Booking, Risk, Decision, CheckIn

  No mega-table for unrelated concepts, and no isolated silos either: shared concepts share infrastructure.
- §9 flexible work management:
  - custom boards, custom item/entity types, custom fields, subitems, relations within and across boards
  - Field types: Text, Long text, Number, Status, Priority, People, Date, Date range, Time, Checkbox, Select, Multi-select, Tags, Progress, URL, Email, Phone, File, Relation, Mirror, Formula
  - Formulas never execute arbitrary code. Relations are real relationships. Mirrors derive from the source record, never stale copies.

## E. Planning & execution

- §10 Planner:
  - Views: Inbox, Today, Upcoming, Overdue, Scheduled, Someday/Later, Completed, All Tasks.
  - Interactions: quick compact natural creation, drag & drop, reschedule, prioritise, group, sort, filter, saved filters/views, bulk actions.
  - Covers personal **and** assigned workspace tasks in one place.
- §11 Task engine:
  - Fields:
    - title, rich description, status, priority
    - start date, due date, start time, due time, all-day
    - assignee(s), creator, owner
    - project, board/list, area, labels/tags, custom fields
    - subtasks, checklist, dependencies, blockers, related tasks
    - attachments, comments, mentions, followers/watchers
    - reminders, recurrence, estimate, actual tracked time
    - completion info, activity history, archived state
  - Actions: create, edit, duplicate, move, assign, unassign, complete, reopen, archive, restore, delete (when authorized).
  - **Recurrence:** never mutate one completed record forever. It needs a schedule definition, next-occurrence calculation, tz handling, termination and duplication protection.
  - **Dependencies:** no inconsistent graphs; avoid cycles.
- §12 Sharing:
  - A task can be personal, directly shared, project-based or workspace-based.
  - Collaboration: assignee, **participants**, watchers, comments, mentions, attachments, activity, permission-aware access.
  - Sharing one object never grants access to an entire private workspace.
- §13 Projects:
  - Pages: Project List, Project Home/Overview, Tasks, Board, Timeline, Calendar, Files, Docs/Notes, Chat, Activity.
  - Metadata: title, description, icon, status, owner, members, start/target dates, progress, priority, milestones, health, tags, custom fields.
  - Views (List/Table, Kanban, Calendar, Timeline, Gantt-like dependency view, Workload, Progress, Activity) are **one data set**.
- §14 Portfolios: group projects with owner, status, progress, health, deadline, priority, milestones, risks and cross-project reporting. A portfolio is not a folder.
- §15 Roadmaps/Milestones/Releases: targets, timeline, dependencies, status, progress, connected to real projects and tasks.
- §16 Agile: optional per project. Cycles/sprints, backlog, sprint planning, start/end, story/task/bug, issue priority/status, assignee, labels, estimates, cycle progress. Never forced on personal or simple projects.
- §17 Issues: type, severity, priority, status, assignee, reporter, environment, reproduction, attachments, related task/project, comments, history. Built on the task infrastructure.
- §18 Calendar:
  - Views: Day/Week/Month/Agenda.
  - Shows tasks, events, meetings, time blocks, deadlines, habits (where appropriate) and bookings.
  - Interactions: drag, resize, reschedule, create, open detail, filter calendars/types, toggle sources. Timezone-correct.
- §19 Time blocking:
  - A block is not the task. Moving a block never rewrites unrelated task history.
  - Kinds: task, manual, focus, meeting, routine, recurring. A task may have many blocks.
- §20 Time tracking & Focus:
  - Timer: manual or task timer with start/pause/resume/stop, manual entries, estimated vs actual, daily and project totals. **One active timer per user** unless explicitly designed otherwise.
  - Focus mode: selected task, timer, interruption-safe state, completion controls, minimal UI, session notes.
- §21 Daily Plan, Daily Review, Weekly Plan, Weekly Review:
  - Contents: important tasks, priorities, overdue review, calendar preview, habits, goals, incomplete work, notes/reflection, next-week planning.
  - Reference existing objects and never duplicate tasks.

## F. Life management

- §22 Habits:
  - Types: Boolean, Count, Quantity, Duration, Numeric, Scale.
  - Definition: name, icon, target, unit, schedule, frequency, days, time, reminder, minimum and ideal target, streak behaviour, start date, archive.
  - Historical logs. Custom habits; the examples (water, sleep, exercise, reading, meditation, steps, nutrition, mood, energy, routines) are never hardcoded.
  - Views: Today/Week/Month/History/Trends showing completion, %, amount, streak, best streak and consistency.
- §23 Routines: ordered items referencing habits, tasks, checklist actions or time blocks. Completion never destroys the underlying records.
- §24 Journal: dated rich-text entries with tags and links to tasks/projects/goals.
- §24 Check-ins: recurring structured prompts (status, blockers, achievements, next actions) for personal review, team async status and project check-ins. History is searchable.
- §25 Goals:
  - Scope: personal, team or workspace.
  - Fields: title, description, owner, timeframe, status, target, current, unit, progress, related goals/projects/tasks, milestones, optional key results.
  - Progress is manual **or** calculated, never silently mixed.
- §26 Finance (productivity/life module, not a banking core):
  - Entries: income, expense, transfer-like categorisation, category, account/wallet label, date, amount, currency, notes, receipts, tags, recurring entries.
  - Planning and reports: budgets, category budgets, monthly summary, breakdown, income vs expense, recurring costs, subscriptions.
  - Company finance requires explicit permission.
- §27 Subscriptions: service, amount, currency, billing frequency, next charge, owner, category, payment-source label, reminder, active/cancelled. Integrated with finance reporting.

## G. Company operations

- §28 Meetings:
  - Fields: title, participants, date/time, agenda, project, description, files, notes, decisions (stored separately), action items, follow-ups.
  - Action items can become real Tasks.
  - The page connects Agenda · Discussion · Notes · Files · Decisions · Actions.
- §29 Bookings: resource, user, start/end, status, conflict validation, notes. Exclusive resources reject overlaps.
- §30 Resources: directory of people, teams, rooms, equipment and other shared resources, with capacity, availability, assignments, booking, related projects and workload.
- §31 Assets (optional): category, identifier, status, owner, assignee, purchase/added date, notes, attachments, history. Assignment changes keep history.
- §52 Workload: draws on assigned tasks, estimates, planned time, availability and dates. Distinguish task count vs estimated vs scheduled vs tracked. No fake precision.
- §53 Risks (title, probability/level, impact, owner, mitigation, status, date) and Decisions (title, decision, context, owner, date, related project/meeting). Both searchable.
- §54 Directory: member, role, team, timezone, presence, current projects (permission-aware), contact/profile info. Respects privacy.
- §55 CRM (optional module): Contact, Company, Lead, Opportunity/Deal, Pipeline, Stage, Activity. Connects to tasks, meetings, notes, files and contacts. Kept modular; never contaminates the planner.
- §56 Async work: recurring check-ins, status updates, project updates, announcements, structured questions, blockers, action items.

## H. Knowledge & capture

- §32 Wiki/Docs: documents, nested pages, rich text, attachments, tags, links, backlinks/relations, project/workspace association, permissions, search.
- §33 Live documents: live embeds of tasks, projects, goals, boards and items, clearly distinguished from copied text. No snapshot duplication when the intent is live.
- §34 Capture:
  - Sources: web clip, quick manual capture, text, image, URL, document, email, chat message.
  - Results: Task, Note, Document or Inbox item.
  - Never create multiple records without user intent.
- §67 Smart capture: AI-assisted OCR, task/date/person extraction, classification and summary. Always correctable before commit when confidence is uncertain.
- §68 Email/chat → task keeps a source reference. No copy-only workflows.
- §39 Files:
  - Attach to tasks, projects, messages, meetings, documents, requests and users.
  - Metadata is separate from the storage provider.
  - Validate size, type and permission. Access follows the parent resource.
- §40 Proofing: lightweight review state, comments, approve/reject, versions, reviewer. Not a design tool.

## I. Forms, requests, SLA, approvals (§35–§38)

- §35 Form builder:
  - Fields: text, long text, select, multi-select, date, number, checkbox, file, people (permitted), configurable.
  - A form creates a task, board item, request or other entity.
  - Submissions keep history, timestamp, submitter or anonymous state, status and linked result.
- §36 Requests:
  - Types are configurable, never hardcoded.
  - Fields: requester, assignee/team, priority, status, due/SLA, comments, files, approval, activity.
  - May originate from forms.
- §37 SLA: target response, target resolution, due calculation, paused states, breached state, reporting. Deterministic and testable.
- §38 Approvals:
  - Generic engine for requests, tasks, documents, expenses and workflows.
  - States: Pending, Approved, Rejected, Cancelled.
  - Records approver, timestamp, comment, source record and history. Never overwrites history.

## J. Collaboration & communication

- §41 Primitives:
  - comments, replies, mentions, reactions, followers/watchers, activity, attachments, assignments, presence
  - Comments keep author, timestamp, edited state and deletion state/history policy.
  - Mentions notify.
- §42 Chat:
  - Channels: public, private, project channels, DMs, group DMs.
  - Messaging: send, edit, delete (by policy), replies, threads, reactions, mentions, unread/read, pins, saved messages, attachments, links, typing state, presence.
  - Search. Guests obey permissions. Federation-ready, not federation now.
- §43 Chat ↔ work: from a message, convert to task, create follow-up, create note, reference in a doc, attach to a project, or create a meeting action. Use references, not copied content.
- §44 Project communication hub: never leave the project to find its communication.
- §45 Calls: 1:1 and group voice/video and screen share via a provider integration. Domain models account for calls and meetings. No home-grown media stack.
- §46 Attention centre:
  - Covers mentions, replies, assignments, comments, approvals, upcoming meetings, deadlines, overdue items, invitations and workflow events.
  - Action-required items are kept **separate from** activity history. Not a noise feed.
- §47 Notifications: unread/read, type, source, entity reference, timestamp, actor, deep link, optional action buttons. Preferences per category and channel.

## K. Navigation, search, dashboards, reports, home

- §48 Search:
  - Covers tasks, projects, boards/items, messages, documents, file metadata, people, goals, meetings, requests.
  - **Never leaks unauthorized workspaces.**
  - Command-style, type filters, recent items, navigation.
- §49 Command palette: create task/project/note/meeting, start timer, open calendar/project/chat, search person. Uses existing services and never duplicates logic.
- §50 Dashboards:
  - Personal and company, configurable, multi-source (projects, boards, goals, habits, tasks, finance, requests).
  - Widgets: KPI, progress, chart, calendar, workload, table, activity, goal, task, habit, custom.
  - Drag/rearrange. The layout is stored as configuration.
- §51 Reports: tasks, projects, workload, time, goals, habits, requests, finance, activity. Filters by date range, project, team, user, status, priority, category. Metrics are reproducible.
- §76/§77 Navigation and top bar: see N.
- §78 IA:
  - Primary areas: Home, Planner, Tasks, Calendar, Projects, Goals, Habits, Focus/Time, Finance, Chat, Docs/Knowledge, Forms/Requests, Team, Dashboards/Reports, Automations, Search, Settings.
  - Company/future areas: Portfolio, CRM, Assets, Resources, Bookings.
  - Navigation is hierarchical and contextual, not all equal.
- §79 Home: adapts to context.
  - Personal: today, upcoming, habits, calendar, goals, focus, recent activity, metrics.
  - Company: assigned work, projects, team, deadlines, mentions, meetings, approvals, workload/status.
  - Not a widget cemetery.

## L. Automation, templates, AI, integrations (§57–§66)

- §57 Automation:
  - Shape: trigger → typed conditions → actions. No user-supplied code.
  - Triggers: task created/updated, status changed, due date reached or approaching, item created, form submitted, request created, approval changed, habit event, schedule, project change.
  - Actions: update field, assign, move item, create task/item, notify, create approval, post message, create follow-up, external integration action.
- §58 Workflow builder: trigger and condition-branch nodes, action nodes, human approval, safe delays/waits, history, failed-run status, retry, enable/disable. Every run is traceable with execution logs. Prevent infinite loops.
- §59 Playbooks: repeatable process templates (tasks, stages, checklists, approvals, assignments, meetings, documents). Each run produces a traceable instance.
- §60 Templates: for tasks, projects, boards, documents, forms, routines, dashboards and playbooks. Reusable definitions, not hidden duplicates.
- §61 AI rule: AI assists and never corrupts deterministic logic. It is separated from core data integrity, and its changes to important data are reviewable.
- §62 AI features:
  - summarization (meeting, project, chat, document)
  - task and action-item extraction
  - categorization, labels, field extraction, sentiment
  - translation, writing assistance, generation
  - suggested priorities, plan and schedule

  Provenance is retained.
- §63 AI fields: categorize, summarize, extract, translate, generate, sentiment. Run as controlled jobs, never computed per render.
- §64 AI workflow nodes: extract, classify, summarize, draft, suggest category. Human approval for critical decisions. No unrestricted access.
- §65 AI agents: explicit allowed tools, workspace/user context, permission boundaries, execution history, human approval for sensitive actions. **No agent bypasses permissions.**
- §66 Integrations/MCP-like: a controlled layer that validates permission and config, logs, handles failure and avoids duplicate execution. No vendor logic inside domain modules.

## M. Platform qualities

- §69 Offline/PWA:
  - installable, cached shell, cached reads, offline capture, mutation queue, reconnect sync
  - Defined conflict resolution: version/`updatedAt` checks, merge/conflict UI. Never silently overwrite newer server data.
  - Never claim data is synced before the server confirms.
- §70 Mobile: purposeful layouts with stacks, sheets, drawers, bottom actions, contextual controls and horizontal-scroll workflows. Tables become cards. Not a shrunken desktop.
- §80 States: every significant surface handles Loading, Empty, Error, Permission denied, Archived, Not found and Partial data. Never blank. Empty states guide the next action. Don't reveal private objects through differences in error responses.
- §81 Accessibility: keyboard navigation, visible focus, labels, semantics, screen-reader info, contrast, reduced motion. Icon-only buttons have names.
- §84 Audit: role change, member removal, reassignment, approval completion, request status, project status, finance change, automation execution. Audit history is not editable content.

## N. Design (§71–§77, §88, §96) — details in DESIGN_SYSTEM.md

- §71 Qualities: premium, soft, minimal, modern, calm, friendly, spacious, coherent.
  - Language: cool light-gray canvas, white/light surfaces, near-black active surfaces, pastel accents, large radii, circular controls, pills, avatars, subtle separation, limited shadows, minimal borders, nested surfaces.
  - Not a shadcn demo, Bootstrap, admin template, or Linear/Notion/Monday clone.
- §72 Semantic tokens: the reference hexes are direction, not hardcoded values.
- §73 Type: a Lufga-like geometric typeface (or a legal alternative), with a clear hierarchy: page, section, card, body, metadata, caption.
- §74 Radii: large 28–36, medium 20–28, small 14–20. Circular buttons, pills, nested cards, occasional dark focus cards, avatar groups, soft connectors.
- §75 Workflow visuals (cards/nodes, curved connectors, stages, avatars, statuses, dependency points, selected state) only for real relationships.
- §76 Minimal icon rail with tooltips, grouping, subtle active state, user/settings at the bottom, and secondary navigation inside modules.
- §77 Calm top bar: context, search, command, attention, notifications, quick add, avatar, contextual actions.
- §88 Visual regression loop: start the app, open the target viewport, screenshot, compare against references and sibling screens. Inspect:
  - spacing and alignment
  - typography and hierarchy
  - surfaces and radii
  - button sizes and card proportions
  - responsive behaviour

  Fix and repeat. Never declare UI done after one pass.
- §96 Pages with no reference: derive from the functional requirements and compose existing patterns, tokens, spacing, type, radii and navigation, keeping mobile consistent. Never invent a new visual system.

## O. Quality, testing and delivery (§86–§95, §99)

- §86 Risk-based tests, covering at minimum:
  - tenant access, permissions, workspace membership, invitation
  - task CRUD, assignment, recurrence, dependencies
  - calendar timezone, time-block changes
  - habit logging, budget/calculation logic
  - approvals, request/SLA logic, form submission
  - automation idempotency, notification generation

  Use integration tests where DB behaviour matters, and E2E for high-value flows.
- §87 Required E2E flows:
  1. New user → onboarding → personal planner → create → schedule → complete task.
  2. Create workspace → invite → member joins → project → assign task → comment → notification → complete.
  3. Create project → add members → tasks → board → calendar → activity.
  4. Quantity habit → log amount → reach target → streak/history update.
  5. Meeting → agenda → notes → decision → action item → task.
  6. Submit form → request → assigned → approval if required → resolve.
  7. Chat message → mention → notification → convert to task.
  8. Create workflow → trigger → condition → action → execution log.
- §89 Definition of Done:
  - requirement implemented, database correct, validation, authorization
  - responsive; loading, empty and error states; accessibility
  - tests added; no console errors; no broken routes
  - TypeScript clean, lint clean, production build passes
  - docs and coverage matrix updated

  A rendered happy path is not "done".
- §90, §91: see B.
- §92 Phases: the master spec's 14 conceptual areas may map onto a more granular implementation plan, with an explicit mapping (area → phase → included → deferred → dependencies) proving nothing was dropped. The conceptual order:
  0. Foundation
  1. Auth & Identity
  2. Workspaces
  3. Core Data Models
  4. Planner UI
  5. Task Engine
  6. Project Management
  7. Calendar & Time
  8. Habits & Life
  9. Finance
  10. Collaboration
  11. Chat
  12. Goals/Dashboards/Reports
  13. Automation/AI/Advanced
- §94 Page inventory per module, before implementation, covering:
  - pages, routes, tabs, subpages
  - drawers, modals, popovers, sheets, context menus
  - empty, loading, error, permission and mobile states

  The spec, not the video, defines coverage.
- §95 Component inventory: identify reusable components before duplicating layouts. Responsibilities stay clear (AppShell, NavigationRail, TopBar, PageHeader, Surface, Card, IconButton, Avatar(Group), StatusPill, CommandMenu, FilterBar, TaskCard/Row/Detail/Composer, ProjectCard/Header, WorkflowNode/Canvas, Calendar(Event), HabitCard, ProgressRing, Metric, CommentThread, ActivityFeed, NotificationItem, Message, ChatComposer, DocumentEditor, FormBuilder, DashboardGrid, Widget, EmptyState, ErrorState).
- §99 Quality target: one coherent OS where a user moves Capture → Plan → Schedule → Execute → Collaborate → Communicate → Review → Automate without feeling the app switch. Personal and company are contexts of the **same product**. The product is visually premium, maintainable, modular, secure, multi-tenant, responsive, accessible, extensible, testable, fast and coherent.

## P. Internationalization — cross-cutting platform requirement (I18N, added 2026-10-01)

The product is multilingual. Every phase delivers its UI translated, RTL-safe and locale-formatted.

- **I18N-1 Locales:** `en` (LTR) and `fa` (RTL, first-class). Adding a locale needs a registry entry and a `messages/<locale>/` folder, never a migration.
- **I18N-2 Clean URLs:** authenticated routes stay unprefixed (`/home`, `/planner`, …). No `[locale]` segment.
- **I18N-3 Resolution order:** signed-in user's saved locale → locale cookie → Accept-Language → `en`. Unsupported values are ignored at every step. Resolution is centralized on the server; components never read `navigator.language`.
- **I18N-4 Persistence:** the choice persists across sessions (account) and on the device (cookie, kept after sign-out). Switching language preserves the route, active workspace and session.
- **I18N-5 Catalogs:** one JSON file per namespace per locale. Keys are semantic and stable (`planner.views.today.label`), never sentences. ICU messages handle plurals, selects and rich text; fragments are never concatenated.
- **I18N-6 No hardcoded copy:** all user-facing text comes from catalogs, including labels, placeholders, validation, empty/error states, aria labels and tooltips. Not translated: identifiers, enum values, constants, logs, developer errors, and user content.
- **I18N-7 Language-neutral domain:** services, domain logic, permissions and the database use stable values and error *codes*. Translation happens only at the presentation/action boundary. Enum labels are mapped in the UI.
- **I18N-8 RTL:** `dir` is set per locale. Use logical properties (start/end, `ms`/`me`/`ps`/`pe`, `start-*`/`end-*`, `text-start`). Mirror directional icons (back, forward, chevrons, "open" arrows); don't mirror semantically neutral icons (ring gauges, check, plus, close). User content uses `dir="auto"`.
- **I18N-9 Typography:** a high-quality Persian font that matches the design (Vazirmatn). No letter-spacing on Arabic-script text. Mixed-script text renders each script in its intended face.
- **I18N-10 Locale ≠ timezone:** the locale controls presentation; the timezone controls interpretation. Stored values never change. Dates display in the **Gregorian** calendar in every locale until a Jalali requirement is decided (Q-I18N-1).
- **I18N-11 Formatting:** numbers, percentages, dates, times, durations, currency and relative time are formatted with Intl by presentation helpers. Formatted values are never stored.
- **I18N-12 Natural-language parsing:** Quick Add parses **English keywords only** and says so in the UI. Titles in any script pass through untouched. Locale-specific parsers can be added later without weakening the English parser; claiming unsupported NLP is forbidden.
- **I18N-13 Unicode:** text is stored and searched as entered (UTF-8). Normalisation must not strip meaningful Persian/Arabic characters (ZWNJ, ی/ک forms). User content is never translated or duplicated per language.
- **I18N-14 Quality parity:** the Persian/RTL layouts get the same design quality as English: no fixed-width assumptions, and the visual loop (§88) covers both directions.
