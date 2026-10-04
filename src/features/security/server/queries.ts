import "server-only";
import { getCurrentSessionId, listSessions as listSessionsRaw } from "@/server/auth/session";
import type { Viewer } from "@/server/context";

export async function listSessions(viewer: Viewer) {
  const [sessions, currentId] = await Promise.all([listSessionsRaw(viewer.user.id), getCurrentSessionId()]);
  return sessions.map((s) => ({ ...s, isCurrent: s.id === currentId }));
}
