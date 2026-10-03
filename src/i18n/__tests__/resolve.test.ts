import { describe, expect, it } from "vitest";
import { directionOf, isLocale, LOCALES } from "../config";
import { matchAcceptLanguage, resolveLocale } from "../resolve";

describe("resolveLocale", () => {
  it("prefers the signed-in user's saved locale over everything", () => {
    expect(resolveLocale({ userLocale: "fa", cookieLocale: "en", acceptLanguage: "en-US" })).toBe("fa");
  });

  it("falls back to the cookie, then Accept-Language, then English", () => {
    expect(resolveLocale({ cookieLocale: "fa", acceptLanguage: "en" })).toBe("fa");
    expect(resolveLocale({ acceptLanguage: "fa-IR,fa;q=0.9,en;q=0.5" })).toBe("fa");
    expect(resolveLocale({})).toBe("en");
  });

  it("ignores unsupported or malformed values at every step", () => {
    expect(resolveLocale({ userLocale: "de", cookieLocale: "xx", acceptLanguage: "ja-JP" })).toBe("en");
    expect(resolveLocale({ userLocale: "FA", cookieLocale: "fa" })).toBe("fa"); // case must match exactly
    expect(resolveLocale({ userLocale: "<script>", acceptLanguage: "fa" })).toBe("fa");
  });
});

describe("matchAcceptLanguage", () => {
  it("honours q-values and order", () => {
    expect(matchAcceptLanguage("de;q=0.9, fa;q=0.8, en;q=0.7")).toBe("fa");
    expect(matchAcceptLanguage("en;q=0.2, fa;q=0.8")).toBe("fa");
    expect(matchAcceptLanguage("en, fa")).toBe("en");
  });

  it("matches region tags to the base language and skips q=0 and *", () => {
    expect(matchAcceptLanguage("fa-AF")).toBe("fa");
    expect(matchAcceptLanguage("en-GB")).toBe("en");
    expect(matchAcceptLanguage("fa;q=0, *")).toBeNull();
    expect(matchAcceptLanguage("")).toBeNull();
    expect(matchAcceptLanguage(null)).toBeNull();
  });
});

describe("locale registry", () => {
  it("knows direction per locale", () => {
    expect(directionOf("en")).toBe("ltr");
    expect(directionOf("fa")).toBe("rtl");
  });

  it("validates server-side", () => {
    for (const l of LOCALES) expect(isLocale(l)).toBe(true);
    expect(isLocale("ar")).toBe(false);
    expect(isLocale(undefined)).toBe(false);
  });
});
