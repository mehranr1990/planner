# Architecture

## Stack

| Concern | Choice | Notes |
|---|---|---|
| Framework | Next.js 16.3 App Router, React 19.2, TypeScript strict | Turbopack; `proxy.ts` (not middleware) |
| Database | PostgreSQL via Prisma 7.10 + `@prisma/adapter-pg` | Client generated to `src/generated/prisma` (git-ignored) |
| Validation | Zod 4 | Every server action parses its input |
| Styling | Tailwind CSS 4, semantic tokens in `src/app/globals.css` | No component library; primitives in `src/components/ui` |
| Icons | lucide-react | |
| Tests | Vitest 5 (unit + DB integration) | |
| Dates | `src/lib/time.ts` on `Intl` | No date library |
| Auth | Own email/password, scrypt (`node:crypto`), DB sessions | No auth dependency |

Packages are added only when a feature needs them. Prisma is pinned to 7.10.0 because npm's `latest` tag points at an 8.0 RC.

## Layers

```
app/ (routes)            → reads params, calls queries, renders. No business rules.
features/<x>/components  → client/server UI for one feature. Uses DTOs from features/<x>/types.ts only.
features/<x>/server/actions.ts   "use server": Zod-validate → getViewer() → service → runAction() (revalidate + localize)
features/<x>/server/service.ts   business rules + transactions (reused by future command palette, automations, AI)
features/<x>/server/queries.ts   read models → DTOs (Prisma rows never reach the client)
features/<x>/server/access.ts    object-level authorization (visibility + edit/delete predicates)
features/<x>/domain/*            pure logic, no I/O, unit-tested (recurrence, schedule, parser, cycles)
server/permissions               central capability model (pure)
server/context.ts                Viewer = session user + active memberships → WorkspaceActor
server/auth                      password hashing, sessions
server/db.ts                     single Prisma client
lib/                             framework-agnostic helpers (time, cn, ActionResult)
```

Rules:
- Every server module imports `server-only`.
- Client components import only `types.ts`, `domain/*` (pure) and server actions.
- Authorization happens in `access.ts` and `capabilities.ts`, never in the UI. The UI only reflects the `canEdit`/`canDelete` flags the server computes.
- Unauthorized and nonexistent objects return the same `NOT_FOUND` message and the same `notFound()` page.

## Request flow

1. `src/proxy.ts` redirects requests without a cookie to `/sign-in?next=…` and slides the cookie expiry. It only performs an optimistic check.
2. `getSessionUser()` (memoized per request with React `cache`) hashes the cookie token, loads the session, and rejects expired or deactivated users.
3. `getViewer()` resolves active memberships into `WorkspaceActor`s.
4. Queries compose `visibleTasksWhere(viewer)` / `visibleProjectsWhere(viewer)` with the view filter, so tenant scoping is never left to the caller.

## Mutations

- Validated with Zod. Ids come from the session, never from the client.
- Multi-row writes run in `db.$transaction`.
- **Optimistic concurrency:** `Task.version` is checked in `updateMany WHERE version = expected`; a stale write gets `CONFLICT`.
- **Idempotency:**
  - Quick add sends a client UUID (`clientMutationId`), which is unique per creator.
  - Recurrence generation is protected by `UNIQUE(series_id, occurrence_on)` and `createMany … skipDuplicates`.
  - Completion toggles are no-ops when the task is already in the requested state.
- Activity (user-facing) and AuditEvent (compliance) are append-only.

## Time

- `CalendarDate` strings (`YYYY-MM-DD`) are used for floating dates. UTC `Date` is used for instants.
- A timed task stores `dueAt` and also the derived local `dueOn`, so every planner view uses one indexed column.
- "Today" is computed in the user's timezone on the server. DST gaps shift forward; overlaps take the earlier instant. Both cases are tested.

## Shared services (§91) — one implementation per concern

Every entry point (planner, project, calendar, chat, meeting, forms, capture, automation, AI, command palette, recurrence, playbooks) calls these. None of them re-implements one.

