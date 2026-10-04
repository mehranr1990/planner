# Component Inventory

Required by §95 (reuse before duplicating) and §90 (know every usage before changing a shared component).
- Raw hex colours are not allowed in components; use tokens.
- Before editing a shared component, check its **Used by** list and re-test those flows (QA.md, Regression).
- "Used by" was generated from the code on 2026-10-01; re-generate it with `grep -rlE "<Name[ >]" src` whenever this table is touched.

## 1. §95 reference names → our components

| §95 name | Ours | Status |
|---|---|---|
| AppShell | `AppShell` | ✅ |
| NavigationRail | `PrimaryNav` (desktop, in the header) + `MobileTabBar` (<1024px) — no side rail since the 2026-10-04 top-shell redesign | ✅ |
| TopBar | header inside `AppShell` | ✅ (to be extracted when contextual actions arrive, Phase 3) |
| PageHeader | `PageTitle` | ✅ (project detail uses a custom header; see §4) |
| Surface / Section / Card | `Panel` / `SectionHeader` / `Card`, `DarkCard` | ✅ |
| IconButton | `IconButton`, `IconLink` | ✅ |
| Avatar / AvatarGroup | `Avatar` / **`PeopleCluster`** (replaces `AvatarGroup`) | ✅ standard people pattern (DESIGN_SYSTEM §13) |
| StatusPill | `Chip` | ✅ (status semantics to be wrapped as `StatusPill` in Phase 3) |
| CommandMenu | — | Phase 6 |
| FilterBar | — (pill groups duplicated; see §4) | Phase 3 |
| TaskCard / TaskRow / TaskDetail / TaskComposer | — / `TaskRow`, `TaskList` / `TaskSheet` / `QuickAdd` | 🟡 (TaskCard for Board, Phase 3) |
| ProjectCard / ProjectHeader | `ProjectCard` / — | 🟡 (header Phase 3) |
| WorkflowNode / WorkflowCanvas | — | Phase 3 (dependencies), reused in 12 |
| Calendar / CalendarEvent | — | Phase 4 |
| HabitCard | — | Phase 5 |
| ProgressRing / Metric | `RingGauge` / `Metric` (+ `SegmentedBar`) | ✅ |
| CommentThread / ActivityFeed | — / inline list in `TaskSheet` | Phase 3 (extract `ActivityFeed`) |
| NotificationItem | — | Phase 6 |
| Message / ChatComposer | — | Phase 7 |
| DocumentEditor | — | Phase 10 (editor library decision Q-PO-9) |
| FormBuilder | — | Phase 9 |
| DashboardGrid / Widget | — | Phase 8 |
| EmptyState / ErrorState | `EmptyState` / `(app)/error.tsx` | 🟡 (inline `ErrorState` for widgets and sections: Phase 3) |

## 2. Primitives — `src/components/ui` (with usages)

