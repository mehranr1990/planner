"use server";

import { z } from "zod";
import { getViewer } from "@/server/context";
import { invalidInput, runAction } from "@/server/run-action";
import { createLabelSchema, labelIdSchema, renameLabelSchema } from "../schemas";
import * as service from "./service";

const run = <T,>(fn: () => Promise<T>) => runAction("labels", fn);

export async function createLabelAction(raw: z.input<typeof createLabelSchema>) {
  const parsed = createLabelSchema.safeParse(raw);
  if (!parsed.success) return invalidInput(parsed.error);
  const viewer = await getViewer();
  return run(() => service.createLabel(viewer, parsed.data.context, parsed.data.name, parsed.data.color));
}

export async function renameLabelAction(raw: z.input<typeof renameLabelSchema>) {
  const parsed = renameLabelSchema.safeParse(raw);
  if (!parsed.success) return invalidInput(parsed.error);
  const viewer = await getViewer();
  return run(() => service.renameLabel(viewer, parsed.data.labelId, parsed.data.name, parsed.data.color));
}

export async function archiveLabelAction(raw: z.input<typeof labelIdSchema>) {
  const parsed = labelIdSchema.safeParse(raw);
  if (!parsed.success) return invalidInput(parsed.error);
  const viewer = await getViewer();
  return run(() => service.archiveLabel(viewer, parsed.data.labelId));
}
