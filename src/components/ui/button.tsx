import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

const variants: Record<Variant, string> = {
  primary: "bg-surface-active text-foreground-on-active hover:opacity-90",
  secondary: "bg-surface-elevated text-foreground ring-1 ring-border-subtle hover:ring-border-strong",
  ghost: "text-foreground-muted hover:bg-surface-secondary hover:text-foreground",
  danger: "bg-surface-elevated text-accent-red ring-1 ring-border-subtle hover:bg-accent-red-soft/40",
};

const sizes: Record<Size, string> = {
  sm: "h-8 px-3.5 text-[13px] gap-1.5",
  md: "h-10 px-5 text-sm gap-2",
  lg: "h-12 px-6 text-[15px] gap-2",
};

export function buttonClass(variant: Variant = "secondary", size: Size = "md", className?: string) {
  return cn(
    "inline-flex shrink-0 items-center justify-center rounded-full font-medium whitespace-nowrap transition-[background-color,opacity,box-shadow] duration-150 disabled:pointer-events-none disabled:opacity-50",
    variants[variant],
    sizes[size],
    className,
  );
}

export function Button({
  variant,
  size,
  className,
  type = "button",
  ...props
}: ComponentProps<"button"> & { variant?: Variant; size?: Size }) {
  return <button type={type} className={buttonClass(variant, size, className)} {...props} />;
}

export function ButtonLink({
  variant,
  size,
  className,
  ...props
}: ComponentProps<typeof Link> & { variant?: Variant; size?: Size }) {
  return <Link className={buttonClass(variant, size, className)} {...props} />;
}

type IconButtonSize = "sm" | "md" | "lg";
const iconSizes: Record<IconButtonSize, string> = { sm: "size-8", md: "size-10", lg: "size-12" };

/** Circular icon-only control. `label` is required: it is the accessible name and tooltip. */
export function IconButton({
  label,
  size = "md",
  active = false,
  className,
  children,
  type = "button",
  ...props
}: Omit<ComponentProps<"button">, "aria-label"> & { label: string; size?: IconButtonSize; active?: boolean; children: ReactNode }) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full transition-colors duration-150 disabled:opacity-50",
        iconSizes[size],
        active
          ? "bg-surface-active text-foreground-on-active"
          : "text-foreground ring-1 ring-border-subtle hover:bg-surface-elevated",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function IconLink({
  label,
  size = "md",
  active = false,
  className,
  children,
  ...props
}: Omit<ComponentProps<typeof Link>, "aria-label"> & { label: string; size?: IconButtonSize; active?: boolean; children: ReactNode }) {
  return (
    <Link
      aria-label={label}
      title={label}
      aria-current={active ? "page" : undefined}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full transition-colors duration-150",
        iconSizes[size],
        active
          ? "bg-surface-active text-foreground-on-active"
          : "text-foreground ring-1 ring-border-subtle hover:bg-surface-elevated",
        className,
      )}
      {...props}
    >
      {children}
    </Link>
  );
}
