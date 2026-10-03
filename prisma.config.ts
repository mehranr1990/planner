import { defineConfig } from "prisma/config";

// Prisma CLI does not read .env on its own; Node 22 can, without a dotenv dependency.
try {
  process.loadEnvFile(".env");
} catch {
  // No .env file — rely on the real environment (CI, Vercel).
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env.DATABASE_URL,
    shadowDatabaseUrl: process.env.SHADOW_DATABASE_URL,
  },
});
