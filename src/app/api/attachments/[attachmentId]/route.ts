import { NextResponse, type NextRequest } from "next/server";
import { downloadAttachment } from "@/features/attachments/server/service";
import { getSessionUser } from "@/server/auth/session";
import { getViewer } from "@/server/context";

export const dynamic = "force-dynamic";

/** RFC 6266: an ASCII fallback plus the real name UTF-8-encoded, so non-Latin filenames still work. */
function contentDisposition(filename: string): string {
  const ascii = filename.replace(/[^\x20-\x7e]/g, "_").replace(/"/g, "'");
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

/**
 * Authenticated attachment download (Batch 6). The Blob store is private — nothing here is
 * reachable by a raw URL — so this route is the only way to read an attachment's bytes, and it
 * re-checks the caller's own task visibility on every single request (never cached, never trusted
 * from a prior check): knowing an attachment's id is not enough on its own.
 *
 * `getSessionUser()` (not `getViewer()`) gates the 401 case deliberately: `getViewer()` → `requireUser()`
 * calls `redirect()`, which only works inside the render/action pipeline — calling it from a plain
 * Route Handler would not produce a correct response. Checking the session first and only then
 * calling `getViewer()` (safe once we know a session exists) avoids that pitfall entirely.
 */
export async function GET(_request: NextRequest, context: RouteContext<"/api/attachments/[attachmentId]">) {
  const sessionUser = await getSessionUser();
  if (!sessionUser) return new NextResponse("Unauthorized", { status: 401 });

  const { attachmentId } = await context.params;
  const viewer = await getViewer();
  const result = await downloadAttachment(viewer, attachmentId);
  if (!result) return new NextResponse("Not found", { status: 404 });

  return new NextResponse(result.stream, {
    headers: {
      "Content-Type": result.mimeType,
      "Content-Disposition": contentDisposition(result.filename),
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-cache",
    },
  });
}
