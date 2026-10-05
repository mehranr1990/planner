import "server-only";
import type { AppLocale } from "@/i18n/config";
import { db } from "@/server/db";
import { DomainError } from "@/server/errors";
import { storageProvider } from "@/server/storage";
import type { Viewer } from "@/server/context";
import { validateAvatar } from "../domain/avatar";

export interface PreferencesInput {
  name?: string;
  timezone?: string;
  weekStartsOn?: number;
  theme?: "SYSTEM" | "LIGHT" | "DARK";
  locale?: AppLocale;
}

/** A user changes only their own preferences; the id always comes from the session viewer. */
export async function updatePreferences(viewer: Viewer, input: PreferencesInput) {
  await db.user.update({ where: { id: viewer.user.id }, data: input });
}

/**
 * Avatars (Batch 6, Vercel Blob): `avatarUrl` is never the Blob's own URL — it's always this
 * user's own `/api/avatars/[userId]` proxy path, so the UI never has to distinguish "no avatar"
 * from "avatar not loaded yet," and the Blob store can stay private (see docs/HANDOFF.md for why
 * avatars use a *controlled* route rather than a raw public URL, despite being low-sensitivity
 * content). `avatarStorageKey`/`avatarMimeType` are the one source of truth the proxy route reads;
 * `avatarUrl` is a derived, stable path that never needs to change across replace/remove.
 */
export async function setAvatar(viewer: Viewer, file: File): Promise<{ avatarUrl: string }> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const mimeType = file.type || "application/octet-stream";
  const error = validateAvatar({ mimeType, size: file.size, bytes });
  if (error) throw new DomainError(error);

  const stored = await storageProvider.upload({ pathname: `avatars/${viewer.user.id}/avatar`, body: bytes, contentType: mimeType });
  const avatarUrl = `/api/avatars/${viewer.user.id}`;

  const previous = await db.user.findUniqueOrThrow({ where: { id: viewer.user.id }, select: { avatarStorageKey: true } });
  try {
    await db.user.update({ where: { id: viewer.user.id }, data: { avatarUrl, avatarStorageKey: stored.storageKey, avatarMimeType: mimeType } });
  } catch (e) {
    // The Blob upload already succeeded; a failed DB write must not leave an orphaned object.
    await storageProvider.remove(stored.storageKey).catch(() => undefined);
    throw e;
  }
  // Only clean up the *previous* Blob object after the new one is already live in the DB — so a
  // failure here never leaves the user without a working avatar, just (at worst) one orphaned object.
  if (previous.avatarStorageKey) await storageProvider.remove(previous.avatarStorageKey).catch(() => undefined);
  return { avatarUrl };
}

export async function removeAvatar(viewer: Viewer): Promise<void> {
  const previous = await db.user.findUniqueOrThrow({ where: { id: viewer.user.id }, select: { avatarStorageKey: true } });
  if (!previous.avatarStorageKey) return; // idempotent: no avatar to remove
  await db.user.update({ where: { id: viewer.user.id }, data: { avatarUrl: null, avatarStorageKey: null, avatarMimeType: null } });
  await storageProvider.remove(previous.avatarStorageKey).catch(() => undefined);
}
