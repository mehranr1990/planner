# QA

Implements §86 (risk-based testing), §87 (E2E flows), §88 (visual regression), §89 (DoD) and §90 (regression).

## 1. Automated checks

| Command | What |
|---|---|
| `npm run typecheck` | `tsc --noEmit` (strict) |
| `npm run lint` | ESLint (Next + React Compiler rules) |
| `npm test` | Vitest: unit + DB integration (integration skips without `DATABASE_URL`) |
| `npm run build` | production build |

Last run (2026-10-04, Phase 2b): typecheck ✅ · lint ✅ · Vitest **178/178** ✅ · build ✅ · Playwright **43/43** ✅ (21 flows + 22 visual).
- Unit and catalog tests, plus DB integration tests: task flows; the creation core; project, workspace, checklist and auth services; Persian round trip; invitations (hashed token, expiry, email match, single-use), notification dedupe, member lifecycle, custom roles, teams, password reset, sessions, onboarding.
- E2E fails any test whose pages log a console error, a hydration warning or an uncaught exception.

## 2. Risk-based test matrix (§86)

| Risk area (§86) | Layer | Current tests | Status | Phase |
|---|---|---|---|---|
| Tenant access | I | personal privacy, workspace visibility, guest/outsider exclusion, planner never lists others | ✅ | 1–2 |
| Permissions | U, I | capability defaults, custom roles, role-change rank rules, last-owner guard (stale-owner viewer), project create/edit by role | ✅ | 2a |
| Task CRUD | I | create via core (parse, tz, project scope, in-tx idempotency, source metadata), update + version conflict, soft delete/restore, checklist | ✅ | 2/2a |
| Assignment | I | access rule only | ⬜ | 3 |
| Recurrence | U, I | rule generation, DST-free dates, single successor, races | ✅ | 2 |
| Dependencies | U, I | cycle detection, self-edge | ✅ | 2 |
| Workspace membership | I | membership-based visibility, deactivate/reactivate, remove, last-owner guard on deactivate | ✅ | 2b |
| Invitation | I, E | hashed single-use token, expiry, revoke, email-match, duplicate-pending guard, accept → membership | ✅ | 2b |
| Calendar timezone | U | `time.ts` offsets, DST gap/overlap, local dates | 🟡 lib only | 4 |
| Time-block changes | I | — | ⬜ | 4 |
| Habit logging | U, I | — | ⬜ | 5 |
| Budgets / calculation | U | — | ⬜ | 11 |
| Approvals | I | — | ⬜ | 9 |
| Request / SLA logic | U (pure SLA clock), I | — | ⬜ | 9 |
| Automation idempotency | I | — | ⬜ | 12 |
| Form submission | I, E | — | ⬜ | 9 |
| Notification generation | I | `notify()` dedupe_key, one row per (event, recipient) | ✅ | 2b |
| Password reset / sessions | I, E | single-use expiring token, invalidate-on-new-request, revoke-all-on-reset, list/revoke-one/revoke-others | ✅ | 2b |
| Custom roles / teams | I | owner-only capability stripped, delete reassigns to base role, team CRUD/membership | ✅ | 2b |
| Onboarding | I, E | setup step persists, completion idempotent, never blocks other routes | ✅ | 2b |

Rule: whenever DB constraints, transactions or permissions matter, an integration test is required. Mocks of Prisma are not accepted as evidence.

## 3. High-value E2E flows (§87)

Harness (in repo since Phase 2a): `playwright.config.ts` + `e2e/`.

