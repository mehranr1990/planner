import { cn } from "@/lib/cn";

export type Tone = "blue" | "yellow" | "peach" | "red" | "green" | "slate";

const softBg: Record<Tone, string> = {
  blue: "bg-accent-blue-soft",
  yellow: "bg-accent-yellow-soft",
  peach: "bg-accent-peach-soft",
  red: "bg-accent-red-soft",
  green: "bg-accent-green-soft",
  slate: "bg-accent-slate-soft",
};

const stroke: Record<Tone, string> = {
  blue: "var(--accent-blue)",
  yellow: "var(--accent-yellow)",
  peach: "var(--accent-peach-soft)",
  red: "var(--accent-red)",
  green: "var(--accent-green)",
  slate: "var(--foreground-subtle)",
};

/**
 * Thick rounded segmented bar (reference: "Task allocation"). Segments with value 0 are omitted.
 * Segments follow the inline direction, so the bar mirrors in RTL. `ariaLabel` is the complete, localized description (callers use an ICU message). */
export function SegmentedBar({
  segments,
  ariaLabel,
  className,
}: {
  segments: { value: number; tone: Tone; key: string }[];
  ariaLabel: string;
  className?: string;
}) {
  const total = segments.reduce((s, x) => s + x.value, 0);
  const visible = segments.filter((s) => s.value > 0);
  return (
    <div
      role="img"
      aria-label={ariaLabel}
      className={cn("flex h-2 w-full gap-1", className)}
    >
      {total === 0 ? (
        <span className="h-full w-full rounded-full bg-surface-secondary" />
      ) : (
        visible.map((s) => <span key={s.key} className={cn("h-full rounded-full", softBg[s.tone])} style={{ flexGrow: s.value }} />)
      )}
    </div>
  );
}

/** Thin ring gauge (reference: "Hours spent / Payback"). Not mirrored in RTL: clockwise fill is direction-neutral. */
export function RingGauge({
  value,
  max,
  tone = "blue",
  size = 72,
  children,
  ariaLabel,
}: {
  value: number;
  max: number;
  tone?: Tone;
  size?: number;
  children?: React.ReactNode;
  /** Complete, localized description including the percentage. */
  ariaLabel: string;
}) {
  const r = (size - 8) / 2;
  const c = 2 * Math.PI * r;
  const pct = max > 0 ? Math.min(1, Math.max(0, value / max)) : 0;
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={ariaLabel} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--border-subtle)" strokeWidth={5} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={stroke[tone]}
          strokeWidth={5}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct)}
          style={{ transition: "stroke-dashoffset 600ms var(--ease-out-expo)" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">{children}</div>
    </div>
  );
}

export function Chip({ tone = "slate", children, className }: { tone?: Tone; children: React.ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex h-6 items-center gap-1 rounded-full px-2.5 text-[11.5px] font-medium whitespace-nowrap text-foreground", softBg[tone], className)}>
      {children}
    </span>
  );
}

export const PROJECT_TONES: Record<string, Tone> = {
  blue: "blue",
  red: "red",
  yellow: "yellow",
  green: "green",
  peach: "peach",
  slate: "slate",
};

export function toneOf(color: string): Tone {
  return PROJECT_TONES[color] ?? "slate";
}

export function Dot({ tone, className }: { tone: Tone; className?: string }) {
  return <span aria-hidden className={cn("inline-block size-2 rounded-full", softBg[tone], className)} />;
}
