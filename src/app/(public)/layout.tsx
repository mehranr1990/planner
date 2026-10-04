import { getTranslations } from "next-intl/server";

// Unauthenticated AND authenticated visitors can land here (e.g. /invite/[token]) — unlike
// (auth), this layout never redirects a signed-in user away.
export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const t = await getTranslations("common");
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 px-4 py-10">
      <div className="animate-overlay w-full max-w-[420px] rounded-[var(--radius-panel)] bg-surface p-6 ring-1 ring-border-subtle backdrop-blur-xl sm:p-8">
        <div className="mb-8 flex items-center gap-2.5">
          <svg viewBox="0 0 28 28" className="size-8" aria-hidden>
            <rect x="2" y="2" width="16" height="16" rx="6" fill="var(--surface-active)" />
            <rect x="10" y="10" width="16" height="16" rx="6" fill="var(--accent-blue-soft)" stroke="var(--surface-active)" strokeWidth="2" />
          </svg>
          <span className="text-[19px] font-medium tracking-[-0.02em]" dir="ltr">
            {t("brand")}
          </span>
        </div>
        {children}
      </div>
    </main>
  );
}
