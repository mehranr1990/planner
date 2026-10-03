import { cookies, headers } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import { getSessionUser } from "@/server/auth/session";
import { LOCALE_COOKIE } from "./config";
import { messagesFor } from "./messages";
import { resolveLocale } from "./resolve";

// next-intl request configuration — the only place a request's locale is decided.
// No [locale] URL segment: authenticated routes stay /home, /planner, …
export default getRequestConfig(async () => {
  const [user, jar, hdrs] = await Promise.all([getSessionUser().catch(() => null), cookies(), headers()]);
  const locale = resolveLocale({
    userLocale: user?.locale,
    cookieLocale: jar.get(LOCALE_COOKIE)?.value,
    acceptLanguage: hdrs.get("accept-language"),
  });
  return {
    locale,
    messages: messagesFor(locale),
    // Presentation timezone for next-intl formatters; domain logic uses the user's tz explicitly.
    timeZone: user?.timezone ?? "UTC",
  };
});
