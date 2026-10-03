import { LogOut, Plus, Settings } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { Avatar } from "@/components/ui/avatar";
import { IconLink } from "@/components/ui/button";
import { signOutAction } from "@/features/auth/server/actions";
import type { Viewer } from "@/server/context";
import { ContextSwitcher } from "./context-switcher";
import { MobileTabBar } from "./mobile-tab-bar";
import { Rail } from "./rail";

function BrandMark() {
  const t = useTranslations();
  // Original mark: two offset rounded tiles (a plan + its execution). Not derived from any reference logo.
  return (
    <Link href="/home" className="flex items-center gap-2.5" aria-label={t("navigation.homeLink")}>
      <svg viewBox="0 0 28 28" className="size-7" aria-hidden>
        <rect x="2" y="2" width="16" height="16" rx="6" fill="var(--surface-active)" />
        <rect x="10" y="10" width="16" height="16" rx="6" fill="var(--accent-blue-soft)" stroke="var(--surface-active)" strokeWidth="2" />
      </svg>
      <span className="hidden text-[19px] font-medium tracking-[-0.02em] sm:inline" dir="ltr">
        {t("common.brand")}
      </span>
    </Link>
  );
}

function AccountMenu({ viewer }: { viewer: Viewer }) {
  const t = useTranslations("navigation");
  return (
    <details className="group relative">
      <summary className="list-none rounded-full [&::-webkit-details-marker]:hidden" aria-label={t("accountMenu")}>
        <Avatar person={viewer.user} size="md" className="cursor-pointer" />
      </summary>
      <div className="animate-overlay absolute end-0 top-12 z-40 w-60 rounded-[20px] bg-surface-elevated p-2 shadow-overlay ring-1 ring-border-subtle">
        <div className="px-3 py-2">
          <p className="truncate text-sm font-medium">{viewer.user.name}</p>
          <p className="truncate text-[12.5px] text-foreground-muted" dir="ltr">
            {viewer.user.email}
          </p>
        </div>
        <Link href="/settings" className="flex items-center gap-3 rounded-[14px] px-3 py-2.5 text-sm hover:bg-surface-secondary">
          <Settings className="size-4 text-foreground-muted" aria-hidden /> {t("settings")}
        </Link>
        <form action={signOutAction}>
          <button type="submit" className="flex w-full items-center gap-3 rounded-[14px] px-3 py-2.5 text-start text-sm hover:bg-surface-secondary">
            {/* The arrow points out of the reading direction, so it mirrors in RTL. */}
            <LogOut className="size-4 text-foreground-muted rtl:-scale-x-100" aria-hidden /> {t("signOut")}
          </button>
        </form>
      </div>
    </details>
  );
}

export function AppShell({ viewer, children }: { viewer: Viewer; children: ReactNode }) {
  const t = useTranslations();
  return (
    <div className="flex min-h-dvh">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:start-3 focus:top-3 focus:z-50 focus:rounded-full focus:bg-surface-elevated focus:px-4 focus:py-2">
        {t("common.skipToContent")}
      </a>
      <Rail theme={viewer.user.theme} />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-[76px] items-center gap-3 bg-gradient-to-b from-background via-background/90 to-transparent px-4 sm:px-6 lg:ps-2">
          <BrandMark />
          <div className="ms-1 sm:ms-6">
            <ContextSwitcher workspaces={viewer.workspaces.map((w) => ({ id: w.id, name: w.name }))} activeId={viewer.activeWorkspace?.id ?? null} />
          </div>
          <div className="ms-auto flex items-center gap-2">
            <IconLink href="/planner/inbox#quick-add" label={t("navigation.quickAdd")} className="hidden sm:inline-flex">
              <Plus className="size-[18px]" strokeWidth={1.75} aria-hidden />
            </IconLink>
            <AccountMenu viewer={viewer} />
          </div>
        </header>
        <main id="main" className="min-w-0 flex-1 px-4 pb-32 sm:px-6 lg:ps-2 lg:pe-8 lg:pb-10">
          {children}
        </main>
      </div>
      <MobileTabBar />
    </div>
  );
}
