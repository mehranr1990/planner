import { z } from "zod";

export const createCommentSchema = z.object({
  taskId: z.cuid(),
  body: z.string().trim().min(1, "commentBodyRequired").max(5_000),
  replyToId: z.cuid().nullable().default(null),
});

export const updateCommentSchema = z.object({
  commentId: z.cuid(),
  body: z.string().trim().min(1, "commentBodyRequired").max(5_000),
});

export const commentIdSchema = z.object({ commentId: z.cuid() });
