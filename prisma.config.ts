import { defineConfig } from "prisma/config";

// Prisma CLI does not read .env on its own; Node 22 can, without a dotenv dependency.
try {
  process.loadEnvFile(".env");
} catch {
  // No .env file — rely on the real environment (CI, Vercel).
}

// Every Prisma CLI command that actually opens a connection (migrate, db pull, studio, …)
// needs the DIRECT (unpooled) Neon connection — Neon's pooled DATABASE_URL (PgBouncer-style)
// can't reliably run migrations. `generate` only reads schema.prisma and never connects, so it
// must keep working with no database reachable at all (e.g. a fresh `npm install` before the
// environment is configured) — this check only applies to subcommands that need a connection.
const CONNECTIONLESS_COMMANDS = new Set(["generate", "validate", "format", "version", "-v", "--version", "help", "-h", "--help"]);
const needsDirectConnection = !CONNECTIONLESS_COMMANDS.has(process.argv[2] ?? "");

function resolveDirectUrl(): string | undefined {
  const direct = process.env.DIRECT_URL ?? process.env.DATABASE_URL_UNPOOLED;
  if (!direct && needsDirectConnection) {
    throw new Error(
      "Prisma CLI needs a direct (unpooled) database connection: set DIRECT_URL or DATABASE_URL_UNPOOLED. " +
        "The pooled DATABASE_URL (application runtime) is never used for migrations, and there is no fallback to it.",
    );
  }
  return direct;
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: resolveDirectUrl(),
    // Only needed for `prisma migrate dev` (shadow DB); optional — a personal Neon dev branch
    // can supply its own via SHADOW_DATABASE_URL. Not used by `migrate deploy`.
    shadowDatabaseUrl: process.env.SHADOW_DATABASE_URL,
  },
});
