"use server";

import { z } from "zod";
import { fail, type ActionResult } from "@/lib/action-result";
import { localizeError } from "@/i18n/errors";
import { getViewer } from "@/server/context";
import { invalidInput, runAction } from "@/server/run-action";
import * as service from "./service";
import type { AttachmentItem } from "../types";

// validate → viewer → service → revalidate → localized result (src/server/run-action.ts).
// Upload takes FormData (not a Zod-validated JSON object, like every other action here) because a
// browser `File` has no meaningful Zod schema — it's validated for real in service.ts instead,
// against the actual bytes, not just the client's claims about them.

const run = <T,>(fn: () => Promise<T>) => runAction("attachments", fn);

export async function uploadAttachmentAction(form: FormData): Promise<ActionResult<AttachmentItem>> {
  const taskId = form.get("taskId");
  const file = form.get("file");
  if (typeof taskId !== "string" || !taskId || !(file instanceof File)) return fail(await localizeError("invalidInput"));
  const viewer = await getViewer();
  return run(() => service.uploadAttachment(viewer, taskId, file));
}

const idSchema = z.object({ attachmentId: z.cuid() });

export async function removeAttachmentAction(raw: z.input<typeof idSchema>): Promise<ActionResult> {
  const parsed = idSchema.safeParse(raw);
  if (!parsed.success) return invalidInput(parsed.error);
  const viewer = await getViewer();
  return run(() => service.removeAttachment(viewer, parsed.data.attachmentId));
}
