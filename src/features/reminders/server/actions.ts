"use server";

import { z } from "zod";
import { getViewer } from "@/server/context";
import { invalidInput, runAction } from "@/server/run-action";
import { removeReminderSchema, setReminderSchema } from "../schemas";
import * as service from "./service";

const run = <T,>(fn: () => Promise<T>) => runAction("reminders", fn);

export async function setReminderAction(raw: z.input<typeof setReminderSchema>) {
  const parsed = setReminderSchema.safeParse(raw);
  if (!parsed.success) return invalidInput(parsed.error);
  const viewer = await getViewer();
  return run(() => service.setReminder(viewer, parsed.data));
}

export async function removeReminderAction(raw: z.input<typeof removeReminderSchema>) {
  const parsed = removeReminderSchema.safeParse(raw);
  if (!parsed.success) return invalidInput(parsed.error);
  const viewer = await getViewer();
  return run(() => service.removeReminder(viewer, parsed.data.taskId));
}
