# Page Inventory

Required by §94. The spec defines coverage, not the video (§97). Planned routes are proposals and are **not created** until their phase gate (§100).

Shared state vocabulary, used by every surface (§80):
- **L** Loading: skeleton matching the final layout.
- **E** Empty: says what this is plus the next action.
- **Er** Error: retry, keeping the user's draft.
- **P** Permission: identical to not-found for private objects; an explicit "Your role can't…" only for workspace-level features the user knows exist.
- **A** Archived: read-only banner plus restore if allowed.
- **NF** Not found.
- **PD** Partial data: some sources are hidden by permissions or failed to load.

Unseen pages follow §96: compose the existing patterns (Panel/Card/SectionHeader/pill tabs/Sheet/rail).

**People:** wherever a planned page shows a small group of related users (participants, reviewers, assignees, channel members, approvers, resource holders, deal team…), it uses `PeopleCluster` (DESIGN_SYSTEM §13), placed near the card or section header.

**Every planned page below must also ship (I18N):**
- all copy in catalogs (a namespace per module)
- an RTL layout check
- Intl formatting for numbers, dates, money and durations
- `dir="auto"` on user content
- mobile RTL

Global layout:
- Desktop ≥1024: rail + top bar + content, with a right-side Sheet for detail.
- Tablet 640–1023: rail, with tabs collapsing into scrollable pills.
- Mobile <640: top bar + content + floating tab bar + FAB. Detail and forms open as bottom sheets; tables become record cards.

---

## 1. Built (Phase 1–2)

| Route | Purpose | States | Mobile |
|---|---|---|---|
| `/sign-in`, `/sign-up` | Email/password auth with safe `?next=` | field errors, wrong credentials, pending | single column |
| `/` | Redirects to `/home` or `/sign-in` | — | — |
| `/home` | Context-aware home: Today + quick add, Next-up dark card, counts, projects | L, E, Er | stacked |
| `/planner/[view]` | 8 views; `?scope=`; `?task=` sheet; `?deleted=` undo | L, E (per view), Er, NF, conflict, truncated >200 | scrollable pills, bottom sheet |
| `/projects` | Project cards for the active context; create dialog; archived toggle | L, E, A | 1-column cards |
| `/projects/[projectId]` | Tasks, quick add, status/health/archive, overview, members | L, E, NF≡P, A, read-only | stacked |
| `/team` | Member directory, role change | personal context, no workspaces, no `members.view` | list |
| `/settings` | Profile/preferences, workspaces, account | save success/error | stacked |

Overlays already built: TaskSheet, CreateProject dialog, ContextSwitcher menu, Account menu, UndoDeleteBanner.

Localization (I18N, done 2026-10-01): every built route renders in `en` (LTR) and `fa` (RTL).
- `/settings` has a **Language** field (saved to the account and the cookie; applies in place).
- `/sign-in` and `/sign-up` have a **language switcher** (cookie) under the card.
- A root `not-found.tsx` exists for unmatched URLs (localized).
- Locale-specific states:
  - unsupported locale → silent fallback to English
  - mixed-script user content → `dir="auto"`
  - Quick Add keyword-language note in the planner help panel

---

## 2. Planned by module

Each block lists routes · screens/tabs · overlays · states · desktop · mobile.

### 2.1 Auth, onboarding, account (Phases 2b, 6, 15)
- **Routes:**
  - `/onboarding` (steps)
  - `/invite/[token]`
  - `/forgot-password`, `/reset-password/[token]` *(needs an email provider, Q-PO-4)*
  - `/settings/profile | account | appearance | notifications | preferences | security | connections` (§6 split; today one page)
- **Screens:**
  - Onboarding: name/tz confirm → personal vs team → first tasks (content TBD, Q-PO-3).
  - Invite accept: workspace preview, accept/decline; sign-up inline when the user has no account.
