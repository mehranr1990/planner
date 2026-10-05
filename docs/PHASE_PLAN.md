# Phase Plan

The granular 0–15 implementation plan is kept (§92). Section 2 maps the master spec's 14 conceptual areas onto it, so it's clear that no requirement was dropped. Every phase runs the §93 workflow and passes the §100 gate (section 4) before any code is written.

## 1. Implementation phases

| Phase | Scope | Status |
|---|---|---|
| 0 | Discovery, reference analysis, permanent docs | **Done** (2026-10-01). Gap: FFmpeg frame extraction (§1) not run because ffmpeg isn't installed; the pre-extracted frames and contact sheets were used |
| 1 | Foundation: tokens/primitives, shell, auth/sessions, tenancy, capability model, core schema + constraints, activity/audit | **Done** |
| 2 | Planner & task engine core: 8 views, quick add, sheet, recurrence, checklist, soft delete/undo, version conflicts, dependency service | **Done** (items deferred to Phase 3 are listed there) |
| 2i | **Internationalization foundation** (cross-cutting): next-intl, en + fa (RTL), resolution and persistence, catalogs for every built screen, error codes, Intl formatting, Persian typography, RTL audit | **Done** (2026-10-01) |
| 2a | **Quality-gate catch-up** (no new product features): shared `createTask` core (§91); all action logic → services (projects, workspace, account, auth) + shared `runAction`; in-repo Playwright E2E (16 flows) + visual baseline (22 shots); `IconLink`/`IconButton`/`Dialog` consolidation | **Done** (2026-10-01) |
| 2b | **Done** (2026-10-04). Workspaces completion: invitations (token, expiry, accept, email), remove/deactivate, teams, guests/external, custom-roles UI, audit view, settings split (§6), **notification service core** (generation + `dedupe_key`; in-app only), onboarding (4-step flow, see `docs/phases/PHASE_2b.md`), security settings (password change/reset, sessions), email-provider abstraction (Resend). Deferred with a reason: transfer ownership (→3), avatar upload (→3, Q-PO-8) | — |
| 3 | **Complete** (2026-10-05, batched — see `docs/phases/PHASE_3.md`; batches 1–6 done). Task engine completion + projects + collaboration primitives: assignees/watchers UI, subtasks, labels/tags, dependency UI, comments + mentions → notifications, **reminders (model + UI + delivery — pulled forward ahead of Phase 4, narrowly scoped, see `docs/HANDOFF.md` §2a)**, notification execution audit + **notification inbox (pulled forward ahead of Phase 6)**, activity hardening, **planner delegated view/DnD/bulk/filters (batch 4, see `docs/HANDOFF.md` §2b; board-column DnD and subtask-reorder UI carried to batch 5)**; board, timeline, milestones (batch 5, `docs/HANDOFF.md` §2c); **attachments (Vercel Blob), avatar upload, transfer ownership (batch 6, final — `docs/HANDOFF.md` §2d)**. | Closed (Q-PO-8, Q-PO-17 resolved 2026-10-04) |
| 4 | Calendar (D/W/M/Agenda), events, time blocks, timers (one active), focus, time entries, **generic background job runner** (SLA breaches, habit prompts, subscription charges, automations, AI jobs, email delivery — reminder delivery itself already shipped in Phase 3 batch 3, narrowly, not via this table), project Calendar tab | |
| 5 | Habits (6 types), routines, journal, check-ins, goals/OKR, daily/weekly plan & review | |
| 6 | Attention centre, notification **preferences + email channel** (the in-app inbox UI itself shipped in Phase 3 batch 3), global search, command palette, quick capture + web clipper + email-in (non-AI) | |
| 7 | Chat (all §42 capabilities), message → work (§43), project Chat tab, async updates/announcements (§56), calls provider integration (§45) | |
| 8 | Boards / item types / custom fields (incl. relation, mirror, safe formula), dashboards, reports, workload | |
| 9 | Forms, requests + types, SLA engine + business calendar, generic approvals | |
| 10 | Meetings, decisions, docs/wiki, live docs, Files hub (project tab), proofing | |
| 11 | Finance (Decimal), budgets, subscriptions, finance reports, expense approvals | |
| 12 | Automation engine, workflow builder, playbooks, templates, integration layer, webhooks | |
| 13 | AI: jobs + provenance, AI fields, smart capture (OCR/extraction with review), summaries, suggestions, AI workflow nodes, scoped agents | |
| 14 | Company ops: portfolios, roadmap/releases, cycles/backlog/issues, risks, directory, resources, bookings, assets, CRM module | |
| 15 | PWA/offline (cache, queue, conflicts), hardening: rate limiting, CSP, accessibility audit, performance budgets, security review | |

## 2. Master area → implementation phase mapping (§92)

