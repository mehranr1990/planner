import { NextResponse } from "next/server";
import { db } from "@/server/db";

export const dynamic = "force-dynamic";

/**
 * Minimal operational check: can the app reach the database and run a query.
 * Deliberately reveals nothing about the connection (host, user, schema) — only ok/not-ok,
 * so this is safe to leave reachable without auth for uptime monitoring.
 */
export async function GET() {
  try {
    await db.$queryRaw`SELECT 1`;
    return NextResponse.json({ status: "ok" });
  } catch {
    return NextResponse.json({ status: "error" }, { status: 503 });
  }
}
