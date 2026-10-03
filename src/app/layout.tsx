import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans, Vazirmatn } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getTranslations } from "next-intl/server";
import { directionOf } from "@/i18n/config";
import { getSessionUser } from "@/server/auth/session";
import "./globals.css";

// Latin: Plus Jakarta Sans (OFL; Lufga stand-in). Persian/Arabic script: Vazirmatn (OFL) —
// geometric, soft terminals, full Persian digit set. Both are always declared so mixed-script
// text (a Persian title in an English UI, or vice versa) renders in the right face; the
// browser only downloads a file when its unicode-range is used. See DESIGN_SYSTEM §3.
const display = Plus_Jakarta_Sans({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const persian = Vazirmatn({
  variable: "--font-persian",
  subsets: ["arabic"],
  weight: ["400", "500", "600"],
});

/** "'Family', 'Family Fallback'" → ["'Family'", "'Family Fallback'"] */
function families(fontFamily: string): [string, string] {
  const [real = "", fallback = ""] = fontFamily.split(",").map((f) => f.trim());
  return [real, fallback];
}

/**
 * One explicit stack per direction: both real families first, then the metric-matched CLS
 * fallback, then system fonts. next/font's own variables put each family's local-Arial
 * fallback directly after it, and that fallback (unicode-range U+0-10FFFF) captured the other
 * script's glyphs — Persian text in the English UI rendered in adjusted Arial with broken
 * joining. Ordering here keeps every glyph in a real face.
 */
function fontStack(locale: string): string {
  const [latin, latinFallback] = families(display.style.fontFamily);
  const [arabic, arabicFallback] = families(persian.style.fontFamily);
  const order = locale === "fa" ? [arabic, latin, arabicFallback] : [latin, arabic, latinFallback];
  return [...order, "ui-sans-serif", "system-ui", "sans-serif"].filter(Boolean).join(", ");
}

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("common");
  return {
    title: { default: t("brand"), template: `%s · ${t("brand")}` },
    description: t("appDescription"),
  };
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#e3e5e9" },
    { media: "(prefers-color-scheme: dark)", color: "#0e1116" },
  ],
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Theme is an account preference rendered on the server, so there is no flash on load.
  // Locale and direction are resolved once per request (src/i18n/request.ts) and shared by
  // server and client rendering, so they can never disagree.
  const [user, locale] = await Promise.all([getSessionUser().catch(() => null), getLocale()]);
  const theme = user?.theme === "DARK" ? "dark" : user?.theme === "LIGHT" ? "light" : undefined;
  return (
    <html
      lang={locale}
      dir={directionOf(locale)}
      data-theme={theme}
      className={`${display.variable} ${persian.variable}`}
      style={{ "--font-stack": fontStack(locale) } as React.CSSProperties}
    >
      <body>
        <NextIntlClientProvider>{children}</NextIntlClientProvider>
      </body>
    </html>
  );
}
