// Shape returned by every server action. `error` is already localized for the request's
// locale (see src/i18n/errors.ts); it never contains internals.

export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string[] | undefined> };

export function ok(): ActionResult<void>;
export function ok<T>(data: T): ActionResult<T>;
export function ok<T>(data?: T): ActionResult<T | void> {
  return { ok: true, data: data as T };
}

export function fail(error: string, fieldErrors?: Record<string, string[] | undefined>): { ok: false; error: string; fieldErrors?: Record<string, string[] | undefined> } {
  return { ok: false, error, fieldErrors };
}

/** Error codes (keys of the `errors` catalog). Same code for "doesn't exist" and "not allowed". */
export const NOT_FOUND = "notFound";
export const CONFLICT = "conflict";
