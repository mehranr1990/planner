import { useTranslations } from "next-intl";

export default function Loading() {
  const t = useTranslations("common.states");
  return (
    <div role="status" aria-label={t("loading")} className="animate-pulse">
      <div className="mb-6 h-9 w-56 rounded-full bg-surface-elevated/70" />
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="h-64 rounded-[var(--radius-panel)] bg-surface lg:col-span-2" />
        <div className="h-64 rounded-[var(--radius-panel)] bg-surface" />
      </div>
    </div>
  );
}
