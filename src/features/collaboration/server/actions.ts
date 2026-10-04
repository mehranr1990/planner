"use server";

import { z } from "zod";
import { getViewer } from "@/server/context";
import { invalidInput, runAction } from "@/server/run-action";
import { commentIdSchema, createCommentSchema, updateCommentSchema } from "../schemas";
import * as service from "./service";

const run = <T,>(fn: () => Promise<T>) => runAction("collaboration", fn);

export async function createCommentAction(raw: z.input<typeof createCommentSchema>) {
  const parsed = createCommentSchema.safeParse(raw);
  if (!parsed.success) return invalidInput(parsed.error);
  const viewer = await getViewer();
  return run(() => service.createComment(viewer, parsed.data.taskId, parsed.data.body, parsed.data.replyToId));
}

export async function updateCommentAction(raw: z.input<typeof updateCommentSchema>) {
  const parsed = updateCommentSchema.safeParse(raw);
  if (!parsed.success) return invalidInput(parsed.error);
  const viewer = await getViewer();
  return run(() => service.updateComment(viewer, parsed.data.commentId, parsed.data.body));
}

export async function deleteCommentAction(raw: z.input<typeof commentIdSchema>) {
  const parsed = commentIdSchema.safeParse(raw);
  if (!parsed.success) return invalidInput(parsed.error);
  const viewer = await getViewer();
  return run(() => service.deleteComment(viewer, parsed.data.commentId));
}
