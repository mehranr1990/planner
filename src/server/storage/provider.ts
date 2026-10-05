import "server-only";

// Domain/service code depends only on this interface (mirrors src/server/email/provider.ts,
// ARCHITECTURE.md D14) — never on a vendor SDK directly, so the provider stays swappable without
// touching business logic. Metadata (filename, mime type, size, uploader…) always lives in our own
// tables (Attachment, User); `storageKey` is just the stable handle this interface uses to fetch or
// remove the underlying bytes — the DB row is the record, never the provider's own URL (§39: "metadata
// is separate from the storage provider").

export interface StorageUploadInput {
  /** Caller-chosen path hint (e.g. `tasks/<taskId>/<cuid>-<filename>`); the provider may adjust it
   * (Vercel Blob appends a random suffix) — the key actually used comes back in the result. */
  pathname: string;
  body: Uint8Array;
  contentType: string;
}

export interface StorageObject {
  /** The provider's stable key for this object — store this, not a URL. */
  storageKey: string;
  size: number;
  contentType: string;
}

export interface StorageDownload {
  stream: ReadableStream<Uint8Array>;
  contentType: string;
  size: number;
}

export interface StorageProvider {
  upload(input: StorageUploadInput): Promise<StorageObject>;
  /** `null` when the object no longer exists (already removed, or never completed upload). */
  download(storageKey: string): Promise<StorageDownload | null>;
  /** Best-effort: removing an already-missing object is not an error. */
  remove(storageKey: string): Promise<void>;
}