| Concern | Service (current / planned) | Status |
|---|---|---|
| Task creation | **`features/tasks/server/create.ts` → `createTask(tx, NewTaskInput)`**. It is the only code that inserts task rows. Quick Add (parse → normalize → core) and recurrence (next occurrence → normalize → core) both use it. See "Task creation core" below | ✅ Phase 2a |
| Task mutation | `updateTask`, `setTaskCompletion`, `setTaskRecurrence`, `softDeleteTask`, `restoreTask`, `addDependency`, checklist, `moveTaskToSection` (board) | ✅ |
| Manual ordering / ranking | `features/tasks/domain/ranking.ts` (`rankBetween`/`needsRebalance`/`reseedRun`) — pure fractional-index math, DB-free. Three consumers, each with its own thin bounded-rebalance wrapper over the table it orders (not a shared wrapper function, since each wraps a different Prisma model): `tasks/server/service.ts`'s `computeRankInScope` (task reorder + board-card move), `projects/server/sections.ts` (board columns), `milestones/server/service.ts` (milestone ordering) | ✅ Phase 3 batch 4 (tasks), batch 5 (sections, milestones) |
| Project / workspace / account / auth mutations | `features/{projects,workspace,account,auth}/server/service.ts` | ✅ Phase 2a |
| Action boundary | `src/server/run-action.ts` (`runAction`, `invalidInput`): revalidate + localize `DomainError` codes; `src/server/errors.ts` (`DomainError`) | ✅ Phase 2a |
| Permissions | `server/permissions/capabilities.ts` + `features/*/server/access.ts` | ✅ |
| Activity / audit | `server/activity.ts` (`recordActivity`, `recordAudit`) | ✅ |
| Notifications | `server/notifications.ts` — `notify(tx, {recipient, type, entity, dedupeKey})` (single) + `notifyMany(tx, recipientIds, {…, dedupeKeyFor})` (fan-out, added Phase 3 batch 3). Preferences (`NotificationPreference`) still unused — Phase 6 | Phase 2b core; `notifyMany` + in-app inbox UI (`features/notifications/*`, `NotificationBell`) Phase 3 batch 3 |
| Comments / mentions / reactions / watchers | `features/collaboration/server/*` (one for all parent types) | Phase 3 |
| Files | `server/files/*` (provider adapter + `Attachment` service; access = parent access) | Phase 3 |
| Approvals | `features/approvals/server/service.ts` (generic source refs) | Phase 9 |
| Search indexing | `server/search/index.ts` — each module registers an indexer | Phase 6 |
| Jobs | `server/jobs/*` (see below) | Phase 4 |
| AI | `server/ai/*` — jobs + provenance, never called during render | Phase 13 |

## Task creation core (§91, Phase 2a)

```
caller (authorizes + normalizes)              core (invariants, inside caller's transaction)
─────────────────────────────────            ───────────────────────────────────────────────
Quick Add:  parseQuickAdd → normalizeSchedule ┐
Project:    (same, source PROJECT)            │
Recurrence: nextOccurrence → normalizeSchedule┼→ createTask(tx, NewTaskInput) → { id, created }
Future: calendar, chat, meeting, form,        │    • scope from the project when one is given
        capture, automation, AI, playbook,    │    • INSERT … ON CONFLICT DO NOTHING on
        duplicate                             ┘      (creator, clientMutationId) and (series, occurrenceOn)
                                                     → existing task returned, transaction intact
                                                   • assignees + labels copied
                                                   • Activity "created" | "recurred" with
                                                     data.source (+ ref) — no migration needed
```

Rules:
- The core never parses text and never checks permissions; callers do both.
- `NewTaskInput.schedule` is a `StoredSchedule` from `normalizeSchedule`, the single scheduling normalizer.
- Source kinds: `QUICK_ADD, PROJECT, CALENDAR, CHAT, MEETING, FORM, CAPTURE, AUTOMATION, AI, PLAYBOOK, DUPLICATE, RECURRENCE`.
- Source metadata currently lives on the creation Activity row. A queryable `TaskSource` link table is Q-DM-6.

