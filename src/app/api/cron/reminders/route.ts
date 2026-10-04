import { NextResponse } from "next/server";
import { deliverDueReminders } from "@/features/reminders/server/engine";

export const dynamic = "force-dynamic";

/**
 * Vercel Cron target (see `vercel.json`'s `crons` entry) — processes one batch of due reminders
 * per invocation. Idempotent and safe to call more than once concurrently (see engine.ts); safe
 * to retry on failure (nothing is left half-done — see the transaction in `deliverDueReminders`).
 *
 * Auth: when `CRON_SECRET` is set, requires `Authorization: Bearer <CRON_SECRET>` — the header
 * Vercel's own Cron trigger sends automatically once that env var exists in the project. Unset
 * locally/in dev on purpose, so `npm run dev`/tests can call this route without extra setup.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) return new NextResponse("Unauthorized", { status: 401 });
  }
  const result = await deliverDueReminders();
  return NextResponse.json(result);
}
