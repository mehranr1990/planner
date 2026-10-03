# Planner — personal + company productivity OS

Product definition: [docs/PRODUCT_SPEC.md](docs/PRODUCT_SPEC.md). Start with [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) and [docs/PHASE_PLAN.md](docs/PHASE_PLAN.md).

## Run locally

```bash
npm install                 # also generates the Prisma client
cp .env.example .env
npm run db:dev              # local Postgres (Prisma dev / PGlite), no Docker needed
npm run db:deploy           # apply migrations
npm run dev                 # http://localhost:3000
```

## Checks

```bash
npm run typecheck && npm run lint && npm test && npm run build
```

## End-to-end tests

Prerequisites: the local database is running (`npm run db:dev && npm run db:deploy`).

```bash
npx playwright install chromium   # once; or use an installed browser via PW_CHANNEL=msedge|chrome
npm run test:e2e                  # user flows (fails on console or hydration errors)
npm run test:visual               # visual baselines (desktop + mobile, en/fa, light/dark)
npm run test:visual:update        # re-record after an intended UI change, then review the diff
```

- The suite builds into `.next-e2e` and serves it on port 3210, so your own `npm run dev` is unaffected.
- It seeds fixed fixtures and only ever deletes `@e2e.local` / `@e2e.test` accounts.
- Details: `docs/QA.md` §3–§5.

`reference/` holds design and video references; it is not part of the app bundle.