| Spec | Covers |
|---|---|
| `auth.spec.ts` | redirect to sign-in with `next`, sign-up validation + success, sign-out, generic wrong-password error, sign-in |
| `planner.spec.ts` | all 8 view pills; Quick Add preview + parsing into Today/Upcoming/Someday; edit/schedule in sheet (date, priority, notes, Saved); complete → leaves Today → Completed |
| `workspace.spec.ts` | create workspace (active in switcher), project dialog, project task, context switch to Personal; dark/light persistence across reloads |
| `isolation.spec.ts` | second account sees no tasks/projects; direct project URL → "Not available" |
| `i18n.spec.ts` | fa Accept-Language → RTL before sign-in; Persian validation; saved fa preference; switch to en keeps route + workspace + session; survives reload; cookie after sign-out; guest switcher; localized sign-in error; account beats cookie; unsupported cookie ignored |
| `people.spec.ts` | allocation group near card top (names + badge meaning, real counts), photo vs initials, +N from real totals, header strip, task-row assignees (xs single initial), dark-surface rings, RTL mirroring |
| `invitations.spec.ts` | send/list/revoke an invitation; an invalid invite link shows a clear not-found state |
| `security.spec.ts` | change password + sessions list, then sign in with the new password; forgot-password generic confirmation |
| `onboarding.spec.ts` | team path: setup → choose team → create workspace → skip first action → `/home`; re-visiting after completion is idempotent |
| `visual.spec.ts` | §88 baselines (see §5) |

### Running from a clean checkout

```bash
npm install
npx playwright install chromium   # or set PW_CHANNEL=msedge / chrome to use an installed browser
npm run db:deploy                 # applies migrations to whatever DATABASE_URL/DIRECT_URL point at
npm run test:e2e                  # flows; builds into .next-e2e and starts `next start` on :3210
npm run test:visual               # screenshot comparison
npm run test:visual:update        # re-record after an intended UI change, then review the diff
```

`DATABASE_URL` must point at a **disposable** Neon branch (not your personal Development branch, never Production) — the suite deletes and recreates `@e2e.local`/`@e2e.test` fixtures. `playwright.config.ts` sets `APP_ENV=test` automatically for local runs; global setup refuses to seed without it, and refuses unconditionally if `VERCEL_ENV=production`.

- Global setup seeds deterministic fixtures (`e2e/support/seed.ts`) and first removes all `@e2e.local` / `@e2e.test` users and their data. It never touches other data.
- Flows run on one worker, serialized — a deliberate current choice (one seeded fixture set, shared), not a database-backend limitation. See "7. Known issues" below.
- Use `E2E_DEV=1` to run against `next dev`.
- Use `E2E_PORT` to change the port.

| # | Flow | Executable from | Current state |
|---|---|---|---|
| F1 | New user → onboarding → personal planner → create → schedule → complete task | 2b | ✅ sign-up → onboarding (personal path) → `/home`; planner → quick add (with date) → schedule in sheet → complete → Completed view |
| F2 | Create workspace → invite → member joins → create project → assign task → comment → notification → complete | 3 | 🟡 create workspace + project + tasks + complete ✅; invite send/list/revoke ✅ (2b); member accept-via-real-link E2E not feasible (token is never stored, only its hash — covered at the integration layer instead, see `phase2b.integration.test.ts`); assign/comment/notification UI (3) ⬜ |
| F3 | Create project → add members → create tasks → board → calendar → activity | 4 | 🟡 project + tasks ✅; members/board/activity (3), calendar (4) ⬜ |
| F4 | Quantity habit → log amount → reach target → streak/history update | 5 | ⬜ |
| F5 | Meeting → agenda → notes → decision → action item → task | 10 | ⬜ |
| F6 | Submit form → request → assigned → approval if required → resolve | 9 | ⬜ |
| F7 | Chat message → mention → notification → convert to task | 7 | ⬜ |
| F8 | Create workflow → trigger → condition → action → execution log | 12 | ⬜ |
| F9 (extra) | Cross-tenant isolation: a second account sees none of the first's data | 2 | ✅ |

Every flow, once executable, joins the regression suite and runs before each phase is closed.

## 3b. Locale matrix walkthrough (I18N)

Script `i18n.mjs` (Playwright against Edge, session scratchpad; moves into the repo in Phase 2a). Latest run: **20/20 checks, 0 console or hydration errors**.

