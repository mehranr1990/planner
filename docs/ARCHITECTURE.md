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
| Task mutation | `updateTask`, `setTaskCompletion`, `setTaskRecurrence`, `softDeleteTask`, `restoreTask`, `addDependency`, checklist | ✅ |
| Project / workspace / account / auth mutations | `features/{projects,workspace,account,auth}/server/service.ts` | ✅ Phase 2a |
| Action boundary | `src/server/run-action.ts` (`runAction`, `invalidInput`): revalidate + localize `DomainError` codes; `src/server/errors.ts` (`DomainError`) | ✅ Phase 2a |
| Permissions | `server/permissions/capabilities.ts` + `features/*/server/access.ts` | ✅ |
| Activity / audit | `server/activity.ts` (`recordActivity`, `recordAudit`) | ✅ |
| Notifications | `server/notifications.ts` — `notify(tx, {recipient, type, entity, dedupeKey})`, fan-out respects preferences | Phase 2b |
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

## Background jobs (planned, Phase 4)

These features need deferred or scheduled work:
- reminders, due-soon and overdue notifications
- invitation expiry
- habit and check-in prompts
- SLA breach detection
- subscription charges
- scheduled automations and delays
- email delivery
- AI jobs
- search re-indexing

Design: a DB `Job` table (`run_at`, `dedupe_key UNIQUE`, attempts, status), claimed with `FOR UPDATE SKIP LOCKED` by a Vercel Cron-triggered route (or an external worker; Q-PO-13). Handlers are idempotent; retries use backoff.

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

## Local development

```
npm install
npm run db:dev        # prisma dev (PGlite) on :51214, shadow on :51215
npm run db:deploy     # apply migrations
npm run dev
npm test              # unit + integration (integration needs DATABASE_URL)
```

PGlite serves one connection at a time and maps every database name to the same store. That's why `.env` sets `DATABASE_POOL_MAX=1` and points `SHADOW_DATABASE_URL` at the separate shadow port. On real Postgres, leave the pool max unset. E2E builds into `.next-e2e` (`NEXT_DIST_DIR`), so a running `next dev` keeps its `.next`. E2E also sets `DATABASE_POOL_IDLE_MS=300`, and a global teardown waits until pooled connections have closed before the server is stopped (PGlite wedges if a client disappears mid-connection). If PGlite stops accepting connections ("Connection terminated unexpectedly"; usually after a second client connected while the app held the connection), run `npx prisma dev stop planner`, then `npm run db:dev`. Data persists.

## Deployment (Vercel-compatible)

- Set `DATABASE_URL`, preferably a pooled URL.
- The build runs `prisma generate` (postinstall); deploys run `prisma migrate deploy`.
- No filesystem state and no custom server.

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
| D13 | E2E fixtures seeded with plain SQL in Playwright global setup | Prisma's ESM client doesn't load in Playwright's TS runtime; global setup runs before the app opens its single PGlite connection |
| D11 | Explicit per-direction font stack built in the root layout | next/font's fallback faces (local Arial, U+0-10FFFF) otherwise capture the other script's glyphs, and Turbopack ignores `adjustFontFallback: false` |
| D8 | Own primitives instead of shadcn/ui (spec §3 lists shadcn as low-level primitives) | Kept the bundle and dependencies minimal for Phase 1; revisit for menus/popovers/comboboxes (Q-PO-10) |
