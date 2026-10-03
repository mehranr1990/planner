import { ChevronDown } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";

// Reference form language: white pill fields on a soft grey surface, labels above at the start.
const control =
  "w-full bg-surface-elevated text-[15px] text-foreground ring-1 ring-border-subtle transition-shadow placeholder:text-foreground-subtle hover:ring-border-strong focus:ring-border-strong focus:outline-none focus-visible:outline-2 disabled:opacity-60 aria-invalid:ring-accent-red";

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={cn(control, "h-12 rounded-full px-5", className)} {...props} />;
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea className={cn(control, "min-h-28 rounded-[22px] px-5 py-3.5 leading-6", className)} {...props} />;
}

/** Native select (keyboard + mobile pickers for free) with the chevron the reference shows at the inline end. */
export function Select({ className, dir, ...props }: ComponentProps<"select">) {
  return (
    <div className="relative" dir={dir}>
      <select className={cn(control, "h-12 cursor-pointer appearance-none rounded-full ps-5 pe-11", className)} {...props} />
      <ChevronDown aria-hidden className="pointer-events-none absolute end-4 top-1/2 size-4 -translate-y-1/2 text-foreground-muted" />
    </div>
  );
}

export function Field({
  label,
  htmlFor,
  error,
  hint,
  children,
  className,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <label htmlFor={htmlFor} className="ps-1 text-start text-[12.5px] text-foreground-muted">
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${htmlFor}-error`} role="alert" className="ps-1 text-[12.5px] text-accent-red">
          {error}
        </p>
      ) : hint ? (
        <p className="ps-1 text-[12px] text-foreground-subtle">{hint}</p>
      ) : null}
    </div>
  );
}
