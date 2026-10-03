import "server-only";
import type { AppLocale } from "@/i18n/config";
import { isValidTimeZone } from "@/lib/time";
import { dummyPasswordHash, hashPassword, verifyPassword } from "@/server/auth/password";
import { db, isUniqueViolation } from "@/server/db";
import { DomainError } from "@/server/errors";

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
