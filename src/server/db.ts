import "server-only";
import { PrismaPg } from "@prisma/adapter-pg";
import { Prisma, PrismaClient } from "@/generated/prisma/client";

// One client per server process (and per hot-reload in dev).
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createClient(): PrismaClient {
  return new PrismaClient({
    adapter: new PrismaPg({
      connectionString: process.env.DATABASE_URL,
      // Local `prisma dev` (PGlite) serves one connection at a time; real Postgres uses the pg default.
      max: process.env.DATABASE_POOL_MAX ? Number(process.env.DATABASE_POOL_MAX) : undefined,
      // E2E sets this low so no connection is open when the test server is stopped (PGlite
      // does not survive a client vanishing mid-connection). Unset = pg default (10s).
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
