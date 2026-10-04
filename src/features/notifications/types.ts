// Client-safe shape for one inbox row. Server code maps Prisma rows into this; client
// components import only from here, never from the generated Prisma client.

import type { PersonRef } from "@/components/ui/people";

export interface NotificationItem {
  id: string;
  /** `NotificationType` value, kept as a plain string so the client never imports the Prisma enum. */
  type: string;
  /** The referenced entity's own title/name (e.g. a task title) — the UI renders the sentence per `type`. */
  title: string;
  deepLink: string;
  actor: PersonRef | null;
  readAt: string | null;
  createdAt: string;
}