| # | Master area | Phase(s) | Included | Deferred (with destination) | Depends on |
|---|---|---|---|---|---|
| 0 | Foundation | 0, 1, 2a | stack, layering, tokens, shell, docs, tests, CI-ready checks | E2E harness → 2a; PWA → 15; frame extraction (§1) → needs ffmpeg (Q-PO-11) | — |
| 1 | Auth & Identity | 1, 2b, 6, 15 | sign-up/in/out, DB sessions, profile/tz/theme/week start | settings split, sessions list, avatar upload → 2b; notification prefs → 6; Security section (password change/reset, 2FA?) → 2b/15 (Q-PO-12); connected services → 12 | email provider (Q-PO-4) |
| 2 | Workspaces | 1, 2b, 14 | create, switch, roles, capability model, audit, member list | invites, remove/deactivate, teams, guests, external, custom-roles UI, audit view → 2b; team directory → 14 | notification core (2b) |
| 3 | Core Data Models | 1, then each phase | scoped core schema with constraints | each module's entities migrate in their own phase (DATA_MODEL §5); shared infra (comments, attachments, mentions, reactions, activity) → 3; custom fields/relations → 8 | — |
| 4 | Planner UI | 2, 3 | 8 views, quick add, grouping by date, space filter | DnD, bulk, saved views, sort/group/filter controls → 3 | Phase 2 |
| 5 | Task Engine | 2, 3, 4 | fields, completion, recurrence, checklist, delete/restore, version, dependencies (service) | participants, assignees UI, subtasks UI, labels, start time, related, attachments, comments, mentions, reminders, estimate/actual time (→ 4), duplicate/move/archive UI → 3 | files (3), jobs (4) |
| 6 | Project Management | 3, 7, 10, 14 | list, detail, status/health, archive | tabs Board/Timeline/Activity/members → 3; Calendar tab → 4; Chat → 7; Files/Docs → 10; portfolios, roadmap, releases, agile, issues, risks → 14; Workload/Progress views → 8 | 3, 4 |
| 7 | Calendar & Time | 4, 5 | — | calendar, blocks, timers, focus → 4; daily/weekly planning → 5; bookings on calendar → 14 | job runner (4) |
| 8 | Habits & Life | 5 | — | habits, routines, journal, check-ins → 5 | calendar (4) for habit display |
| 9 | Finance | 11 | — | finance, budgets, subscriptions → 11 | approvals (9), files (3) |
| 10 | Collaboration | 3, 6, 9, 10, 14 | activity infra | comments/mentions/watchers/reactions/attachments → 3; attention/notifications/search/command/capture → 6; forms/requests/SLA/approvals → 9; meetings/docs/files/proofing → 10; directory/resources/bookings/assets → 14; async → 7 | notification core (2b) |
| 11 | Chat | 7 | — | all of §42, §43, §45 integration → 7 | real-time provider (Q-PO-5) |
| 12 | Goals / Dashboards / Reports | 5, 8 | — | goals → 5; dashboards, reports, workload → 8 | 5, 8 |
| I18N | Internationalization (cross-cutting, PRODUCT_SPEC P) | 2i, then every phase | locale infra, catalogs, RTL, formatting, Unicode storage | currency/duration helpers → 4/11; localized emails → 2b/6; Unicode search → 6; Persian NLP → decision | — |
| 13 | Automation / AI / Advanced | 12, 13, 14, 15 | — | automation/workflows/playbooks/templates/integrations → 12; AI → 13; CRM and company ops → 14; offline → 15 | job runner (4), approvals (9) |

Sections §0–§2 and §86–§100 are process requirements; they apply to every phase (QA.md, ACCEPTANCE_CRITERIA.md). The per-§ trace is in COVERAGE_MATRIX.md → Spec traceability.

## 3. Per-phase workflow (§93)

Each phase produces a short `docs/phases/PHASE_<n>.md`. Its sections follow the §93 steps; each section links back into the permanent docs rather than duplicating them.

| Step | Output |
|---|---|
| A | Read PRODUCT_SPEC, ARCHITECTURE, DATA_MODEL, PERMISSIONS, COVERAGE_MATRIX |
| B | Module specification |
| C | Page inventory entries (PAGE_INVENTORY §2 block made exact) |
| D | Data model diff + migration plan |
| E | Permission matrix rows |
| F | Server / domain operations (service function list) |
| G | Component list (reuse first, COMPONENT_INVENTORY) |
| H | Backend / domain |
| I | UI |
| J | Loading / empty / error / mobile / permission / archived states |
| K | Tests (QA §2 risk matrix) |
| L | typecheck · lint · test · build |
| M | Manual + visual pass (§88) |
| N | Docs + coverage matrix |
| J+ (I18N) | Catalog entries for every new string (all locales), RTL pass on desktop + mobile, Intl formatting; DoD D21–D23 |

## 4. Pre-implementation gate (§100), a checklist per phase

1. Audit the relevant code (reusable services and components; duplication).
2. Re-read the relevant spec sections (via the traceability table).
3. Check the coverage matrix rows for the phase.
4. Check the page inventory block.
5. Check the data model (planned entities + open questions).
6. Check the permission taxonomy.
7. List reusable components and services.
8. List missing functionality.
9. List architectural risks.
10. List required migrations (expand/backfill/contract).
11. List unclear business requirements, then raise them as Q-items. **Do not invent answers.**
12. Write and approve `PHASE_<n>.md`.

