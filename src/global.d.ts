import type { AppLocale } from "@/i18n/config";
import type { Messages } from "@/i18n/messages";

// Type-safe message keys and locales for next-intl (useTranslations / getTranslations).
declare module "next-intl" {
  interface AppConfig {
    Locale: AppLocale;
    Messages: Messages;
  }
}
