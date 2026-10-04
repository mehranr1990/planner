// Mentions are stored inline in the comment body as `@[Name](userId)` tokens, not parsed by
// matching free-text names: names aren't unique identifiers, so regex-matching "@Bob" against a
// workspace with two Bobs would silently mention the wrong one. The composer inserts the token
// when a user picks a candidate from the autocomplete list; the name inside it is a point-in-time
// display snapshot, so rendering never needs a live user lookup.

const MENTION_TOKEN = /@\[([^\]\n]{1,100})\]\(([a-z0-9]{20,32})\)/g;

export interface ParsedMention {
  name: string;
  userId: string;
}

/** Extracts mentions in document order, keeping only the first occurrence of each user id. */
export function parseMentions(body: string): ParsedMention[] {
  const seen = new Set<string>();
  const out: ParsedMention[] = [];
  for (const m of body.matchAll(MENTION_TOKEN)) {
    const userId = m[2]!;
    if (seen.has(userId)) continue;
    seen.add(userId);
    out.push({ name: m[1]!, userId });
  }
  return out;
}

/** Builds the inline token the composer inserts when a mention candidate is picked. */
export function mentionToken(name: string, userId: string): string {
  return `@[${name.replace(/[[\]()]/g, "")}](${userId})`;
}

export type CommentBodyPart = { type: "text"; value: string } | { type: "mention"; name: string; userId: string };

/** Splits a stored comment body into plain-text and mention parts, for rendering. */
export function renderCommentBody(body: string): CommentBodyPart[] {
  const parts: CommentBodyPart[] = [];
  let lastIndex = 0;
  for (const m of body.matchAll(MENTION_TOKEN)) {
    const index = m.index ?? 0;
    if (index > lastIndex) parts.push({ type: "text", value: body.slice(lastIndex, index) });
    parts.push({ type: "mention", name: m[1]!, userId: m[2]! });
    lastIndex = index + m[0].length;
  }
  if (lastIndex < body.length) parts.push({ type: "text", value: body.slice(lastIndex) });
  return parts;
}
