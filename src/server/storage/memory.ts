import "server-only";
import type { StorageDownload, StorageObject, StorageProvider, StorageUploadInput } from "./provider";

/**
 * Dev/test default: an in-process, in-memory store — so local work and the Vitest integration
 * suite never depend on a real Blob store or credentials (mirrors `ConsoleEmailProvider`'s role
 * in src/server/email/console.ts). Unlike the email console adapter this one actually round-trips
 * bytes, since attachment/avatar tests need to read back what they uploaded. Not persisted across
 * process restarts — fine for its only two consumers (a local `next dev` run, and a single Vitest
 * process that creates and reads back its own fixtures).
 */
export class InMemoryStorageProvider implements StorageProvider {
  private readonly objects = new Map<string, { body: Uint8Array; contentType: string }>();

  async upload(input: StorageUploadInput): Promise<StorageObject> {
    const storageKey = `${input.pathname}-${Math.random().toString(36).slice(2, 10)}`;
    this.objects.set(storageKey, { body: input.body, contentType: input.contentType });
    return { storageKey, size: input.body.byteLength, contentType: input.contentType };
  }

  async download(storageKey: string): Promise<StorageDownload | null> {
    const entry = this.objects.get(storageKey);
    if (!entry) return null;
    const body = entry.body;
    return {
      stream: new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(body);
          controller.close();
        },
      }),
      contentType: entry.contentType,
      size: body.byteLength,
    };
  }

  async remove(storageKey: string): Promise<void> {
    this.objects.delete(storageKey);
  }
}
