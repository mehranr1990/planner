import "server-only";
import { BlobNotFoundError, del, get, put } from "@vercel/blob";
import type { StorageDownload, StorageObject, StorageProvider, StorageUploadInput } from "./provider";

/**
 * Real adapter: a single PRIVATE Vercel Blob store. Every object is uploaded with `access:
 * "private"` — private stores require authentication for every read and write (no plain,
 * guessable URL ever works), so confidentiality for sensitive content (task attachments) comes
 * from the store itself, not just from `addRandomSuffix`. Reads always go through this adapter's
 * `download()`, called from an authenticated route that re-checks the caller's own permissions
 * first (src/app/api/attachments/[attachmentId]/route.ts) — "private" here is about the storage
 * layer; the actual authorization decision is still ours, every time.
 */
export class VercelBlobStorageProvider implements StorageProvider {
  async upload(input: StorageUploadInput): Promise<StorageObject> {
    const blob = await put(input.pathname, Buffer.from(input.body), {
      access: "private",
      addRandomSuffix: true,
      contentType: input.contentType,
    });
    return { storageKey: blob.pathname, size: input.body.byteLength, contentType: input.contentType };
  }

  async download(storageKey: string): Promise<StorageDownload | null> {
    const result = await get(storageKey, { access: "private" });
    if (!result || result.statusCode !== 200) return null;
    return { stream: result.stream, contentType: result.blob.contentType, size: result.blob.size };
  }

  async remove(storageKey: string): Promise<void> {
    try {
      await del(storageKey);
    } catch (e) {
      if (!(e instanceof BlobNotFoundError)) throw e; // already gone — not an error for a best-effort cleanup
    }
  }
}
