import { seed } from "./seed";

// Hard safety gate: this seeds, then deletes-and-recreates, `@e2e.local`/`@e2e.test` fixtures.
// It must never run against anything but a disposable test database. Fail closed on any doubt —
// there is no "probably fine" here.
function assertSafeToSeed() {
  if (process.env.VERCEL_ENV === "production") {
    throw new Error("Refusing to run E2E seeding: VERCEL_ENV=production. E2E must target a dedicated test database, never Production.");
  }
  if (process.env.APP_ENV !== "test") {
    throw new Error(
      "E2E seeding requires APP_ENV=test to confirm DATABASE_URL points at a disposable test database. " +
        "playwright.config.ts sets this by default for local runs; CI must set it explicitly alongside a test-only DATABASE_URL.",
    );
  }
}

export default async function globalSetup() {
  try {
    process.loadEnvFile(".env");
  } catch {
    // CI provides the environment directly.
  }
  assertSafeToSeed();
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("E2E needs DATABASE_URL (see README → End-to-end tests).");
  await seed(url);
}
