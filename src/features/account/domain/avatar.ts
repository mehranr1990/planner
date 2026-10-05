// Pure validation, reusing the attachments feature's generic file checks (same dangerous-extension
// / magic-byte sniff) with avatar-specific limits — see features/attachments/domain/validation.ts.

import { checkFile } from "@/features/attachments/domain/validation";

export const MAX_AVATAR_BYTES = 5 * 1024 * 1024; // 5 MB
const AVATAR_MIME_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);

export type AvatarValidationError = "avatarTooLarge" | "avatarTypeNotAllowed";

export function validateAvatar(input: { mimeType: string; size: number; bytes: Uint8Array }): AvatarValidationError | null {
  const reason = checkFile({ filename: "avatar", ...input, maxBytes: MAX_AVATAR_BYTES, allowedMimeTypes: AVATAR_MIME_TYPES });
  if (reason === "tooLarge") return "avatarTooLarge";
  if (reason === "empty" || reason === "typeNotAllowed") return "avatarTypeNotAllowed";
  return null;
}
