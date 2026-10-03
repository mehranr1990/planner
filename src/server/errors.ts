import type { ErrorCode } from "@/i18n/messages";

/**
 * Expected, user-presentable failure identified by a stable code (a key of the `errors`
 * catalog). Services and domain code throw it; only the action boundary translates it.
 * Anything else thrown is a bug: logged, never shown.
 */
export class DomainError extends Error {
  constructor(public readonly code: ErrorCode) {
    super(code);
  }
}
