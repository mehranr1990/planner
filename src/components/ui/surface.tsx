import type { ComponentProps, ReactNode } from "react";
import { useLocale } from "next-intl";
import { cn } from "@/lib/cn";
import { formatNumber } from "@/lib/format";

/** Level-1 page panel: large radius, translucent, blurred. */
export function Panel({ className, ...props }: ComponentProps<"section">) {
  return (
    <section
      className={cn("rounded-[var(--radius-panel)] bg-surface p-4 ring-1 ring-border-subtle backdrop-blur-xl sm:p-6", className)}
      {...props}
    />
  );
}

/** Level-2 nested card. */
export function Card({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("rounded-[var(--radius-card)] bg-surface-elevated p-4 ring-1 ring-border-subtle sm:p-5", className)} {...props} />;
}

/** The one dark focus surface allowed per view. */
export function DarkCard({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("rounded-[var(--radius-card)] bg-surface-dark p-5 text-foreground-on-dark", className)} {...props} />;
}

export function SectionHeader({
  title,
  count,
  actions,
  className,
  as: Heading = "h2",
}: {
  title: ReactNode;
  count?: number;
  actions?: ReactNode;
  className?: string;
  as?: "h2" | "h3";
}) {
  const locale = useLocale();
  return (
    <div className={cn("mb-4 flex items-center justify-between gap-3", className)}>
      <Heading className="flex items-center gap-2 text-[17px] leading-6 font-medium tracking-[-0.01em]">
        {title}
        {count !== undefined && (
          <span className="tabular inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-surface-elevated px-1.5 text-[11px] font-medium text-foreground-muted ring-1 ring-border-subtle">
            {formatNumber(count, locale)}
          </span>
        )}
      </Heading>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

export function PageTitle({ children, actions }: { children: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-4 sm:mb-6">
      <h1 className="text-[30px] leading-[34px] font-medium tracking-[-0.02em] sm:text-[32px] sm:leading-[38px]">{children}</h1>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

export function EmptyState({ title, hint, action, className }: { title: string; hint?: string; action?: ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-2 rounded-[var(--radius-card)] px-6 py-12 text-center", className)}>
      <p className="text-[15px] font-medium">{title}</p>
      {hint && <p className="max-w-sm text-[13px] text-foreground-muted">{hint}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

export function Metric({ value, unit, label }: { value: ReactNode; unit?: string; label: string }) {
  return (
    <div>
      <p className="tabular text-[28px] leading-8 font-normal tracking-[-0.02em]">
        {value}
        {unit && <span className="ms-0.5 text-[13px] text-foreground-muted">{unit}</span>}
      </p>
      <p className="mt-0.5 text-[12.5px] text-foreground-muted">{label}</p>
    </div>
  );
}
