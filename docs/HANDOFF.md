# Handoff — read this first

> **For Claude on a new machine.** This repository was built over several sessions with the product owner. This file states what was done, what is left, the rules that were agreed, and how to set the project up. It is loaded automatically through `CLAUDE.md`.
>
> - **Last updated:** 2026-10-03
> - **Current state:** Phase 2a complete, followed by a reference-alignment pass.
> - **Next step:** Phase 2b. **Do not start it without the product owner's explicit approval.**
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

Verified state at handoff:
- `npm run typecheck` ✅ · `npm run lint` ✅ · `npm test` **149/149** ✅ · `npm run build` ✅
- `npx playwright test` **38/38** ✅ (16 flows + 22 visual), with PW_CHANNEL=msedge on Windows

---

## 3. What is left (in order)

1. **Phase 2b — awaiting approval.**
   - **Scope:**
     - invitations: token, expiry, accept flow, email
     - remove or deactivate members
     - teams, guests and external collaborators
     - custom-roles UI and an audit-log view
     - settings split into the §6 sections
     - **in-app notification core** (generation with `dedupe_key`)
     - onboarding
   - **Blocked on decisions:** Q-PO-3 (onboarding content), Q-PO-4 (email provider), Q-PO-12 (Security section scope).
2. **Phase 3** — remaining task-engine items and projects:
   - planner deferrals: drag & drop, bulk actions, saved views, group/sort/filter
   - task people and metadata: assignee/watcher/participant UI, subtasks UI, labels
   - task details: comments + mentions, attachments (needs a storage provider, Q-PO-8), dependency UI, related tasks, reminders UI
   - project views: board, timeline, activity tab, sections, milestones, members management
3. **Phases 4–15:**
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

Requirements: **Node 22+** and npm. Docker isn't needed.

```bash
git clone https://github.com/mehranr1990/planner.git
cd planner
# copy the reference/ folder here manually (not in git)
npm install                      # runs `prisma generate` (client goes to src/generated, git-ignored)
cp .env.example .env             # local DB URLs
npm run db:dev                   # starts a local Postgres (Prisma dev / PGlite) on :51214 (+ shadow :51215)
npm run db:deploy                # applies prisma/migrations
npm run dev                      # http://localhost:3000
```

Checks:

```bash
npm run typecheck && npm run lint && npm test && npm run build
npx playwright install chromium  # if the CDN is blocked (it was, from Iran — HTTP 403), skip it and use PW_CHANNEL
PW_CHANNEL=msedge npm run test:e2e        # or PW_CHANNEL=chrome; 16 flows
PW_CHANNEL=msedge npm run test:visual     # 22 screenshots
```

**Visual baselines are per platform and browser** (`e2e/__screenshots__/<platform>-<browser>/`). Only `win32-msedge` is committed. On another OS or browser, run `npm run test:visual:update` once, **review the images**, and commit them as that platform's baseline.

Using a real PostgreSQL instead of PGlite: set `DATABASE_URL` (and `SHADOW_DATABASE_URL` for `migrate dev`), **remove `DATABASE_POOL_MAX=1`** from `.env`, then `npm run db:deploy`.

### Known pitfalls

- **PGlite (`prisma dev`) serves one connection** and every database name maps to the same store. That's why `.env` has `DATABASE_POOL_MAX="1"` and a separate shadow port. Don't run two apps against it at once, and don't open extra DB clients while the app is connected.
- **If PGlite wedges** ("Connection terminated unexpectedly", or "Lock file is already being held"):
  1. Run `npx prisma dev stop planner`.
  2. Check that the pid in `%LOCALAPPDATA%\prisma-dev-nodejs\Data\durable-streams\planner\server.json` is dead.
  3. Remove only the empty `server.lock.lock` directory.
  4. Run `npm run db:dev`.

  Data persists. E2E already guards against this (short pool idle timeout + teardown wait).
- **Prisma is pinned to 7.10.0:** npm `latest` pointed at an 8.0 RC. Prisma 7 needs `prisma.config.ts` and the `@prisma/adapter-pg` driver adapter.
- **Turbopack ignores `adjustFontFallback: false`.** The explicit font stack in `src/app/layout.tsx` exists because of this; don't "simplify" it back to the font variables.
- **Native date/time inputs** follow the browser's locale; dates are stored and shown in Gregorian (Jalali is Q-I18N-1).
- **The seed only touches e2e accounts:** E2E global setup deletes and recreates `@e2e.local` / `@e2e.test` accounts only.

---

## 6. Map of the code

```
src/app/(auth)/…            sign-in, sign-up (+ guest language switcher)
src/app/(app)/…             home, planner/[view], projects, projects/[id], team, settings, loading/error/not-found
src/components/ui/          button (IconButton/IconLink), surface, field, dialog, sheet, avatar, people-cluster, data-viz
src/components/shell/       app-shell, rail, mobile-tab-bar, context-switcher, theme-toggle, nav
src/features/<module>/      components/, domain/ (pure), server/{actions,service,access,queries}.ts
src/features/tasks/server/create.ts   the single task-creation core
src/server/                 db, auth/{session,password}, context (Viewer), permissions/capabilities, activity, errors, run-action
src/i18n/                   config, resolve, request (next-intl), messages registry, errors, use-format/get-format
src/lib/                    time (tz + calendar maths), format (Intl), cn, action-result
messages/{en,fa}/*.json     UI copy (10 namespaces)
prisma/                     schema.prisma + migrations (init includes hand-written CHECKs/partial indexes)
e2e/                        Playwright specs, support/ (seed, fixtures, test helpers), __screenshots__/
docs/                       permanent product + engineering documentation (start with this file)
reference/                  design + video references (git-ignored; copied manually)
```

---

## 7. Suggested first message on the new machine

> "Read docs/HANDOFF.md, verify the setup (typecheck, lint, test, build, E2E), and report status. Don't start Phase 2b yet."

Then wait for the product owner's approval before starting Phase 2b. Run the §100 gate first.
