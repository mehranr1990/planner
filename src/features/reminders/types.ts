// Client-safe shape for a task's reminder. Server code maps Prisma rows into this; client
// components import only from here, never from the generated Prisma client.

export interface ReminderDetail {
  /** ISO instant, UTC. */
  remindAt: string;
  delivered: boolean;
}
