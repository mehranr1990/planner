import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { db } from "@/server/db";

// Database sessions: the cookie holds a random token; only its SHA-256 is stored, so a database
// leak does not yield usable sessions. Revocation = deleting the row.
export const SESSION_COOKIE = "session";
const SESSION_DAYS = 30;
const SESSION_MS = SESSION_DAYS * 86_400_000;
/** Sliding expiry is written at most this often, to avoid a write on every request. */
const TOUCH_INTERVAL_MS = 86_400_000;

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function createSession(userId: string, userAgent: string | null): Promise<void> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_MS);
  await db.session.create({
    data: { tokenHash: hashToken(token), userId, expiresAt, userAgent: userAgent?.slice(0, 255) ?? null },
  });
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await db.session.deleteMany({ where: { tokenHash: hashToken(token) } });
  jar.delete(SESSION_COOKIE);
}

/** Revokes every session of a user (password change, deactivation). */
export async function revokeAllSessions(userId: string): Promise<void> {
  await db.session.deleteMany({ where: { userId } });
}

/** Revokes every session of a user except one (e.g. the session making the change). */
export async function revokeOtherSessions(userId: string, exceptSessionId: string): Promise<void> {
  await db.session.deleteMany({ where: { userId, id: { not: exceptSessionId } } });
}

export async function revokeSession(userId: string, sessionId: string): Promise<void> {
  await db.session.deleteMany({ where: { userId, id: sessionId } });
}

export interface SessionSummary {
  id: string;
  userAgent: string | null;
  lastSeenAt: string;
  createdAt: string;
  expiresAt: string;
}

export async function listSessions(userId: string): Promise<SessionSummary[]> {
  const sessions = await db.session.findMany({
    where: { userId },
    orderBy: { lastSeenAt: "desc" },
    select: { id: true, userAgent: true, lastSeenAt: true, createdAt: true, expiresAt: true },
  });
  return sessions.map((s) => ({
    id: s.id,
    userAgent: s.userAgent,
    lastSeenAt: s.lastSeenAt.toISOString(),
    createdAt: s.createdAt.toISOString(),
    expiresAt: s.expiresAt.toISOString(),
  }));
}

export const getSessionUser = cache(async () => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = await db.session.findUnique({
    where: { tokenHash: hashToken(token) },
    select: {
      id: true,
      expiresAt: true,
      lastSeenAt: true,
      user: {
        select: {
          id: true,
          email: true,
          name: true,
          avatarUrl: true,
          timezone: true,
          locale: true,
          theme: true,
          weekStartsOn: true,
          activeWorkspaceId: true,
          deactivatedAt: true,
          onboardedAt: true,
        },
      },
    },
  });
  const now = Date.now();
  if (!session || session.expiresAt.getTime() <= now || session.user.deactivatedAt) return null;

  if (now - session.lastSeenAt.getTime() > TOUCH_INTERVAL_MS) {
    // Best effort; failure to extend must never fail the request.
    await db.session
      .update({ where: { id: session.id }, data: { lastSeenAt: new Date(now), expiresAt: new Date(now + SESSION_MS) } })
      .catch(() => undefined);
  }
  const { id, email, name, avatarUrl, timezone, locale, theme, weekStartsOn, activeWorkspaceId, onboardedAt } = session.user;
  return { id, email, name, avatarUrl, timezone, locale, theme, weekStartsOn, activeWorkspaceId, isOnboarded: onboardedAt !== null };
});

export type SessionUser = NonNullable<Awaited<ReturnType<typeof getSessionUser>>>;

/** The current request's session id, for "which row is this" (sessions list, revoke-one guard). */
export const getCurrentSessionId = cache(async (): Promise<string | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = await db.session.findUnique({ where: { tokenHash: hashToken(token) }, select: { id: true } });
  return session?.id ?? null;
});

export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/sign-in");
  return user;
}
