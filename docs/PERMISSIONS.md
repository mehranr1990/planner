# Permissions

All authorization is server-side. A request is allowed only when the **first applicable layer** grants it, evaluated in this order:

| Layer | Question | Where |
|---|---|---|
| L1 Personal ownership | Is this a PERSONAL object owned by the viewer? | `access.ts` per feature |
| L2 Workspace capability | Does the viewer's active membership role (or custom role) carry capability X? | `src/server/permissions/capabilities.ts` (pure, unit-tested) |
| L3 Object relationship | Is the viewer owner, creator, assignee, watcher, participant, member or lead of this object or its parent? | `access.ts` per feature |
| L4 Guest / external | Guests have **no** workspace-wide capability; only L3 grants on objects they were explicitly added to. External/public access (public forms, shared links) goes through a dedicated, scoped token path, never through a session. | per feature + token tables |

Universal rules:
- Unauthorized and nonexistent objects look identical (`NOT_FOUND`, same 404).
- Sharing one object never grants access to its container.
- Deactivated membership means no membership.
- Client-sent ids are matched against memberships and are never proof of access.
- AI agents and automations act **as a principal** (the user or a workspace service principal) and go through the same checks (§65).

---

## 1. Implemented

### 1.1 Capabilities × base roles (current code)

| Capability | Owner | Admin | Manager | Member | Guest |
|---|:-:|:-:|:-:|:-:|:-:|
| workspace.manage | ✓ | ✓ | | | |
| workspace.delete | ✓ | | | | |
| members.view | ✓ | ✓ | ✓ | ✓ | |
| members.invite | ✓ | ✓ | ✓ | | |
| members.manage, roles.manage, audit.view | ✓ | ✓ | | | |
| teams.manage | ✓ | ✓ | ✓ | | |
| projects.view_all, projects.edit | ✓ | ✓ | ✓ | | |
| projects.create | ✓ | ✓ | ✓ | ✓ | |
| projects.delete | ✓ | ✓ | | | |
| tasks.view_all, tasks.edit_any, tasks.delete | ✓ | ✓ | ✓ | | |
| tasks.create, tasks.assign | ✓ | ✓ | ✓ | ✓ | |
| chat.manage | ✓ | ✓ | | | |
| forms.manage, automations.manage, reports.view | ✓ | ✓ | ✓ | | |
| finance.view, finance.manage | ✓ | ✓ | | | |

Custom roles:
- A custom role's capability list **replaces** the base defaults. Unknown strings are dropped, and `workspace.delete` can never be granted.
- The role's `baseRole` sets the rank used for "who may manage whom".

Role management:
- No self role change.
- Non-owners act only on members of strictly lower rank and grant only lower roles.
- The last active owner is protected (in a transaction).
- Every change is audited.

### 1.2 Object rules (current code)

| Object | View | Edit | Delete |
|---|---|---|---|
| Task, PERSONAL | owner, assignee, watcher | owner, assignee | owner |
| Task, WORKSPACE | active member AND (tasks.view_all · owner · creator · assignee · watcher · project member · [non-guest ∧ project visibility WORKSPACE]) | tasks.edit_any · owner · creator · assignee · project LEAD/EDITOR | tasks.delete · creator · project LEAD |
| Project | PERSONAL: owner. WORKSPACE: projects.view_all · owner · member · [non-guest ∧ visibility WORKSPACE] | owner · projects.edit · LEAD | (archive = edit) |

Other current rules:
- Assigning requires `tasks.assign` plus edit rights.
- A task's scope follows its project; moving tasks across spaces is rejected.
- **[ASSUMPTION]** Personal-task assignees may edit (§12 "shared directly"). See Q-PERM-1.

---

## 2. Planned capability taxonomy

New capabilities are added to `CAPABILITIES` only when their phase ships. Default grants are proposals **[ASSUMPTION]**, to be confirmed in each phase's gate (§100).

O = Owner, A = Admin, Mg = Manager, M = Member, G = Guest.