## Background jobs (generic runner planned, Phase 4; reminders shipped narrowly in Phase 3)

These features need deferred or scheduled work:
- ~~reminders~~ — **done (Phase 3 batch 3)**, narrowly: see below, not via the generic table
- due-soon and overdue notifications (beyond the per-reminder `TASK_DUE_SOON` that batch 3 added)
- invitation expiry
- habit and check-in prompts
- SLA breach detection
- subscription charges
- scheduled automations and delays
- email delivery
- AI jobs
- search re-indexing

Design (still Phase 4, for everything above except reminders): a DB `Job` table (`run_at`, `dedupe_key UNIQUE`, attempts, status), claimed with `FOR UPDATE SKIP LOCKED` by a Vercel Cron-triggered route (or an external worker; Q-PO-13 — now partially resolved, see below). Handlers are idempotent; retries use backoff.

**Reminders (Phase 3 batch 3, shipped ahead of this table):** `features/reminders/server/engine.ts`'s `deliverDueReminders()`, triggered by `vercel.json`'s `/api/cron/reminders` entry. Deliberately does **not** use the generic `Job` table above — a `Reminder` row's own `delivered_at` *is* the claim (`UPDATE … WHERE delivered_at IS NULL` inside the same transaction as the notification insert; two workers racing the same row simply leaves one of them affecting zero rows — no `FOR UPDATE SKIP LOCKED` needed at this scale). This resolves Q-PO-13 for reminders specifically (Cron + an idempotent per-row DB claim); the other consumers in the list above still await the fuller `Job` table once there's more than one kind of scheduled work to generalize over. Full design and the due-date-interaction policy: `docs/HANDOFF.md` §2a.

## Testing layers (§86, §87)

- **Unit:** pure `domain/*` and `server/permissions`.
- **Integration:** services against a real Postgres (`src/server/__tests__`); required wherever DB constraints, transactions or permissions matter.
- **E2E:** Playwright (`e2e/`, `playwright.config.ts`) against a production build of the app, with deterministic seeded fixtures. See README → End-to-end tests and QA §3.
- **Visual:** `e2e/visual.spec.ts`. 22 baselines (desktop 1440×960 and mobile 390×844 × en/fa × light/dark) stored per platform and browser under `e2e/__screenshots__/`.

## Regression rule (§90)

Before changing a shared component or service:
1. Check COMPONENT_INVENTORY "Used by" (or grep).
2. Prefer additive props and new functions over changed semantics.
3. Re-run the dependent flows (QA §4).

## Internationalization (I18N)

| Piece | Where | Notes |
|---|---|---|
| Library | `next-intl` 4, without locale routing | Server and Client Components; ICU messages; typed keys |
| Locale registry | `src/i18n/config.ts` | `LOCALES`, `directionOf`, `LOCALE_NAMES` (endonyms), cookie name |
| Resolution | `src/i18n/resolve.ts` (pure, unit-tested) | user → cookie → Accept-Language → `en` |
| Request config | `src/i18n/request.ts` | the **only** place a request's locale is decided; also sets the formatter timezone |
| Catalogs | `messages/<locale>/<namespace>.json` (10 namespaces) | assembled by `src/i18n/messages.ts`; `fa satisfies Messages` makes a missing key a type error |
| Types | `src/global.d.ts` | `AppConfig` augmentation, so every `t("…")` key is compile-checked |
| Errors | `src/i18n/errors.ts` | services and Zod schemas emit codes; actions call `localizeError(code)` |
| Formatting | `src/lib/format.ts` (pure) + `useFormat()` / `getFormat()` | Gregorian calendar forced; explicit locale, so server and client output match |
| Root layout | `src/app/layout.tsx` | `<html lang dir>`, `NextIntlClientProvider`, per-direction font stack |
| Language switch | Settings (account + cookie), auth pages (cookie) | `router.refresh()` re-renders in place: same route, workspace and session |