| Component | File | Notes | Used by |
|---|---|---|---|
| `Button` | button.tsx | primary / secondary / ghost / danger; sm / md / lg; pill | error.tsx, settings-forms, auth-form, create-project, project-controls, task-sheet, undo-delete-banner |
| `ButtonLink`, `buttonClass` | button.tsx | | home, not-found, team |
| `IconButton` | button.tsx | `label` required | sheet close, dialog close |
| `IconLink` | button.tsx | | app-shell, rail, home (2× "open" links), project detail (back) |
| `Panel` | surface.tsx | level-1 panel | error, home, not-found, planner, projects, project detail, settings, team |
| `Card` | surface.tsx | level-2 | project detail |
| `DarkCard` | surface.tsx | one per view | home |
| `SectionHeader` | surface.tsx | | home, planner, projects, project detail, settings, team |
| `PageTitle` | surface.tsx | | planner, projects, settings, team |
| `EmptyState` | surface.tsx | | home, projects, team, task-list |
| `Metric` | surface.tsx | | home, planner, project detail, project-card |
| `Avatar` | avatar.tsx | one face: photo or initials on a stable pastel; ring per surface; count/status badge | team rows, account menu, task-sheet activity, (inside PeopleCluster) |
| **`PeopleCluster`** | people-cluster.tsx | **the** small-group-of-people pattern: overlap / spaced / strip, `+N`, badges, a11y group label | project card (allocation row), project detail header strip, task row, task sheet header, team header preview, home Next-up card |
| `people.ts` helpers | people.ts | `initialsOf`, `avatarTone`, `splitPeople` (pure, unit-tested) | Avatar, PeopleCluster |
| `SegmentedBar`, `RingGauge` | data-viz.tsx | `role=img` labels | project detail, project-card |
| `Chip` | data-viz.tsx | | home, project detail, settings, project-card, quick-add, task-sheet |
| `Dot`, `toneOf` | data-viz.tsx | | task-row (+ project pages via `toneOf`) |
| `Input`, `Textarea`, `Select`, `Field` | field.tsx | white pill fields, Select with inline-end chevron, label at start (DESIGN_SYSTEM §14) | settings-forms, auth-form, create-project, task-sheet |
| `Sheet` | sheet.tsx | `<dialog>` side/bottom sheet | task-sheet |
| `Dialog`, `DialogFooter` | dialog.tsx | centred `<dialog>` modal on a soft grey surface: title + round close + divider; footer = two equal pills (cancel / primary) | create-project, invite-dialog, create-team-dialog, role-editor-dialog |
| `ConfirmDialog` | confirm-dialog.tsx | destructive confirmation: title + reason + single danger action | member-actions (remove/deactivate/reactivate), sessions-list (revoke), invitations (revoke uses inline buttons, not this), archive-team-button, roles-manager (delete) |
| `PeoplePicker` | people-picker.tsx | permission-filtered member search; selection rendered via `PeopleCluster` | team-member-manager |

## 3. Shell and feature components (with usages)

| Component | Feature | Used by |
|---|---|---|
| `AppShell`, `PrimaryNav`, `MobileTabBar`, `ContextSwitcher`, `ThemeToggle`, `nav.ts` | shell | `(app)/layout.tsx` |
| `QuickAdd` | tasks | home, planner, project detail |
| `TaskList` → `TaskRow` | tasks | home, planner, project detail |
| `TaskSheet` | tasks | planner, project detail |
| `UndoDeleteBanner` | tasks | planner, project detail |
| `ProjectCard` | projects | home, projects |
| `CreateProjectButton` | projects | projects |
| `ProjectControls` | projects | project detail |
| `MemberRoleSelect` | workspace | team |
| `AuthForm` | auth | sign-in, sign-up |
| `PreferencesForm`, `CreateWorkspaceForm` | account | settings |

## 4. Duplication found (to consolidate before new pages; no code changed in this pass)

| Pattern | Where duplicated | Target component | When |
|---|---|---|---|
| ~~Circular icon link written as raw `<Link …>`~~ | home (2×), project detail (back) | `IconLink` | ✅ done in Phase 2a |
| Pill toggle groups | planner view tabs, planner scope chips, task-sheet repeat presets | `PillTabs` (navigation) + `SegmentedControl` (choice) | Phase 3 (FilterBar) |
| `<details>` dropdown menus | ContextSwitcher, Account menu | `Menu` (with arrow-key navigation) | Phase 3/6 |
| ~~Hand-rolled `<dialog>` modal~~ | create-project | `Dialog` | ✅ done in Phase 2a (sheet close also uses `IconButton`) |
| Native compact selects with local `pill` class | project-controls | `Select` size variant | Phase 3 |
| Activity list markup | task-sheet | `ActivityFeed` | Phase 3 |
| Project detail header | project detail page | `PageTitle` with `back` + `actions` props | Phase 3 |

§3 says to use shadcn/ui "as low-level primitives". The current primitives are hand-built, and no shadcn/Radix is installed. Menus, popovers, comboboxes and date pickers are where an accessible headless base pays off (Q-PO-10).

## 4b. Internationalization building blocks (I18N)

