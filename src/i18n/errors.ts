import "server-only";
import { getTranslations } from "next-intl/server";
import type { RecurrenceErrorCode } from "@/features/tasks/domain/recurrence";
import type { ScheduleErrorCode } from "@/features/tasks/domain/schedule";
import type { ErrorCode } from "./messages";

// Domain and service code throw stable error *codes*; translation happens only here, at the
// action boundary, in the request's locale. These checks make a missing catalog entry a
// type error rather than a runtime surprise.
type Covers<T extends ErrorCode> = T;
export type DomainErrorCodes = Covers<ScheduleErrorCode | RecurrenceErrorCode>;

export function isErrorCode(value: string, known: Record<string, unknown>): value is ErrorCode {
  return Object.prototype.hasOwnProperty.call(known, value);
}

/** Localizes a code; unknown codes (e.g. a library message) fall back to the generic error. */
export async function localizeError(code: string): Promise<string> {
  const t = await getTranslations("errors");
  return t.has(code as ErrorCode) ? t(code as ErrorCode) : t("generic");
}
