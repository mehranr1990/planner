import { useLocale } from "next-intl";
import { cn } from "@/lib/cn";
import { formatNumber } from "@/lib/format";
import type { Tone } from "./data-viz";
import { avatarTone, initialsOf, type PersonRef } from "./people";

export type { PersonRef } from "./people";

export type AvatarSize = "xs" | "sm" | "md" | "lg";

/** The ring separates overlapping faces; it must match the surface the avatar sits on. */
export type AvatarRing = "elevated" | "secondary" | "dark" | "none";

/**
 * Tiny marker under/next to a face (reference: pastel task-allocation numbers).
 * `label` is the localized meaning, appended to the avatar's accessible name.
 */
export type PersonBadge =
  | { kind: "count"; value: number; tone?: Tone; label: string }
  | { kind: "status"; tone: Tone; label: string };

const sizes: Record<AvatarSize, string> = {
  xs: "size-6 text-[10px]",
  sm: "size-8 text-[11px]",
  md: "size-10 text-[13px]",
  lg: "size-12 text-[15px]",
};

const rings: Record<AvatarRing, string> = {
  elevated: "ring-2 ring-surface-elevated",
  secondary: "ring-2 ring-surface-secondary",
  dark: "ring-2 ring-surface-dark",
  none: "",
};

const badgeTones: Record<Tone, string> = {
  blue: "bg-accent-blue-soft",
  yellow: "bg-accent-yellow-soft",
  peach: "bg-accent-peach-soft",
  red: "bg-accent-red-soft",
  green: "bg-accent-green-soft",
  slate: "bg-surface-elevated",
};

const statusTones: Record<Tone, string> = {
  blue: "bg-accent-blue",
  yellow: "bg-accent-yellow",
  peach: "bg-accent-peach-soft",
  red: "bg-accent-red",
  green: "bg-accent-green",
  slate: "bg-foreground-subtle",
};

/**
 * One person's face. Photo when available, otherwise initials on a stable pastel tone.
 * For more than one person use PeopleCluster — never hand-roll avatar rows.
 */
export function Avatar({
  person,
  size = "md",
  ring = "elevated",
  badge,
  className,
}: {
  person: PersonRef;
  size?: AvatarSize;
  ring?: AvatarRing;
  badge?: PersonBadge;
  className?: string;
}) {
  const locale = useLocale();
  const accessibleName = badge ? `${person.name} — ${badge.label}` : person.name;
  return (
    <span className={cn("relative inline-flex shrink-0", className)} title={accessibleName}>
      {person.avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- user-supplied URLs; next/image needs allow-listed hosts
        <img
          src={person.avatarUrl}
          alt={accessibleName}
          loading="lazy"
          referrerPolicy="no-referrer"
          className={cn("rounded-full bg-surface-secondary object-cover", rings[ring], sizes[size])}
        />
      ) : (
        <span
          role="img"
          aria-label={accessibleName}
          className={cn("inline-flex items-center justify-center rounded-full font-medium text-foreground select-none", rings[ring], sizes[size], avatarTone(person.id))}
        >
          {/* 24px faces only fit one letter legibly (and stay readable when overlapped). */}
          <span aria-hidden>{initialsOf(person.name, size === "xs" ? 1 : 2)}</span>
        </span>
      )}
      {badge?.kind === "count" && (
        <span
          aria-hidden
          className={cn(
            "tabular absolute inset-x-0 -bottom-1.5 mx-auto inline-flex h-4 w-fit min-w-4 items-center justify-center rounded-full px-1 text-[10px] leading-none font-medium text-foreground ring-1 ring-border-subtle",
            badgeTones[badge.tone ?? "slate"],
          )}
        >
          {formatNumber(badge.value, locale)}
        </span>
      )}
      {badge?.kind === "status" && (
        <span aria-hidden className={cn("absolute -end-0.5 -bottom-0.5 size-2.5 rounded-full ring-2 ring-surface-elevated", statusTones[badge.tone])} />
      )}
    </span>
  );
}