- **Overlays:** sign-out-all-sessions confirm, delete-avatar confirm.
- **States:**
  - Invite: expired/revoked/already-member/wrong-email (each distinct; this is the invitee's own token, so no leak).
  - Sessions list L/E.
- **Mobile:** single column; settings sub-nav becomes a list → detail push.

### 2.2 Workspace & team (Phase 2b, 14)
- **Routes:**
  - `/team` (members)
  - `/team/invitations`
  - `/team/teams`, `/team/teams/[teamId]`
  - `/team/guests`
  - `/settings/workspace/general | roles | audit`
- **Overlays:**
  - Invite dialog (emails, role, message)
  - Member sheet (role, teams, deactivate/remove confirm)
  - Custom-role editor sheet (capability checklist grouped by module)
  - Transfer-ownership confirm
- **States:**
  - E: no invites/teams.
  - P: no `members.manage` shows a read-only directory.
  - A: deactivated members filter.
  - Last-owner guard message.
- **Desktop:** table-like rows. **Mobile:** record cards; actions in a bottom sheet.

### 2.3 Planner remainder (Phase 3)
- Additions to `/planner/[view]`:
  - group/sort menu
  - filter bar (space, project, label, priority, assignee)
  - saved-view pills
  - bulk-select mode with a bulk action bar (complete, reschedule, move, prioritise, delete)
  - drag to reorder; drag onto a date group to reschedule
- **Overlays:** reschedule popover (date shortcuts), save-view dialog.
- **States:** E for a filter with no results ("No tasks match", plus clear filters).
- **Mobile:** long-press enters bulk mode with a bottom action bar; drag is replaced by "Move to…" in a sheet.

### 2.4 Task detail completion (Phase 3)
- Sheet sections added:
  - assignees/participants/watchers pickers
  - labels
  - start date/time
  - estimate
  - subtasks list
  - dependencies (blocked by / blocking, mini WorkflowCanvas)
  - related tasks
  - attachments
  - comments thread with mentions
  - reminders
  - duplicate / move / archive actions
- **Route:** `/tasks/[taskId]` for a full-page deep link, which also serves mobile share links.
- **Overlays:** people picker popover, label picker, dependency search, attachment upload, comment context menu (edit/delete/copy link).
- **States:** A (archived banner), P (read-only), conflict banner (exists), upload error.

### 2.5 Projects (Phase 3)
- **Routes:** `/projects/[id]` with tabs **Overview · Tasks · Board · Timeline · Calendar · Files · Docs · Chat · Activity** (Files/Docs/Chat appear once Phases 10/7 ship).
- **Screens:**
  - Overview: health, progress, milestones, members, recent activity.
  - Board: columns by status or section.
  - Timeline: Gantt-like with dependency connectors.
- **Overlays:**
  - Project settings sheet (name, icon, colour, dates, visibility, priority, tags)
  - Members sheet
  - Milestone dialog
  - Section rename/delete context menu
  - Archive confirm
- **States:** E per tab, A (read-only, restore), P (NF≡P), PD (timeline omits hidden dependencies).
- **Mobile:**
  - Tabs become a scrollable pill row.
  - Board scrolls horizontally, one column per viewport.
  - Timeline becomes an agenda list with a dependency chip.

### 2.6 Calendar (Phase 4)
- **Routes:** `/calendar/day | week | month | agenda` with `?date=`.
- **Screens:** grid, source toggles sidebar (calendars, tasks, deadlines, habits, bookings), mini month.
- **Overlays:**
  - Event create/edit sheet
  - Quick-create popover on slot click
  - Event detail popover
  - Recurring edit scope dialog ("this / following / all")
  - Timezone picker
- **States:** E (no events, with a create hint), L (grid skeleton), Er (failed source shown as a PD chip), P (free/busy-only blocks).
- **Mobile:** day and agenda only, with swipe between days. Create via FAB → sheet. Drag-resize is replaced by start/end fields.

### 2.7 Time blocking, focus, time tracking (Phase 4)
- **Routes:** `/focus` (minimal full-screen), `/time` (entries list, daily/project totals).
- **Overlays:**
  - Schedule-task-into-block popover (from planner/task)
  - Global timer pill in the top bar (start/pause/stop)
  - Manual entry dialog
  - "Another timer is running" confirm
- **States:**
  - Focus: interrupted/resumed after reload; task completed or deleted mid-session.
  - Time: E (no entries).
- **Mobile:** timer pill above the tab bar; focus is a full-screen sheet.

### 2.8 Daily / weekly planning & review (Phase 5)
- **Routes:** `/plan/today`, `/plan/week`, `/review/today`, `/review/week`.
- **Screens:** guided columns: overdue review → pick priorities → calendar preview → habits → goals → notes.
- **Overlays:** "carry over / reschedule / drop" per task.
- **States:** E (nothing to review), completed-plan state.
- **Mobile:** stepper, one section per screen.

### 2.9 Habits (Phase 5)
- **Routes:** `/habits` (Today), `/habits/week`, `/habits/month`, `/habits/[id]` (history and trends).
- **Overlays:** habit create/edit sheet (type-specific fields), quick log popover (amount/duration/scale), log edit dialog, archive confirm.
- **States:** E (no habits, suggested custom-habit form, nothing hardcoded), A (archived list), target reached, streak broken.
- **Mobile:** HabitCards with a one-tap log; long-press opens the amount entry.

### 2.10 Routines (Phase 5)
- **Routes:** `/routines`, `/routines/[id]`, `/routines/[id]/run`.
- **Overlays:** item picker (habit/task/checklist/block), reorder.
- **States:** E, run in progress, run completed.
- **Mobile:** run mode is a full-screen checklist.

### 2.11 Journal & check-ins (Phase 5)
- **Routes:** `/journal`, `/journal/[date]`, `/check-ins`, `/check-ins/[templateId]`, `/check-ins/[templateId]/respond`.
- **Overlays:** link-to-object picker, template editor sheet.
- **States:** E, overdue prompt, P (team responses).
- **Mobile:** editor in full-screen mode.

### 2.12 Goals (Phase 5)
- **Routes:** `/goals`, `/goals/[id]` (tabs Overview · Key results · Links · History).
- **Overlays:** goal sheet, key-result dialog, link picker, progress check-in dialog (manual mode only).
- **States:** E, A, calculated-progress explanation, PD (linked items hidden).
- **Mobile:** stacked cards with progress rings.

### 2.13 Attention, notifications (Phase 6)
- **Routes:** `/attention` (action-required), `/activity` (history). Naming: Q-PO-6, to avoid a clash with the Planner "Inbox".
- **Overlays:** notification popover from the top-bar bell, inline actions (approve, open, snooze, mark done), notification preferences page in settings.
- **States:** E ("All caught up"), grouped by type, unread filter.
- **Mobile:** full page from the tab bar "More"; swipe to mark as done.

### 2.14 Search & command palette (Phase 6)
- **Surfaces:** ⌘K overlay (commands + search), `/search?q=&type=`.
- **States:** E (recent items), no results, PD (some sources unavailable).
- **Mobile:** search icon opens a full-screen overlay.

### 2.15 Capture (Phase 6; AI-assisted in 13)
- **Surfaces:** quick-capture overlay (global shortcut), `/capture` (review queue), browser web-clipper endpoint, email-in address view.
- **Overlays:** convert dialog (→ task/note/doc) with editable extracted fields.
- **States:** low-confidence warning, E.

### 2.16 Chat (Phase 7)
- **Routes:**
  - `/chat` (channel list)
  - `/chat/[channelId]`
  - `/chat/[channelId]/thread/[messageId]`
  - `/chat/saved`
  - `/chat/mentions`
  - project Chat tab
- **Overlays:**
  - New channel dialog (public/private), new DM/group DM picker
  - Channel settings sheet (members, archive)
  - Message context menu (reply, react, edit, delete, pin, save, copy link, **convert to task / follow-up / note / attach to project**)
  - Emoji picker, attachment upload
  - Pinned messages drawer
  - Search within channel
- **States:** E (no channels; empty channel), L (message skeletons), Er (failed send → retry), P (left/removed), A (archived channel read-only), deleted-message placeholder, offline banner.
- **Desktop:** channel list | messages | thread side panel.
- **Mobile:** list → channel push → thread as a sheet; composer pinned above the keyboard.

### 2.17 Boards, items, custom fields (Phase 8)
- **Routes:** `/boards`, `/boards/[id]` (views Table · Kanban · Calendar · Timeline), `/boards/[id]/items/[itemId]`.
- **Overlays:** field editor sheet (type-specific config, formula builder), item sheet, relation picker, view settings, filter bar.
- **States:** E, formula error cell, mirror source hidden (PD), A.
- **Mobile:** table becomes record cards; field editing in a sheet.

### 2.18 Dashboards (Phase 8)
- **Routes:** `/dashboards`, `/dashboards/[id]`, `?edit=1` mode.
- **Overlays:** widget picker, widget config sheet, layout drag handles (edit mode).
- **States:** E (no widgets), widget-level L/Er/PD.
- **Mobile:** single-column widget stack; editing is desktop-only (read-only on mobile **[ASSUMPTION]**).

### 2.19 Reports & workload (Phase 8)
- **Routes:** `/reports`, `/reports/[kind]` (tasks, projects, time, goals, habits, requests, finance, activity), `/workload`.
- **Overlays:** filter bar, export dialog.
- **States:** E, PD, P (finance reports without `finance.view`).
- **Mobile:** charts stacked; tables become cards.

### 2.20 Forms (Phase 9)
- **Routes:** `/forms`, `/forms/[id]/edit`, `/forms/[id]/submissions`, public `/f/[slug]`.
- **Overlays:** field editor, target mapping (→ task/item/request), publish dialog.
- **States:**
  - Public form: closed, submitted (confirmation), validation errors, rate-limited.
  - E (no submissions).
- **Mobile:** the public form is mobile-first.

### 2.21 Requests & SLA (Phase 9)
- **Routes:** `/requests` (queue: mine / assigned / team), `/requests/[id]`, `/requests/new`, `/settings/workspace/request-types`.
- **Overlays:** assign popover, status change with reason, SLA detail popover.
- **States:** SLA at-risk/breached/paused chips, E, P.
- **Mobile:** queue cards; detail as a sheet.

### 2.22 Approvals (Phase 9)
- **Routes:** `/approvals` (pending for me / requested by me / history).
- **Overlays:** decision dialog (approve/reject plus comment).
- **States:** already decided, cancelled, source no longer accessible.
- **Mobile:** swipe actions disabled; explicit buttons only (safety).

### 2.23 Meetings (Phase 10)
- **Routes:** `/meetings`, `/meetings/[id]` (tabs Agenda · Discussion · Notes · Files · Decisions · Actions).
- **Overlays:** schedule dialog (links to calendar), decision dialog, action-item → task dialog, join-call button (provider).
- **States:** upcoming / live / ended, E, P.
- **Mobile:** tabs as pills; notes editor full-screen.

### 2.24 Docs / wiki (Phase 10)
- **Routes:** `/docs`, `/docs/[id]`, project Docs tab.
- **Overlays:** page tree drawer, share sheet, embed picker (live task/project/goal/board/item), backlinks panel, version history.
- **States:** E, A, P, embed-no-access placeholder, conflict (concurrent edit).
- **Mobile:** tree as a drawer; read-first, edit with a full-screen editor.

### 2.25 Files & proofing (Phase 10; attachments in 3)
- **Surfaces:** project Files tab, attachment lists everywhere, `/files/[id]` preview, review panel.
- **Overlays:** upload progress, version upload, review decision.
- **States:** too large / wrong type, scanning/processing, P.

### 2.26 Finance & subscriptions (Phase 11)
- **Routes:** `/finance` (summary), `/finance/entries`, `/finance/budgets`, `/finance/subscriptions`, `/finance/categories`.
- **Overlays:** entry sheet (amount, currency, category, account, receipt), budget dialog, subscription sheet.
- **States:** E, over-budget, multi-currency notice, P (company finance).
- **Mobile:** quick-entry FAB; charts stacked.

### 2.27 Automations, workflows, playbooks, templates (Phase 12)
- **Routes:**
  - `/automations`, `/automations/[id]` (builder: WorkflowCanvas), `/automations/[id]/runs`, `/automations/[id]/runs/[runId]`
  - `/playbooks`, `/playbooks/[id]`
  - `/templates`
- **Overlays:** node config sheets (trigger/condition/action/approval/delay), test-run dialog, enable/disable confirm.
- **States:** draft, enabled, disabled (author lost access), failed run, loop guard tripped, E.
- **Mobile:** read-only canvas with a runs list; editing is desktop-first **[ASSUMPTION]**.

### 2.28 AI (Phase 13)
- **Surfaces:** inline "Summarize / Extract / Draft" actions on tasks, docs, chat and meetings; review-before-apply sheet; `/ai/agents`, `/ai/agents/[id]/runs`.
- **States:** pending job, failed, needs approval, provenance view.

### 2.29 Portfolio, roadmap, cycles/issues, risks/decisions (Phase 14)
- **Routes:**
  - `/portfolio`, `/portfolio/[id]`
  - `/roadmap`
  - `/projects/[id]/cycles`, `/projects/[id]/backlog`, `/projects/[id]/issues`
  - `/projects/[id]/risks`, `/decisions`
- **Overlays:** cycle planning drag panel, issue sheet (severity, environment, repro), risk dialog.
- **States:** agile disabled for the project (feature toggle), PD in portfolio.

### 2.30 Directory, resources, bookings, assets (Phase 14)
- **Routes:** `/directory`, `/directory/[userId]`, `/resources`, `/resources/[id]`, `/bookings`, `/assets`, `/assets/[id]`.
- **Overlays:** booking dialog with conflict feedback, asset assignment dialog.
- **States:** booking conflict, resource unavailable, asset retired (A).

### 2.31 CRM (Phase 14, optional module)
- **Routes:** `/crm/contacts`, `/crm/companies`, `/crm/leads`, `/crm/deals` (pipeline kanban), detail pages.
- **States:** module disabled for the workspace; E.

### 2.32 PWA / offline (Phase 15)
- **Surfaces:** install prompt, offline banner, sync status indicator, conflict resolution dialog ("Keep mine / Keep theirs / Merge").

---

## 3. Navigation plan

- **Rail (current):** Home · Planner · Projects · Team, with Settings and the theme toggle at the bottom.
- Modules join only when shipped (D7). Target grouping:
  - **Work:** Home, Planner, Calendar, Projects, Chat
  - **Life:** Habits, Goals, Focus
  - **Company:** Team, Requests, Docs, Dashboards
  - **More menu:** Finance, Forms, Automations, Portfolio, CRM, Assets, Resources, Bookings, Reports
- §78 "Tasks" as a primary area is served by `/planner/all` plus `/tasks/[id]`. Whether a separate table-style `/tasks` page is wanted: Q-PO-7.
- **Mobile tab bar:** Home · Planner · Calendar · Chat · More (the current bar shows Projects and Team until Calendar and Chat exist).