| Capability | O | A | Mg | M | G | Phase |
|---|:-:|:-:|:-:|:-:|:-:|---|
| members.deactivate, guests.invite | ✓ | ✓ | | | | 2b |
| calendar.view_team | ✓ | ✓ | ✓ | | | 4 |
| time.view_team, time.edit_any | ✓ | ✓ | ✓ | | | 4 |
| goals.create (workspace/team goals) | ✓ | ✓ | ✓ | ✓ | | 5 |
| goals.manage_any | ✓ | ✓ | ✓ | | | 5 |
| checkins.manage (templates) | ✓ | ✓ | ✓ | | | 5 |
| search.workspace (implicit for members) | ✓ | ✓ | ✓ | ✓ | | 6 |
| chat.create_public, chat.create_private | ✓ | ✓ | ✓ | ✓ | | 7 |
| chat.manage (moderation, archive any, delete any) | ✓ | ✓ | | | | 7 |
| chat.dm (incl. guests in shared channels only) | ✓ | ✓ | ✓ | ✓ | (shared only) | 7 |
| boards.create, boards.manage_fields | ✓ | ✓ | ✓ | ✓ / | | 8 |
| dashboards.create_workspace | ✓ | ✓ | ✓ | | | 8 |
| reports.view (exists), reports.view_finance (requires finance.view) | ✓ | ✓ | ✓ | | | 8 |
| workload.view | ✓ | ✓ | ✓ | | | 8 |
| forms.manage (exists), forms.publish_public | ✓ | ✓ | ✓ | | | 9 |
| requests.submit | ✓ | ✓ | ✓ | ✓ | ✓ (if type allows) | 9 |
| requests.triage, requests.view_all | ✓ | ✓ | ✓ | | | 9 |
| request_types.manage, sla.manage | ✓ | ✓ | | | | 9 |
| approvals.policies.manage | ✓ | ✓ | | | | 9 |
| meetings.create | ✓ | ✓ | ✓ | ✓ | | 10 |
| docs.create_workspace, docs.manage_any | ✓ | ✓ | ✓ / ✓ | ✓ / | | 10 |
| files.manage_any | ✓ | ✓ | | | | 10 |
| finance.view, finance.manage (exist), finance.approve_expenses | ✓ | ✓ | | | | 11 |
| automations.manage (exists), automations.run_external | ✓ | ✓ | ✓ / | | | 12 |
| integrations.manage | ✓ | ✓ | | | | 12 |
| templates.publish_workspace | ✓ | ✓ | ✓ | | | 12 |
| ai.use | ✓ | ✓ | ✓ | ✓ | | 13 |
| ai.agents.manage, ai.policies.manage | ✓ | ✓ | | | | 13 |
| portfolios.view_all, portfolios.manage | ✓ | ✓ | ✓ | | | 14 |
| resources.manage | ✓ | ✓ | ✓ | | | 14 |
| bookings.create | ✓ | ✓ | ✓ | ✓ | | 14 |
| bookings.manage_any | ✓ | ✓ | ✓ | | | 14 |
| assets.view, assets.manage | ✓ | ✓ | ✓ / | | | 14 |
| crm.view, crm.manage | ✓ | ✓ | (crm.view) | | | 14 |

`✓ /` means the first capability is granted and the second is not.

---

## 3. Per-module rules by layer

**Calendar & time (Phase 4)**
- L1: personal calendars, blocks, timers and entries are visible only to the owner.
- L2: `calendar.view_team` shows free/busy only; titles are hidden unless L3 applies. **[ASSUMPTION]**
- L3: event attendees see the event; a task's time blocks follow the task's visibility, but block *time* is owner-private.
- L4: guests see only events they attend.
- Only the owner (or `time.edit_any`) edits time entries. The one-active-timer rule is enforced in the DB.

**Goals (Phase 5)**
- L1: personal goals are owner-only.
- L2: `goals.create`, `goals.manage_any`.
- L3: goal owner and team members (for team goals) edit progress. Linked projects/tasks are shown only if independently visible.
- L4: no guest access unless explicitly shared.

**Habits, routines, journal (Phase 5)**
- **Always personal.** No workspace capability reads them, including Owner/Admin.
- Team check-ins are the workspace-facing feature: L2 `checkins.manage` for templates; L3 respondents and the template audience see responses.

