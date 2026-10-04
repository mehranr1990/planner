import "server-only";
import type { AppLocale } from "@/i18n/config";
import { isValidTimeZone } from "@/lib/time";
import { dummyPasswordHash, hashPassword, verifyPassword } from "@/server/auth/password";
import { revokeAllSessions } from "@/server/auth/session";
import { generateToken, hashToken } from "@/server/auth/token";
import { db, isUniqueViolation } from "@/server/db";
import { emailProvider } from "@/server/email";
import { DomainError } from "@/server/errors";

const RESET_EXPIRY_MS = 60 * 60_000; // 1 hour
const APP_URL = process.env.APP_URL ?? "http://localhost:3000";

/** Creates an account. The locale is the language the visitor signed up in. */
export async function registerUser(input: { name: string; email: string; password: string; timezone?: string; locale: AppLocale }): Promise<{ userId: string }> {
  const timezone = input.timezone && isValidTimeZone(input.timezone) ? input.timezone : "UTC";
  try {
    const user = await db.user.create({
      data: { name: input.name, email: input.email, passwordHash: await hashPassword(input.password), timezone, locale: input.locale },
      select: { id: true },
    });
    return { userId: user.id };
  } catch (e) {
    if (isUniqueViolation(e)) throw new DomainError("emailTaken");
    throw e;
  }
}

/**
 * Verifies credentials. A hash comparison always runs, so response time doesn't reveal which
 * emails exist; every failure is the same error.
 */
export async function authenticate(input: { email: string; password: string }): Promise<{ userId: string }> {
  const user = await db.user.findUnique({ where: { email: input.email }, select: { id: true, passwordHash: true, deactivatedAt: true } });
  const valid = await verifyPassword(input.password, user?.passwordHash ?? (await dummyPasswordHash()));
  if (!user || !valid || user.deactivatedAt) throw new DomainError("invalidCredentials");
  return { userId: user.id };
}

/**
 * Always succeeds from the caller's point of view — the response never reveals whether the
 * email exists (Q-PO-12). If it does, a single-use, expiring, hashed token is issued and any
 * prior unused token for the user is invalidated (Q-DM-9: newest request wins).
 */
export async function requestPasswordReset(email: string): Promise<void> {
  const user = await db.user.findUnique({ where: { email: email.toLowerCase() }, select: { id: true, deactivatedAt: true } });
  if (!user || user.deactivatedAt) return;

  const token = generateToken();
  const expiresAt = new Date(Date.now() + RESET_EXPIRY_MS);
  await db.$transaction(async (tx) => {
    await tx.passwordResetToken.deleteMany({ where: { userId: user.id, usedAt: null } });
    await tx.passwordResetToken.create({ data: { userId: user.id, tokenHash: hashToken(token), expiresAt } });
  });

  await emailProvider
    .send({ to: email.toLowerCase(), template: "password-reset", data: { resetUrl: `${APP_URL}/reset-password/${token}` } })
    .catch((e) => console.error("[auth] password reset email failed", e instanceof Error ? e.message : e));
}

export async function resetPassword(token: string, newPassword: string): Promise<void> {
  const record = await db.passwordResetToken.findUnique({ where: { tokenHash: hashToken(token) }, select: { id: true, userId: true, usedAt: true, expiresAt: true } });
  if (!record || record.usedAt || record.expiresAt.getTime() <= Date.now()) throw new DomainError("resetTokenInvalid");

  await db.$transaction(async (tx) => {
    await tx.user.update({ where: { id: record.userId }, data: { passwordHash: await hashPassword(newPassword) } });
    await tx.passwordResetToken.update({ where: { id: record.id }, data: { usedAt: new Date() } });
  });
  await revokeAllSessions(record.userId);
}