Rules:
- Never translate in services, domain, permissions or the DB.
- Never read `navigator.language`.
- Never concatenate translated fragments.
- User content gets `dir="auto"`.

To add a locale:
1. Add it to `LOCALES` (and `RTL` if it's right-to-left).
2. Create `messages/<locale>/` with every namespace.
3. Register it in `messages.ts`.

The catalog tests enforce key and placeholder parity.

The Quick Add parser (`features/tasks/domain/quick-add.ts`) recognises English keywords only, by design (I18N-12). A future `parseQuickAdd(input, today, locale)` dispatcher can add per-locale grammars without touching the English one.

## Database (Neon)

There is no local database process — PGlite was used through Phase 2b and has been fully retired (2026-10). Every environment is a [Neon](https://neon.tech) Postgres branch:

| Environment | Neon branch | How it gets its connection |
|---|---|---|
| Production | the project's production/main branch | Vercel ↔ Neon integration injects `DATABASE_URL` + `DATABASE_URL_UNPOOLED` for the Production deployment |
| Preview | one branch **per** Vercel Preview deployment, created automatically | same integration, scoped to that deployment only |
| Development | a long-lived personal/shared dev branch | developer's own `.env` (not committed) |
| Test / CI | a dedicated, disposable test branch | CI secrets (`NEON_TEST_DATABASE_URL`, `NEON_TEST_DIRECT_URL`); never Production or another deployment's Preview branch |

Two connection strings matter, and they are not interchangeable:
- **`DATABASE_URL`** — Neon's **pooled** endpoint (hostname contains `-pooler`). The application runtime uses only this, via `@prisma/adapter-pg` in `src/server/db.ts`.
- **`DIRECT_URL`** (or `DATABASE_URL_UNPOOLED`) — the **unpooled** endpoint. Only `prisma.config.ts` (the Prisma CLI — migrate, db pull, studio) uses this. Resolution order: `DIRECT_URL` if explicitly set, else `DATABASE_URL_UNPOOLED`. **There is no fallback to `DATABASE_URL`** — if neither direct variable is set, the CLI fails closed with a clear error rather than silently migrating through the pooler. `prisma generate` is the one CLI command that needs no connection at all (it only reads `schema.prisma`), so a fresh `npm install` never fails just because the environment isn't configured yet.

**Critical for Preview isolation:** do not set a manual `DIRECT_URL` Vercel environment variable scoped to Preview (or ideally at all). The Neon integration already injects a fresh `DATABASE_URL_UNPOOLED` per Preview deployment, pointing at that deployment's own branch; a manually-set `DIRECT_URL` would silently override it and point every Preview's migrations at the wrong (e.g. Production) branch. Reserve `DIRECT_URL` for contexts the integration doesn't manage — local `.env`, CI secrets.

`@prisma/adapter-pg` (the plain `pg` driver adapter) was kept rather than switching to `@prisma/adapter-neon`/`@neondatabase/serverless`/Prisma Accelerate — Neon's pooled endpoint speaks standard Postgres wire protocol over TCP, so the existing adapter works unchanged; the provider becoming "hosted" is not, by itself, a reason to change the client architecture.

```
npm install                 # postinstall → prisma generate (no DB connection needed)
cp .env.example .env        # DATABASE_URL + DIRECT_URL for your Neon Development branch
npm run db:deploy           # prisma migrate deploy, against DIRECT_URL
npm run dev
npm test                    # unit always; DB integration whenever DATABASE_URL is set
```

Running `prisma migrate dev` (to author new migrations) still works locally against a personal Neon branch; set `SHADOW_DATABASE_URL` to a second, disposable database/branch for its shadow-DB step. It is never used by `migrate deploy`, which is what every hosted environment runs.

### Test/CI safety

Nothing may run destructive setup/cleanup without `APP_ENV=test` — checked in `e2e/support/global-setup.ts` before seeding, and `VERCEL_ENV=production` is an absolute, unconditional refusal in both that file and `src/server/__tests__/helpers.ts`. `playwright.config.ts` sets `APP_ENV=test` by default for local convenience; CI sets it explicitly next to the test-branch secret, so the decision stays visible in the workflow file (`.github/workflows/ci.yml`) rather than being implicit.

## Deployment (Vercel + Neon)

```
GitHub → push → Vercel → Next.js → Prisma 7 → Neon Postgres
```

- `vercel.json` sets the build command to `npm run vercel-build`, which runs `prisma migrate deploy` (against that deployment's own Neon branch, via `DIRECT_URL`/`DATABASE_URL_UNPOOLED`) and then `next build`. A failed migration fails the build — the app is never deployed against a schema it doesn't match, and nothing auto-repairs or resets Production.
- Migrations follow the existing expand → backfill → contract policy (§85) for breaking changes; `migrate deploy` only ever applies forward, never resets or drops.
- No filesystem state, no custom server — every module must work correctly across many concurrent, independently-warmed Vercel function instances (no assumption of one process, one long-lived connection, or shared in-memory state).
- `GET /api/health` runs `SELECT 1` through Prisma and returns `{status: "ok"}` or a 503, revealing nothing about the connection itself — safe to leave reachable for uptime monitoring.
- Production deploys never run a demo/seed script. Development/test fixtures are a separate, explicit path (`e2e/support/seed.ts`, gated as above).

## Decisions log

| # | Decision | Why |
|---|---|---|
| D1 | `src/` layout, feature folders | Spec §3; the scaffold was empty, so moving was free |
| D2 | DB sessions over JWT | Instant revocation; matches audit needs |
| D3 | Scope column + CHECK constraint on every scoped table | Personal/workspace confusion becomes impossible at DB level |
| D4 | Each recurring occurrence is its own row | Spec §11: completion history is never overwritten |
| D5 | Project decides task scope | A client-supplied context can't move a task across tenants |
| D6 | Plus Jakarta Sans | Lufga is commercial; it's a one-line swap |
| D7 | Navigation lists only shipped modules | No dead links or placeholder pages |
| D9 | next-intl without `[locale]` routing; locale from account → cookie → header | Clean authenticated URLs (I18N-2); a single server-side resolution keeps hydration consistent |
| D10 | Services emit error codes; translated at the action boundary | Domain stays language-neutral (I18N-7) |
| D12 | One `createTask` core with source metadata on the creation activity | §91 without a migration; future link table (Q-DM-6) is additive |
| D13 | E2E fixtures seeded with plain SQL in Playwright global setup | Prisma's ESM client doesn't load in Playwright's TS runtime; uses the raw `pg` client instead (D15: no longer about a single-connection database, Neon supports many) |
| D15 | Kept `@prisma/adapter-pg` over `@prisma/adapter-neon`/Accelerate when moving to hosted Neon (2026-10) | Neon's pooled endpoint speaks plain Postgres over TCP; the provider becoming hosted isn't a reason to change the client architecture |
| D11 | Explicit per-direction font stack built in the root layout | next/font's fallback faces (local Arial, U+0-10FFFF) otherwise capture the other script's glyphs, and Turbopack ignores `adjustFontFallback: false` |
| D8 | Own primitives instead of shadcn/ui (spec §3 lists shadcn as low-level primitives) | Kept the bundle and dependencies minimal for Phase 1; revisit for menus/popovers/comboboxes (Q-PO-10) |
| D14 | Email behind an `EmailProvider` interface; Resend adapter for prod/staging, console/fake adapter for dev/test, chosen by environment config | Q-PO-4: domain/workspace/auth services must never import Resend directly, so the provider can be swapped later without touching business logic; delivery failure must not corrupt invitation/membership/password-reset/account state |
