# Acceptance Criteria

Derived from the full master specification §0–§100 plus the cross-cutting I18N requirement (PRODUCT_SPEC P). A feature reaches ✅ in COVERAGE_MATRIX only when it meets §1 below. A rendered happy path is not done (§89).

## 1. Definition of Done, per feature (§89)

| # | Criterion | How it is checked |
|---|---|---|
| D1 | Requirement implemented as specified (or the deviation recorded as AS-/Q- item) | PR review against PRODUCT_SPEC § |
| D2 | Database correct: migration, FKs, uniques, indexes, CHECKs, delete behaviour, scope CHECK | migration review (DATA_MODEL §8) |
| D3 | Validation: Zod on every mutation; ids from session | code review |
| D4 | Authorization: server-side via capabilities + access rules; NOT_FOUND parity | integration tests |
| D5 | Responsive: designed mobile state at 390px | visual loop (QA §5) |
| D6 | Loading state | visual loop |
| D7 | Empty state with next action | visual loop |
| D8 | Error state (and conflict / partial-data where relevant) | visual loop |
| D9 | Accessibility: names, focus, keyboard, semantics, reduced motion | QA §6 checklist |
| D10 | Tests per the risk matrix (QA §2): unit for domain, integration where DB matters, E2E for §87 flows | `npm test`, E2E suite |
| D11 | No console errors / hydration warnings from app code | E2E run |
| D12 | No broken routes or links | E2E run |
| D13 | TypeScript clean | `npm run typecheck` |
| D14 | Lint clean | `npm run lint` |
| D15 | Production build passes | `npm run build` |
| D16 | Documentation updated (affected docs) | PR checklist |
| D17 | Coverage matrix row(s) updated, with Test column truthful | PR checklist |
| D18 | Shared components / services changed only additively, with dependent flows re-tested (§90) | COMPONENT_INVENTORY used-by |
| D19 | No duplicated domain logic; uses shared services (§91) | ARCHITECTURE §Shared services |
| D20 | Unseen pages composed from existing patterns (§96) and passed the visual loop at least twice (§88) | QA §5 log |
| D21 | **Translation keys:** all new UI copy in catalogs for every locale; semantic keys; ICU plurals; no concatenation; enums mapped in the UI | catalog tests (parity, ICU, placeholders), typed keys |
| D22 | **RTL verified:** logical CSS only, directional icons mirrored, `dir="auto"` on user content, desktop and mobile checked in `fa` | visual loop in both directions |
| D24 | **People pattern:** any small group of related users uses `PeopleCluster` (no hand-rolled avatar rows or text-only name lists); badges show real data; the group has an accessible label | code review + visual loop |
| D23 | **Locale formatting:** numbers, dates, times, money and durations through `lib/format` / `useFormat`; nothing formatted stored; services emit codes, not prose | code review + unit tests |

## 2. Phase gate criteria (§93, §100)

A phase may **start** only when `docs/phases/PHASE_<n>.md` exists and covers the 12 gate items in PHASE_PLAN §4. Unresolved business rules must be listed as Q-items, not guessed.

A phase may **end** only when:
- every COVERAGE_MATRIX row assigned to it is ✅, or is explicitly re-assigned to a later phase with a reason
- the phase's §87 E2E flows pass
- the docs and coverage matrix are updated

## 3. Product-level criteria (§99)

- **Continuity:** Capture → Plan → Schedule → Execute → Collaborate → Communicate → Review → Automate is reachable without leaving the shell, and every hand-off is a real link (e.g. message → task keeps its source).
- **One product:** personal and company are contexts of one product. The same components, the same navigation and the same task model in both.
- **Coherence:** no module introduces its own visual system or its own copy of a shared concern.

## 4. Current feature criteria (Phases 1–2)