| Matrix cell | Covered screens |
|---|---|
| fa · desktop · light | sign-in, sign-up validation, planner today/upcoming, task sheet, new project dialog, project detail, projects, team, home, settings |
| fa · desktop · dark | project detail, planner |
| fa · mobile · light | home, project detail, task bottom sheet |
| fa · mobile · dark | planner |
| en · desktop · light | settings (after switch), planner with Persian content, project detail, sign-in |
| en · desktop · dark | home |
| en · mobile · light | planner, home |

Behaviour checks:
- Accept-Language `fa` → RTL before sign-in.
- Localized validation (fa).
- The sign-up locale is saved.
- Translated navigation.
- RTL sheet enters from the inline-end edge.
- In-place switch to `en` keeps the route, the active workspace and the session.
- English persists across reload.
- User content is unchanged.
- A mobile session follows the account locale.
- After sign-out the cookie keeps the last language.
- The guest switcher → `fa`.
- Localized sign-in error.
- The account preference beats the cookie after sign-in.
- An unsupported cookie is ignored.

RTL/i18n issues found and fixed:

| Issue | Fix |
|---|---|
| ~20 physical-direction classes (`ml/mr/pl/pr/left/right/text-left`) in the shell, menus, sheet, quick add, banner, select, metric | logical utilities (`ms/me/ps/pe/start/end/text-start`) |
| Back chevron and "open" arrows didn't mirror | `rtl:rotate-180` / `rtl:-scale-x-100`; neutral icons left alone |
| Persian content in the English UI rendered with broken joining | next/font fallback face (local Arial, U+0-10FFFF) captured Arabic glyphs; Turbopack ignores `adjustFontFallback: false` → explicit per-direction stack (ARCHITECTURE D11) |
| Negative tracking breaks Persian joining | `letter-spacing: normal` under `:lang(fa)` |
| The dev indicator covered the rail toggle (left in LTR, right in RTL) | `devIndicators: false` (dev only) |
| Activity timestamps used the browser locale and timezone (hydration risk) | `f.dateTime(instant, viewerTz)` |
| Two "New project" dialogs on an empty page shared input ids (a11y, pre-existing) | `useId()` scoped ids |
| Domain/service errors were English prose | stable codes + `localizeError` |

## 3c. People pattern walkthrough

Script `people.mjs` (scratchpad). It creates the project and tasks through the UI, then seeds 7 teammates (one with a photo avatar, one Persian name) and assignments directly in the DB, because the invite and assign UIs arrive in Phases 2b/3.

Checked surfaces:
- project card allocation row (red/yellow/blue badges, +3)
- project detail header strip
- task-row stacks
- task sheet header
- team header preview
- dark Next-up card

Matrix: en and fa, desktop and mobile, light and dark.

Accessibility check: group "Project members"; faces "Arash Karimi — 5 open tasks"; overflow "3 more people".

Fixed during the loop: second initials hidden under the next face at xs/sm. Overlap is now ⅕ of a face, and xs uses a single initial. Result: 0 console or hydration errors.

Seeding note: local PGlite allows one connection. The script waits for the app's idle connection to close before connecting, otherwise the server wedges (it happened once; the restart is documented in ARCHITECTURE → Local development).

## 3d. Phase 2a regression log

| Found by | Issue | Fix |
|---|---|---|
| E2E people spec | Task lists loaded a 4-assignee preview without a total, so a 5th assignee silently disappeared (no "+N") | `assigneeCount` in the DTO → `PeopleCluster total`; stable preview order (assignedAt, userId) |
| Visual review | Masks of page content behind the task sheet painted over the sheet's Notes field | Screenshot the sheet element, mask only within it |
| E2E setup | E2E production builds overwrote `.next` used by a developer's running `next dev` | `distDir` from `NEXT_DIST_DIR`; E2E uses `.next-e2e` |
| E2E setup | PGlite wedged after a server was killed mid-connection; stale `server.lock.lock` left behind | Recovery documented (ARCHITECTURE → Local development); data unaffected |

## 3e. Reference alignment pass (2026-10-03)

Reported by the product owner after comparing the app with the reference, then extended by a detailed check of the other screens:

