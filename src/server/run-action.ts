import "server-only";
import { revalidatePath } from "next/cache";
import type { z } from "zod";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { localizeError } from "@/i18n/errors";
import { DomainError } from "@/server/errors";

// The one server-action boundary pattern:
//   validate (Zod, codes as messages) → viewer → service → revalidate → localized result.
// Services stay language-neutral; this is the only place their codes become prose.

export async function runAction<T>(scope: string, fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    const data = await fn();
    revalidatePath("/", "layout");
    return ok(data);
  } catch (e) {
    if (e instanceof DomainError) return fail(await localizeError(e.code));
    console.error(`[${scope}] action failed`, e instanceof Error ? e.message : e);
    return fail(await localizeError("generic"));
  }
}

/** Schema messages are error codes; anything else (Zod defaults) maps to the generic message. */
export async function invalidInput(error: z.ZodError): Promise<{ ok: false; error: string }> {
  return fail(await localizeError(error.issues[0]?.message ?? "invalidInput"));
}
