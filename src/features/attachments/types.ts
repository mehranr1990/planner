// Client-safe shape. Server code maps Prisma rows into this; client components import only from
// here, never from the generated Prisma client (same convention as features/tasks/types.ts).

export interface AttachmentItem {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
  createdAt: string;
  uploadedBy: { id: string; name: string; avatarUrl: string | null };
  canDelete: boolean;
}
