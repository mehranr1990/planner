import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/server/db";
import { getSessionUser } from "@/server/auth/session";
import { storageProvider } from "@/server/storage";

export const dynamic = "force-dynamic";

/**
 * Authenticated avatar delivery (Batch 6). Avatars are low-sensitivity (profile photos shown
 * broadly across shared workspace contexts — team pages, assignee lists, comments), so unlike
 * task attachments this route only requires the caller to be signed in, not a per-object
 * visibility check against the pictured user — documented explicitly here, per the brief's own
 * "if avatars are public-readable, document it; otherwise use signed/controlled access" steer.
 * The Blob store is still private either way, so a raw guessable URL is never enough on its own.
 */
export async function GET(_request: NextRequest, context: RouteContext<"/api/avatars/[userId]">) {
  const sessionUser = await getSessionUser();
  if (!sessionUser) return new NextResponse("Unauthorized", { status: 401 });

  const { userId } = await context.params;
  const user = await db.user.findUnique({ where: { id: userId }, select: { avatarStorageKey: true, avatarMimeType: true } });
  if (!user?.avatarStorageKey) return new NextResponse("Not found", { status: 404 });

  const download = await storageProvider.download(user.avatarStorageKey);
  if (!download) return new NextResponse("Not found", { status: 404 });

  return new NextResponse(download.stream, {
    headers: {
      "Content-Type": user.avatarMimeType ?? download.contentType,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-cache",
    },
  });
}
