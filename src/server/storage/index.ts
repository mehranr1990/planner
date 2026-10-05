import "server-only";
import { InMemoryStorageProvider } from "./memory";
import type { StorageProvider } from "./provider";
import { VercelBlobStorageProvider } from "./vercel-blob";

export type { StorageDownload, StorageObject, StorageProvider, StorageUploadInput } from "./provider";

function hasBlobCredentials(): boolean {
  // OIDC (set automatically once a Blob store is connected to the Vercel project) or an explicit
  // long-lived token (anywhere else) — see docs/ARCHITECTURE.md "File storage (Vercel Blob)".
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN) || Boolean(process.env.VERCEL_OIDC_TOKEN && process.env.BLOB_STORE_ID);
}

/** Thrown lazily, only when something actually tries to use storage — never at import time, so a
 * production deploy with no Blob store connected yet still builds and serves every other route;
 * only upload/download/remove calls fail, with a clear, actionable message in the server logs. */
class UnconfiguredStorageProvider implements StorageProvider {
  private fail(action: string): never {
    throw new Error(`Vercel Blob is not configured: set BLOB_READ_WRITE_TOKEN (or connect a Blob store) before ${action}.`);
  }
  async upload(): Promise<never> {
    this.fail("uploading files");
  }
  async download(): Promise<never> {
    this.fail("reading files");
  }
  async remove(): Promise<never> {
    this.fail("removing files");
  }
}

function createProvider(): StorageProvider {
  if (hasBlobCredentials()) return new VercelBlobStorageProvider();
  // Only a *real* Vercel deployment with no store connected yet is treated as misconfigured.
  // `NODE_ENV === "production"` alone isn't the right signal — a local `next start` (E2E's own
  // webServer runs one) sets it too, and must still work with no Blob store at hand, the same way
  // E2E forces EMAIL_PROVIDER=console against a production build. `VERCEL_ENV` is only ever set
  // when code actually runs on Vercel's infrastructure (same distinction src/server/__tests__/
  // helpers.ts already relies on for its production-safety guard).
  if (process.env.VERCEL_ENV) return new UnconfiguredStorageProvider();
  return new InMemoryStorageProvider();
}

// Cached on `globalThis`, not a plain module-level `let` (same trick src/server/db.ts uses) —
// Next.js can bundle Server Actions and Route Handlers into separate chunks, each with its own
// copy of this module's top-level scope; without this, an upload made from a Server Action and a
// read made from a Route Handler could resolve to two different `InMemoryStorageProvider`
// instances (and therefore two different in-memory Maps) within the same running process. Vercel
// Blob itself doesn't care (the store is external), but the in-memory dev/test adapter does.
const globalForStorage = globalThis as unknown as { storageProviderInstance?: StorageProvider };

function getInstance(): StorageProvider {
  globalForStorage.storageProviderInstance ??= createProvider();
  return globalForStorage.storageProviderInstance;
}

// Built lazily, on first actual use — not at import time (same reasoning as src/server/email/index.ts).
export const storageProvider: StorageProvider = {
  upload(input) {
    return getInstance().upload(input);
  },
  download(storageKey) {
    return getInstance().download(storageKey);
  },
  remove(storageKey) {
    return getInstance().remove(storageKey);
  },
};