| ID | Criterion | Verified by |
|---|---|---|
| AC-AUTH-1 | Wrong email and wrong password give the same message, with comparable timing | code review (dummy hash) |
| AC-AUTH-2 | `?next=` accepts only same-origin relative paths | `safeNext` |
| AC-AUTH-3 | Session token never stored raw; logout deletes the row | session.ts |
| AC-TEN-1 | DB rejects PERSONAL-with-workspace and vice versa | I |
| AC-TEN-2 | Non-members can't create in or read from a workspace | I |
| AC-TASK-1 | Quick add parses in the user's tz; the server re-parses | U + I |
| AC-TASK-2 | Double submit creates one task | I |
| AC-TASK-3 | A stale edit is rejected with a conflict message and a reload option | I + UI |
| AC-TASK-4 | Completing a recurring task creates exactly one successor (re-completion, races) | I |
| AC-TASK-5 | Circular dependencies are rejected | U + I |
| AC-TASK-6 | Deleted tasks disappear, are restorable, and their rows persist | I |
| AC-PLAN-1 | Today includes overdue; a timed task past its time is marked overdue | I + E |
| AC-PLAN-2 | A user never sees another user's tasks or projects | I + E |
| AC-ROLE-1 | No self role change; non-owners act only downward; the last owner is kept | U + tx |
| AC-2A-1 | Every task insert goes through `createTask`; duplicates (client id or recurrence key) never abort the caller's transaction | I + grep audit |
| AC-2A-2 | Server actions contain no DB access or business rules (validate → viewer → service → `runAction`) | grep audit + review |
| AC-2A-3 | E2E (16 flows) and visual (22 baselines) run from a clean checkout and fail on any console/hydration error | `npm run test:e2e`, `npm run test:visual` |
| AC-I18N-1 | Locale resolves user → cookie → Accept-Language → en; unsupported values fall back | U + E |
| AC-I18N-2 | `fa` renders `dir="rtl"`; `en` renders `dir="ltr"`; server and client agree (no hydration warnings) | E |
| AC-I18N-3 | Switching language keeps route, active workspace and session; survives reload and sign-out | E |
| AC-I18N-4 | Validation and auth errors appear in the active language | E |
| AC-I18N-5 | Every locale has identical keys, valid ICU and matching placeholders/tags | U |
| AC-I18N-6 | Persian user content is stored byte-exact (incl. ZWNJ) and renders correctly in both UIs | I + E |
| AC-I18N-7 | Quick Add keeps full English behaviour; Persian titles pass through; no Persian keywords claimed | U |

DoD gaps on already-built features (tracked, not hidden):

| Gap | DoD item | Destination |
|---|---|---|
| ~~E2E is not in the repo~~ | D10, D11 | ✅ Phase 2a |
| ~~No integration test for role change / last-owner guard~~ | D10 | ✅ Phase 2a (incl. stale-owner case) |
| ~~No test for checklist, project status/archive actions~~ | D10 | ✅ Phase 2a |
| No full keyboard/screen-reader audit; `<details>` menus lack arrow keys | D9 | Phase 3 (Menu), Phase 15 audit |
| ~~Two task-insert paths~~ | D19 | ✅ Phase 2a |

## 5. Module acceptance seeds (expanded in each phase's gate document)

| Module | Must-hold criteria (summary) |
|---|---|
| Workspaces (2b) | invite token single-use, hashed, expiring; accepted email must match; removal revokes sessions' workspace access immediately; every membership change audited |
| Notifications (2b/6) | one notification per (event, recipient), enforced by `dedupe_key`; never sent for objects the recipient can't see; preferences respected |
| Calendar/time (4) | events render correctly across DST and between user/workspace tz; moving a block never alters the task; at most one running timer per user (DB constraint) |
| Habits (5) | logs are historical rows; streaks are deterministic for any tz; targets support min/ideal; no hardcoded habit catalogue |
| Goals (5) | the progress mode is explicit; calculated progress is reproducible from links |
| Chat (7) | unread counts are correct across devices; deleted-message policy is honoured; message → task keeps a reference and respects the target's permissions |
| Boards (8) | mirror values are never stored stale; formulas can't execute code; relations enforce both sides' permissions |
| Dashboards/reports (8) | every widget is computed with the viewer's permissions; metrics are reproducible from filters |
| Forms/requests/SLA (9) | SLA due/pauses/breach are deterministic (pure functions with tests); public forms rate-limited; anonymous submissions can't read data |
| Approvals (9) | append-only; only designated approvers decide; source-record access re-checked at decision time |
| Finance (11) | Decimal everywhere; per-currency totals; company finance invisible without `finance.view` |
| Automation (12) | each trigger event runs at most once per automation; loop depth bounded; every run logged; runs act within the author's current permissions |
| AI (13) | output stored with provenance; important writes need human approval; no AI call during render |
| Bookings (14) | overlapping exclusive bookings rejected by the DB |
| Offline (15) | queued mutations replay idempotently; conflicts shown, never silently overwritten; "synced" shown only after server confirmation |
