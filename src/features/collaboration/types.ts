// Client-safe shapes for comments. Server code maps Prisma rows into these; client components
// import only from here, never from the generated Prisma client.

import type { PersonRef } from "@/components/ui/people";

export interface CommentItem {
  id: string;
  /** null once deleted — the row (and its original text) is retained server-side for audit only. */
  body: string | null;
  /** One level of threading: a reply's `replyToId` always points at a top-level comment. */
  replyToId: string | null;
  author: PersonRef;
  createdAt: string;
  editedAt: string | null;
  deletedAt: string | null;
  canEdit: boolean;
  canDelete: boolean;
}
