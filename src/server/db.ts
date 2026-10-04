import "server-only";
import { PrismaPg } from "@prisma/adapter-pg";
import { Prisma, PrismaClient } from "@/generated/prisma/client";

// Runtime always talks to Neon's POOLED connection string (DATABASE_URL) — never the direct
// one. One client per Node module instance: within a single process (a `next dev` run, or one
// warm Vercel function instance) the module only evaluates once, so this is already a true
// singleton; the globalThis cache below exists only to survive `next dev`'s hot-reload
// invalidating the module cache, not for cross-request reuse in production (each serverless
// instance keeps its own module scope for as long as it stays warm).
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createClient(): PrismaClient {
  return new PrismaClient({
    adapter: new PrismaPg({
      connectionString: process.env.DATABASE_URL,
      // Neon's pooled connection already pools at the proxy layer; keep this client-side pool
      // small (esp. on serverless, where many warm instances each hold their own). Unset = pg
      // default (10). Tune per environment via DATABASE_POOL_MAX, not hardcoded here.
      max: process.env.DATABASE_POOL_MAX ? Number(process.env.DATABASE_POOL_MAX) : undefined,
      idleTimeoutMillis: process.env.DATABASE_POOL_IDLE_MS ? Number(process.env.DATABASE_POOL_IDLE_MS) : undefined,
    }),
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });
}

export const db: PrismaClient = globalForPrisma.prisma ?? createClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;

export type Tx = Prisma.TransactionClient;

export function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}