**Docs / wiki (Phase 10)**
- L1: personal docs.
- L2: `docs.create_workspace`, `docs.manage_any`.
- L3: page-level access (inherit from parent page or project; explicit share adds viewer/editor).
- L4: guests only on explicitly shared pages.
- Live embeds render each embedded entity with **its own** permission check: an unauthorized embed shows "No access", never the data.

**Meetings (Phase 10)**
- L3: participants and project members see the meeting; notes are editable by participants.
- Decisions are visible with the meeting/project.
- Action-item tasks follow task rules.

**Chat (Phase 7)**
- L2: create channels, `chat.manage`.
- L3: channel membership (private channels and DMs), project channels inherit project membership.
- L4: guests only in channels they are added to; they can't browse public channels **[ASSUMPTION]**.
- Converting a message to a task requires `tasks.create` in the target space, and the task links back to the message by reference. Viewers of the task who can't see the channel see "message unavailable".

**Forms (Phase 9)**
- L2: `forms.manage`, `forms.publish_public`.
- L4: a public form uses a slug token and rate limiting, and creates records only through the form's configured target. The submitter never gains read access beyond their own submission receipt.

**Requests (Phase 9)**
- L3: the requester sees their own requests; the assignee/team sees assigned ones.
- L2: `requests.triage` / `requests.view_all`.
- Internal comments are hidden from the requester **[ASSUMPTION]**.

**Approvals (Phase 9)**
- Only the designated approver decides. Viewing follows the source record.
- Nobody approves their own request when the policy forbids it.
- Decisions are append-only.

**Finance (Phase 11)**
- L1: personal finance is owner-only, always.
- Company finance requires `finance.view`; mutations need `finance.manage`.
- Expense approval uses Approvals with `finance.approve_expenses`.
- Never visible to plain members or guests (§26).
- Reports that include finance require `finance.view` in addition to `reports.view`.

**Dashboards & reports (Phase 8)**
- A dashboard is visible per its scope.
- **Every widget queries with the viewer's permissions**, so two viewers of one dashboard may see different numbers. A widget the viewer can't fully see shows a partial-data state (§80).

**Automation (Phase 12)**
- Authoring requires `automations.manage` in the target space.
- Runs execute as the **author's principal**, capped by the author's current permissions; if the author loses access, the automation is disabled. **[ASSUMPTION]**
- External actions need `automations.run_external` plus a connection configured with `integrations.manage`.

**AI (Phase 13)**
- `ai.use` is required.
- AI reads only what the invoking user can read; agents get an explicit tool allow-list and run as a principal.
- Writes to important data need human approval (§61, §65).
- AI output stores provenance.

**Portfolio (Phase 14)**
- `portfolios.view_all` / `manage`.
- Each project inside is shown only if visible to the viewer; aggregates over hidden projects are labelled as partial.

**Resources & bookings (Phase 14)**
- `resources.manage`, `bookings.create`, `bookings.manage_any`.
- A booking owner cancels their own booking.
- Exclusivity is enforced by the DB exclusion constraint, not the UI.

**Assets (Phase 14)**
- `assets.view` / `assets.manage`. The assignee sees their own assigned assets.
- Assignment history is read-only.

**CRM (Phase 14)**
- `crm.view` / `crm.manage`. Records are workspace-scoped and owned by a user; L3 adds the record owner and deal team.
- Off for guests.

**Directory (Phase 14)**
- `members.view`. The fields shown are governed by profile-visibility preferences; "current projects" lists only projects visible to the viewer.

---

## 4. Open permission questions

| ID | Question |
|---|---|
| Q-PERM-1 | Can assignees of a *personal* task edit it, or only complete it and comment? (Currently: edit.) |
| Q-PERM-2 | Default project visibility in a workspace. (Currently the create form defaults to WORKSPACE.) |
| Q-PERM-3 | Should Managers see company finance by default? (Proposed: no.) |
| Q-PERM-4 | Can guests see the member directory? (Currently: no.) |
| Q-PERM-5 | Team calendar: free/busy only, or titles too? |
| Q-PERM-6 | Automations when the author leaves or is demoted: disable, or transfer to a service principal? |