| Piece | File | Responsibility | Used by |
|---|---|---|---|
| `useFormat()` / `getFormat()` | `src/i18n/use-format.ts`, `get-format.ts` | locale-bound number/percent/date/time/relative-day formatting (Gregorian) | task row/list/sheet, quick add, project card/detail, home, planner |
| `localizeError(code)` | `src/i18n/errors.ts` | translates service/Zod error codes at the action boundary | all server actions |
| `LanguageSwitcher` | `features/auth/components/language-switcher.tsx` | signed-out language choice (cookie) | auth layout |
| `PreferencesForm` → Language | `features/account/components/settings-forms.tsx` | signed-in language (account + cookie), applies in place | settings |
| Primitives with built-in localization | `SectionHeader` (count), `Avatar`/`AvatarGroup` (badge, +N), `Sheet` (close label) | format numbers / labels via `useLocale` / `useTranslations` | everywhere |
| Data-viz a11y | `SegmentedBar ariaLabel`, `RingGauge ariaLabel` | callers pass a complete ICU-formatted description | project card/detail |

Component rules:
- No literal UI strings in components.
- Labels come from props or `useTranslations`.
- Enum → label mapping happens in components (`t(`status.${s}`)`).
- Logical CSS only.
- User content gets `dir="auto"`.

## 5. Planned shared components (by first phase that needs them)

| Component | Responsibility | Phase | Reused by |
|---|---|---|---|
| `PillTabs`, `SegmentedControl`, `FilterBar`, `SavedViewPills` | navigation, choice, filtering | 3 | planner, boards, requests, reports |
| `Menu`, `Popover`, `ContextMenu` | accessible menus | 3 | everywhere |
| `DatePicker`, `DateTimeRangePicker`, `RecurrenceEditor` | tz-aware pickers | 3/4 | tasks, events, habits, subscriptions |
| `TaskCard` | Board/Kanban card | 3 | project board, boards |
| `Kanban` | columns plus DnD (keyboard-accessible) | 3 | projects, boards, CRM pipeline |
| `WorkflowCanvas`, `WorkflowNode`, `Connector` | nodes plus curved SVG connectors for real relations | 3 | dependencies, timeline, automations, playbooks |
| `CommentThread`, `MentionInput` | comments with mentions | 3 | tasks, projects, docs, requests, meetings |
| `ActivityFeed` | append-only history display | 3 | all entities |
| `AttachmentList`, `Uploader` | file metadata plus upload | 3 | tasks, messages, meetings, requests, finance receipts |
| `StatusPill`, `PriorityFlag` | semantic chips | 3 | tasks, requests, approvals |
| `DataTable` → `RecordCards` | desktop table / mobile cards | 3 | team, boards, finance, requests |
| `ErrorState`, `PartialDataNotice`, `PermissionNotice`, `ArchivedBanner` | §80 states | 3 | all |
| `Toast` region | transient feedback | 3 | all |
| `CalendarGrid`, `CalendarEvent`, `AgendaList` | calendar views | 4 | calendar, project calendar, bookings |
| `TimerPill`, `FocusView` | time tracking | 4 | top bar, focus |
| `HabitCard`, `HabitLogPopover`, `StreakCalendar` | habits | 5 | habits, home, review |
| `GoalCard`, `KeyResultRow` | goals | 5 | goals, dashboards |
| `NotificationItem`, `AttentionList` | attention | 6 | attention, bell popover |
| `CommandPalette` | ⌘K over services | 6 | global |
| `Message`, `ChatComposer`, `ThreadPanel`, `ReactionBar` | chat | 7 | chat, project chat, meeting discussion |
| `DashboardGrid`, `Widget` | config-driven widgets | 8 | dashboards, home |
| `FieldRenderer`, `FieldEditor` | custom field types | 8 | boards, forms |
| `FormBuilder`, `FormRenderer` | forms | 9 | forms, request types, check-ins |
| `ApprovalPanel` | decision UI | 9 | requests, docs, finance, workflows |
| `DocumentEditor`, `LiveEmbed` | rich text plus live embeds | 10 | docs, meetings, journal, descriptions |
| `MoneyInput`, `CurrencyAmount` | decimal money | 11 | finance, subscriptions |
| `AiReviewSheet` | review-before-apply AI output | 13 | all AI actions |
| `SyncStatus`, `ConflictDialog` | offline | 15 | global |
