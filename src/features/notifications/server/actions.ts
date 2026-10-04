"use server";

import { z } from "zod";
import { getViewer } from "@/server/context";
import { invalidInput, runAction } from "@/server/run-action";
import { notificationIdSchema } from "../schemas";
import * as service from "./service";

const run = <T,>(fn: () => Promise<T>) => runAction("notifications", fn);

export async function markNotificationReadAction(raw: z.input<typeof notificationIdSchema>) {
  const parsed = notificationIdSchema.safeParse(raw);
  if (!parsed.success) return invalidInput(parsed.error);
  const viewer = await getViewer();
  return run(() => service.markNotificationRead(viewer, parsed.data.notificationId));
}

export async function markAllNotificationsReadAction() {
  const viewer = await getViewer();
  return run(() => service.markAllNotificationsRead(viewer));
}