## 5. Open decisions (product owner)

### Product (Q-PO)

| ID | Decision | Blocks |
|---|---|---|
| Q-PO-1 | Product name and brand (currently "planner" with an original mark) | polish |
| Q-PO-2 | Lufga licence (one-line swap) | polish |
| ~~Q-PO-3~~ | Onboarding content and steps — **resolved 2026-10-03**: 4-step flow (setup info → usage context → workspace setup, skipped if arriving via invitation → first action, skippable), never permanently limits functionality. Full flow in `docs/phases/PHASE_2b.md` | — |
| ~~Q-PO-4~~ | Email provider — **resolved 2026-10-03**: Resend for prod/staging, console/fake adapter for dev/test, behind an `EmailProvider` abstraction (domain code never imports Resend directly; see ARCHITECTURE.md D14) | — |
| Q-PO-5 | Real-time transport (chat, presence, typing, live updates) | 7 |
| Q-PO-6 | Naming: "Attention"/"Activity" vs Planner "Inbox" (§10 vs §46 both say Inbox) | 6 |
| Q-PO-7 | Separate table-style `/tasks` area (§78) in addition to Planner "All tasks"? | 3 |
| ~~Q-PO-8~~ | File storage provider — **resolved 2026-10-04: Vercel Blob**, behind a small swappable adapter interface | — |
| Q-PO-9 | Rich-text editor library and sanitiser (descriptions, comments, docs, journal) | 3 |
| Q-PO-10 | Adopt shadcn/Radix for complex primitives (spec §3) or keep hand-built? | 3 |
| Q-PO-11 | Install ffmpeg for the §1 frame-extraction step, or accept the provided frames | 0 |
| ~~Q-PO-12~~ | Security section scope — **resolved 2026-10-03**: change password, forgot/reset password, active-sessions list (view/revoke-one/revoke-all-others) are in scope for 2b. 2FA/TOTP, passkeys/WebAuthn, recovery codes, trusted devices, login history, IP intelligence and suspicious-login detection are explicitly **not** in 2b and are not yet defined by the product spec (do not invent, §98). Email-address change stays a future decision | — |
| Q-PO-13 | Background-job runtime on Vercel (Cron + DB queue, or an external queue) — **partially resolved 2026-10-04 for reminders only**: Vercel Cron + an idempotent DB claim on the `Reminder` row itself (Phase 3 batch 3, see `docs/HANDOFF.md` §2a). Still open for Phase 4's other consumers (SLA, habits, subscriptions, automations), which may need the fuller generic `Job` table this doesn't attempt to build | 4 |
| Q-PO-14 | Calls/video provider | 7 |
| Q-PO-15 | Search engine: Postgres FTS (proposed) vs external | 6 |
| ~~Q-PO-16~~ | `@playwright/test` adopted (Phase 2a) | — |
| ~~Q-PO-17~~ | Delegated work — **resolved 2026-10-04: yes**, a 9th planner view "Delegated" (owned by viewer, assigned to someone else, not done) | — |

### Internationalization (Q-I18N)

| ID | Decision | Blocks |
|---|---|---|
| Q-I18N-1 | Show the Jalali (Solar Hijri) calendar for `fa`? Currently Gregorian everywhere, matching native date inputs and stored dates. It would need a custom date picker | 4 (calendar) |
| Q-I18N-2 | Persian Quick Add grammar (فردا، ساعت ۹، !فوری …)? Needs a spec plus tests; the English parser stays untouched | 3+ |
| Q-I18N-3 | Next locales (e.g. ar, de) and who supplies or reviews translations | — |
| Q-I18N-4 | Localized timezone names (no Intl API for zone names; would need CLDR data) | polish |
| Q-I18N-5 | Persian digits everywhere (current Intl default for `fa`) or Latin digits as a user option? | polish |

### Data model (Q-DM-1 … Q-DM-8)

Listed in DATA_MODEL.md §7.

### Permissions (Q-PERM-1 … Q-PERM-6)

Listed in PERMISSIONS.md §4.

### Assumptions already in code (confirm or override)

| ID | Assumption | Where |
|---|---|---|
| AS-1 | "Today" includes overdue items; a timed task whose time has passed today counts as overdue | queries.ts |
| AS-2 | Monthly "31st" skips short months (RFC 5545); "-1" means the last day | recurrence.ts |
| AS-3 | Next occurrence copies fields from the completed occurrence | service.ts |
| AS-4 | "My work" = assigned to me, or owned by me with no assignees | queries.ts |
| AS-5 | Personal-task assignees can edit | access.ts (Q-PERM-1) |
| AS-6 | The workspace project create form defaults to WORKSPACE visibility | create-project.tsx (Q-PERM-2) |
| AS-7 | "later" is treated as the someday keyword only as the final word | quick-add.ts |
