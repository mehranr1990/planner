import "server-only";
import { createHash, randomBytes } from "node:crypto";

// Shared by invitations and password-reset tokens: a random opaque token is handed to the
// user (link/cookie); only its SHA-256 is ever stored, so a database leak yields nothing usable.

export function generateToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
