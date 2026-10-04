# Planner — personal + company productivity OS

Product definition: [docs/PRODUCT_SPEC.md](docs/PRODUCT_SPEC.md). Start with [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) and [docs/PHASE_PLAN.md](docs/PHASE_PLAN.md).

## Database: Neon Postgres, always

There is no local database process in this project. Every environment — your own machine, CI, a
Vercel Preview deployment, and Production — is a [Neon](https://neon.tech) Postgres branch. See
[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) → "Database (Neon)" for the full architecture and
[docs/HANDOFF.md](docs/HANDOFF.md) → "Setting up on a new machine" for first-time setup, including
getting a Development branch connection string from whoever manages the Neon project.

## Run locally

```bash
npm install                 # also generates the Prisma client (postinstall)
cp .env.example .env        # fill in DATABASE_URL + DIRECT_URL for your Neon Development branch
npm run db:deploy           # apply migrations to that branch
npm run dev                 # http://localhost:3000
```

## Checks

```bash
npm run typecheck && npm run lint && npm test && npm run build
```

`npm test` runs unit tests always and DB integration tests whenever `DATABASE_URL` is set (point it
at your Neon Development branch, or a disposable branch of your own — never Production).

## End-to-end tests

Prerequisites: migrations applied to the database `DATABASE_URL` points at (`npm run db:deploy`),
and `APP_ENV=test` in your environment — `playwright.config.ts` sets this automatically for local
runs, since E2E deletes-and-recreates `@e2e.local`/`@e2e.test` fixtures and refuses to run without
it. Use a disposable Neon branch for this, not your personal Development branch.

```bash
npx playwright install chromium   # once; or use an installed browser via PW_CHANNEL=msedge|chrome
npm run test:e2e                  # user flows (fails on console or hydration errors)
npm run test:visual               # visual baselines (desktop + mobile, en/fa, light/dark)
npm run test:visual:update        # re-record after an intended UI change, then review the diff
```

- The suite builds into `.next-e2e` and serves it on port 3210, so your own `npm run dev` is unaffected.
- It seeds fixed fixtures and only ever deletes `@e2e.local` / `@e2e.test` accounts.
- Details: `docs/QA.md` §3–§5.

## Deployment

Pushing to `main` deploys to Vercel Production against the Neon production branch; every other
push gets a Vercel Preview deployment against its own, isolated Neon branch. Migrations run
automatically as part of the build (`vercel-build` script). See `docs/ARCHITECTURE.md` → "Deployment (Vercel + Neon)".

`reference/` holds design and video references; it is not part of the app bundle.
