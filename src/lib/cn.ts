/** Joins class names, skipping falsy values. Deliberately tiny — no clsx/tailwind-merge needed. */
export function cn(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(" ");
}
