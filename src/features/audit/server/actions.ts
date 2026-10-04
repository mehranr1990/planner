"use server";

import { z } from "zod";
import { NOT_FOUND } from "@/lib/action-result";
import type { ActionResult } from "@/lib/action-result";
import { getViewer } from "@/server/context";
import { DomainError } from "@/server/errors";
import { invalidInput, runAction } from "@/server/run-action";
import * as queries from "./queries";

const schema = z.object({ workspaceId: z.cuid(), cursor: z.string().optional() });

type AuditPage = NonNullable<Awaited<ReturnType<typeof queries.listAuditEvents>>>;

export async function listAuditEventsAction(raw: z.input<typeof schema>): Promise<ActionResult<AuditPage>> {
  const parsed = schema.safeParse(raw);
  if (!parsed.success) return invalidInput(parsed.error);
  const viewer = await getViewer();
  return runAction("audit", async () => {
    const page = await queries.listAuditEvents(viewer, parsed.data.workspaceId, parsed.data.cursor);
    if (!page) throw new DomainError(NOT_FOUND);
    return page;
  });
}
