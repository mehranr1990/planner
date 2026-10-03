// Pure helpers behind Avatar / PeopleCluster (unit-tested). No React, no I/O.

export interface PersonRef {
  id: string;
  name: string;
  avatarUrl: string | null;
}

/** Soft pastel backgrounds for initials, in token form. Order is part of the stable mapping. */
export const AVATAR_TONES = [
  "bg-accent-blue-soft",
  "bg-accent-yellow-soft",
  "bg-accent-peach-soft",
  "bg-accent-green-soft",
  "bg-accent-red-soft",
] as const;

/** Same person → same tone everywhere (hash of the stable id, never of the display name). */
export function avatarTone(id: string): (typeof AVATAR_TONES)[number] {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return AVATAR_TONES[Math.abs(h) % AVATAR_TONES.length]!;
}

/**
 * Up to two initials: first letter of the first and last word. Works for any script
 * (Persian "مینا رحیمی" → "مر"); code points, not UTF-16 units, so emoji/surrogates survive.
 */
export function initialsOf(name: string, max: 1 | 2 = 2): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  const first = Array.from(words[0]!)[0] ?? "";
  const last = max === 2 && words.length > 1 ? (Array.from(words.at(-1)!)[0] ?? "") : "";
  return (first + last).toLocaleUpperCase();
}

/**
 * Splits a people list into the faces to show and the "+N" remainder.
 * `total` may exceed `people.length` when the caller only loaded a preview (e.g. 5 of 23 members).
 * When exactly one person would hide behind "+1", that face is shown instead — a "+1" chip
 * takes the same room as the avatar it hides.
 */
export function splitPeople<T>(people: readonly T[], max: number, total = people.length): { visible: T[]; overflow: number } {
  const limit = Math.max(1, max);
  const count = Math.max(total, people.length);
  if (count <= limit) return { visible: people.slice(0, limit), overflow: 0 };
  if (count === limit + 1 && people.length > limit) return { visible: people.slice(0, limit + 1), overflow: 0 };
  const visible = people.slice(0, limit);
  return { visible, overflow: count - visible.length };
}