| Issue | Fix |
|---|---|
| Planner view pills sat above the panel at the start; the reference centres selectable pills in the panel header | Pills moved into the panel header row, centred (title at start); scroll inside the panel on mobile |
| Task sheet and Settings used two-column grids, so labels sat mid-form; the reference form is one column with labels at the start | Single-column forms; due date + time share one row under one label |
| Inputs were grey on white, and **nearly invisible on the sign-in card** | White pill fields with hairline ring on a grey dialog/sheet surface |
| Selects had no chevron (`appearance-none` without an icon) | Chevron at the inline end, RTL-aware |
| Dialog had no divider or cancel action; the reference has a divider and two equal footer buttons | Divider + `DialogFooter` (Cancel / Create) |
| Mobile planner broke out horizontally after the pills moved into the panel (pill row's intrinsic width widened the grid column) | Page grid `minmax(0,1fr)` on mobile |
| Date input collapsed / time overflowed: `w-40` lost to `Input`'s own `w-full` (no Tailwind conflict resolution in `cn`) | Sizes on wrappers; same fix for the checklist input height |
| Visual baselines could capture hover states | Pointer parked before capture |
| PGlite wedged when Playwright stopped the server with a pooled connection open | E2E pool idle timeout 300ms (`DATABASE_POOL_IDLE_MS`) + global teardown wait; two back-to-back full runs verified |

Visual baseline: the first run after the change failed exactly the 10 changed screens (planner ×5, sheet ×3, settings ×2), and the 12 untouched screens passed. Re-recorded, then two consecutive full runs passed 38/38, across a date change.

## 4. Regression (§90)

Before changing a shared component or service:
1. Read its "Used by" list in COMPONENT_INVENTORY.md (or grep for it).
2. Make the change additive.
3. Re-run the dependent flows. Current shared-flow map:

| Shared piece | Flows to re-run |
|---|---|
| `TaskRow` / `TaskList` / `QuickAdd` / `TaskSheet` | home, all planner views, project detail (F1, F2, F3) |
| `Panel` / `SectionHeader` / `PageTitle` | every page (visual loop) |
| `Sheet`, `Dialog`, `IconButton`, `IconLink` | task sheet, create project, home, project detail (flows + visual) |
| `Avatar` / `PeopleCluster` | project card, project detail header, planner rows, task sheet, team, home Next-up (people walkthrough) |
| `tasks/server/service.ts` | full integration suite + F1 |
| `access.ts` / `capabilities.ts` | full integration suite + F9 |
| `lib/time.ts` | unit suite + planner buckets integration |

## 5. Visual regression loop (§88)

For each major page:
1. Start the app.
2. Open 1440×960 and 390×844, light and dark.
3. Screenshot.
4. Compare with `reference/design/*` and sibling screens.
5. Inspect: spacing, alignment, typography, hierarchy, surfaces, radii, button sizes, card proportions, responsive behaviour.
6. Fix.
7. Repeat (at least two passes).

Log each pass with the date, page and issues found and fixed.

| Date | Pages | Issues found → fixed |
|---|---|---|
| 2026-10-01 | planner, task sheet, project detail, projects, team, settings, home (personal/workspace), dark home, mobile home/planner/sheet | project controls stretched full width; timed-overdue not marked; repeat labels capitalised by CSS; scope chips cramped on mobile; dev indicator over theme toggle (dev-only, moved) → all fixed, re-shot |

**In repo since Phase 2a: `e2e/visual.spec.ts`**

| Project | en-light | en-dark | fa-light | fa-dark |
|---|---|---|---|---|
| visual-desktop (1440×960) | home, planner, task sheet, projects, project detail, team, settings | home, project detail | planner, task sheet, project detail, settings | home, planner |
| visual-mobile (390×844) | home, planner, project detail | home | projects (PeopleCluster allocation), task sheet | planner |

Stability rules:
- Seeded fixed ids (stable avatar tones).
- Only all-day dates relative to today.
- CSS animations disabled; fonts and images awaited.
- **Only** time-dependent text is masked: `[data-volatile]` (date line, greeting, planner date, activity times) and the native date input.
- The task sheet is captured as its own element, so masks of the page behind can't cover sheet content.

Tolerance `maxDiffPixelRatio: 0.002` absorbs anti-aliasing only. Baselines live in `e2e/__screenshots__/<platform>-<browser>/` (committed: `win32-msedge`). Other platforms record their own with `npm run test:visual:update`.

Phase 2a check: recorded, then an independent second run matched all 22.

## 6. Manual checklist per release

- [ ] Light and dark on every touched screen
- [ ] 390px width; no horizontal scroll except intended pill rows and boards
- [ ] Keyboard-only pass: tab order, Esc closes sheets/dialogs, focus visible, menus operable
- [ ] Screen-reader spot check: icon buttons named, live regions for status/errors
- [ ] Second-account isolation check on touched entities
- [ ] Permission states: guest, member, manager
- [ ] Migration reviewed: no destructive changes; hand-written constraints present
- [ ] Coverage matrix and docs updated (D16, D17)

## 7. Known issues / limitations

- Integration tests (`fileParallelism: false`, `vitest.config.mts`) and E2E flows (`workers: 1`, `playwright.config.ts`) both run serialized against one shared fixture set, by design — not because of a database-backend limit (Neon supports normal concurrent Postgres connections; the old PGlite single-connection constraint no longer applies, see `docs/ARCHITECTURE.md` → "Database (Neon)"). Uniqueness guarantees come from the DB constraints either way. Running them in parallel would need per-run fixture isolation (e.g. a unique schema/branch per worker), which hasn't been designed yet — a future improvement, not a correctness gap today.
- The old scripted "Completed contains the task" timing flake is gone: the in-repo spec waits on the row leaving Today before checking Completed.
- Native date/time inputs in the task sheet (custom picker planned).
- `<details>` menus have no arrow-key navigation.
- No rate limiting on auth yet.
- Task descriptions are plain text (rich text with sanitiser pending Q-PO-9).
- §1 frame extraction with FFmpeg wasn't run (ffmpeg not installed); the provided frames and contact sheets were used.
- Native `<input type="date|time">` controls follow the browser's locale and calendar rather than the app locale. They stay Gregorian, consistent with displayed dates; a custom picker is planned.
- IANA timezone names in Settings and Team are shown as identifiers (LTR, untranslated). See Q-I18N-4.
- The Quick Add parser understands English keywords only (documented in the UI; I18N-12).

## 8. CI and the Neon/Vercel migration (2026-10)

`.github/workflows/ci.yml` runs on every PR and on push to `main`: `checks` (typecheck, lint, `npm test`, `prisma migrate deploy`, `npm run build`) then `e2e` (Playwright flows only — see below). Both jobs run exclusively against a dedicated Neon **test** branch via `NEON_TEST_DATABASE_URL`/`NEON_TEST_DIRECT_URL` secrets, with `APP_ENV=test` set explicitly in the workflow (never relying on a default, unlike local runs). CI must never be given Production or a Preview-deployment's credentials.

**Visual regression is not yet in CI.** Baselines are committed only for `win32-msedge`; the CI runner is `ubuntu-latest` + chromium, so there is no matching baseline to compare against. Generating one (`npm run test:visual:update` on that exact runner image, reviewed, then committed) is a one-time follow-up before `test:visual` can be added to `.github/workflows/ci.yml`.

**Pending verification (needs actual Neon/Vercel dashboard access — not yet performed):**
- [ ] Preview branch isolation: deploy a branch, create a throwaway record through the Preview URL, confirm it is **not** visible in Production, then delete it from the Preview branch only.
- [ ] Production smoke test after the first real deploy: app loads, sign up, sign in, session survives refresh, create a task, edit it, create a workspace, switch context, sign out, sign back in, data persists. Clean up whatever the smoke test created.
- [ ] Persistence across a Vercel redeploy (push a trivial change, confirm earlier data is still there after the new deployment is live).

Once performed, record the actual result here (date, who ran it, outcome) rather than leaving the checklist unchecked.
