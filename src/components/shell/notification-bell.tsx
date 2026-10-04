"use client";

import { Bell } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useRef, useTransition } from "react";
import { useFormat } from "@/i18n/use-format";
import { cn } from "@/lib/cn";
import { markAllNotificationsReadAction, markNotificationReadAction } from "@/features/notifications/server/actions";
import type { NotificationItem } from "@/features/notifications/types";

// Keep in sync with the `NotificationType` enum; an unknown value (e.g. a type added later
// without its i18n key yet) falls back to "other" rather than throwing.
const KNOWN_TYPES = new Set([
  "TASK_ASSIGNED",
  "TASK_COMMENTED",
  "MENTIONED",
  "TASK_DUE_SOON",
  "TASK_OVERDUE",
  "TASK_STATUS_CHANGED",
  "TASK_DUE_DATE_CHANGED",
  "TASK_UNBLOCKED",
  "INVITATION",
  "WORKSPACE_ROLE_CHANGED",
  // Batch 4: one notification standing in for several of the same event (see server/notify-bulk.ts).
  "TASK_STATUS_CHANGED_BULK",
  "TASK_DUE_DATE_CHANGED_BULK",
  "TASK_ASSIGNED_BULK",
  "TASK_UNBLOCKED_BULK",
] as const);
type KnownType = typeof KNOWN_TYPES extends Set<infer K> ? K : never;

export function NotificationBell({ notifications, unreadCount, timezone }: { notifications: NotificationItem[]; unreadCount: number; timezone: string }) {
  const t = useTranslations("notifications");
  const tn = useTranslations("navigation.notifications");
  const f = useFormat();
  const router = useRouter();
  const [pending, start] = useTransition();
  const ref = useRef<HTMLDetailsElement>(null);

  function markAll() {
    start(async () => {
      await markAllNotificationsReadAction();
      router.refresh();
    });
  }

  function openItem(item: NotificationItem) {
    ref.current?.removeAttribute("open");
    if (item.readAt) return;
    start(async () => {
      await markNotificationReadAction({ notificationId: item.id });
      router.refresh();
    });
  }

  return (
    <details ref={ref} className="group relative">
      <summary
        className="relative list-none cursor-pointer [&::-webkit-details-marker]:hidden"
        aria-label={unreadCount > 0 ? tn("unread", { count: unreadCount }) : tn("menu")}
      >
        <span className="pointer-events-none inline-flex size-10 items-center justify-center rounded-full text-foreground ring-1 ring-border-subtle transition-colors group-hover:bg-surface-elevated">
          <Bell className="size-[18px]" strokeWidth={1.75} aria-hidden />
        </span>
        {unreadCount > 0 && (
          <span
            aria-hidden
            className="tabular absolute end-0.5 top-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-accent-red px-1 text-[10px] font-medium text-white"
          >
            {unreadCount > 9 ? "9+" : f.number(unreadCount)}
          </span>
        )}
      </summary>
      <div className="animate-overlay absolute end-0 top-12 z-40 w-80 rounded-[20px] bg-surface-elevated p-2 shadow-overlay ring-1 ring-border-subtle">
        <div className="flex items-center justify-between px-2 py-1.5">
          <p className="text-sm font-medium">{t("heading")}</p>
          {unreadCount > 0 && (
            <button type="button" disabled={pending} onClick={markAll} className="text-[12.5px] text-foreground-muted hover:text-foreground">
              {t("markAllRead")}
            </button>
          )}
        </div>
        {notifications.length === 0 ? (
          <p className="px-2 py-4 text-center text-[13px] text-foreground-subtle">{t("empty")}</p>
        ) : (
          <ul className="flex max-h-96 flex-col gap-0.5 overflow-y-auto">
            {notifications.map((n) => {
              const key: KnownType | "other" = (KNOWN_TYPES as ReadonlySet<string>).has(n.type) ? (n.type as KnownType) : "other";
              return (
                <li key={n.id}>
                  <Link
                    href={n.deepLink}
                    onClick={() => openItem(n)}
                    className={cn("flex items-start gap-2 rounded-[14px] px-2 py-2 text-start text-[13px] hover:bg-surface-secondary", !n.readAt && "bg-accent-blue-soft/30")}
                  >
                    <span aria-hidden className={cn("mt-1.5 size-1.5 shrink-0 rounded-full", n.readAt ? "bg-transparent" : "bg-accent-blue")} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate" dir="auto">
                        {key.endsWith("_BULK")
                          ? t(`item.${key}`, { count: Number(n.title) || 0, actor: n.actor?.name ?? "" })
                          : t(`item.${key}`, { title: n.title, actor: n.actor?.name ?? "" })}
                      </span>
                      <time dateTime={n.createdAt} className="text-[11.5px] text-foreground-subtle" data-volatile>
                        {f.dateTime(new Date(n.createdAt), timezone)}
                      </time>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </details>
  );
}
