import { useLocale, useTranslations } from "next-intl";
import { cn } from "@/lib/cn";
import { formatNumber } from "@/lib/format";
import { Avatar, type AvatarRing, type AvatarSize, type PersonBadge } from "./avatar";
import { splitPeople, type PersonRef } from "./people";

export interface ClusterPerson extends PersonRef {
  badge?: PersonBadge;
}

/**
 * The standard way to show a small group of people attached to something — project members,
 * assignees, watchers, participants, reviewers, workspace previews (DESIGN_SYSTEM §13).
 *
 * Variants (both from the reference):
 *  - "overlap": compact stack with partial overlap (cards, rows, workflow nodes).
 *  - "spaced":  faces side by side with room for count/status badges (allocation rows).
 *  - "strip":   "spaced" inside a soft pill surface (detail-page headers).
 *
 * Renders nothing for an empty list — the caller owns the empty state.
 */
export function PeopleCluster({
  people,
  label,
  total,
  max = 4,
  size = "sm",
  variant = "overlap",
  on = "elevated",
  className,
}: {
  people: readonly ClusterPerson[];
  /** Localized meaning of the group ("Project members"); the group's accessible name. */
  label: string;
  /** Real total when `people` is a preview. */
  total?: number;
  max?: number;
  size?: AvatarSize;
  variant?: "overlap" | "spaced" | "strip";
  /** Surface behind the faces, so separating rings blend in. */
  on?: AvatarRing;
  className?: string;
}) {
  const t = useTranslations("common.people");
  const locale = useLocale();
  if (people.length === 0) return null;

  const { visible, overflow } = splitPeople(people, max, total);
  const ring: AvatarRing = variant === "strip" ? "secondary" : on;
  const hasCountBadge = visible.some((p) => p.badge?.kind === "count");

  return (
    <div
      role="group"
      aria-label={label}
      className={cn(
        "flex w-fit items-center",
        variant === "overlap" ? OVERLAP[size] : "gap-1.5",
        variant === "strip" && "rounded-full bg-surface-secondary p-1.5 ring-1 ring-border-subtle",
        hasCountBadge && (variant === "strip" ? "pb-3" : "pb-1.5"),
        className,
      )}
    >
      {visible.map((p) => (
        <Avatar key={p.id} person={p} size={size} ring={ring} badge={p.badge} />
      ))}
      {overflow > 0 && (
        <span
          role="img"
          aria-label={t("overflow", { count: overflow })}
          title={t("overflow", { count: overflow })}
          className={cn(
            "tabular inline-flex shrink-0 items-center justify-center rounded-full bg-surface-secondary font-medium text-foreground-muted",
            SIZE[size],
            ring !== "none" && (ring === "dark" ? "ring-2 ring-surface-dark" : ring === "secondary" ? "bg-surface-elevated ring-2 ring-surface-secondary" : "ring-2 ring-surface-elevated"),
          )}
        >
          <span aria-hidden>+{formatNumber(overflow, locale)}</span>
        </span>
      )}
    </div>
  );
}

// Overlap ≈ a fifth of the face, so the uncovered part still clears centred initials.
// `space-x` is logical in Tailwind 4, so the stack mirrors in RTL.
const OVERLAP: Record<AvatarSize, string> = {
  xs: "-space-x-1",
  sm: "-space-x-1",
  md: "-space-x-2",
  lg: "-space-x-2.5",
};

const SIZE: Record<AvatarSize, string> = {
  xs: "size-6 text-[10px]",
  sm: "size-8 text-[11px]",
  md: "size-10 text-[12px]",
  lg: "size-12 text-[13px]",
};
