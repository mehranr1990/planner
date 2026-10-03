import { randomUUID } from "node:crypto";
import { test as base, expect, type Browser, type BrowserContextOptions, type Page } from "@playwright/test";
import { E2E_PASSWORD, FLOW_DOMAIN, SHOWCASES, type ShowcaseKey } from "./fixtures-data";

export { expect };

/** Collects console errors, React hydration warnings and uncaught exceptions for a page. */
export function watchPage(page: Page, sink: string[], tag = "page") {
  page.on("console", (m) => {
    if (m.type() === "error" || /hydrat/i.test(m.text())) sink.push(`${tag} console.${m.type()}: ${m.text().slice(0, 300)}`);
  });
  page.on("pageerror", (e) => sink.push(`${tag} pageerror: ${e.message}`));
}

/**
 * Every test fails if its page logged a console error, a hydration warning or an uncaught
 * error (DoD D11). Extra pages opened with `openPage` are watched too.
 */
export const test = base.extend<{
  errors: string[];
  openPage: (options?: BrowserContextOptions) => Promise<Page>;
}>({
  // Torn down after every page fixture that feeds it, so one assertion covers all pages.
  errors: async ({}, provide) => {
    const errors: string[] = [];
    await provide(errors);
    expect(errors, "console / hydration / page errors").toEqual([]);
  },
  page: async ({ page, errors }, provide) => {
    watchPage(page, errors);
    await provide(page);
  },
  openPage: async ({ browser, errors }, provide) => {
    const contexts: Awaited<ReturnType<Browser["newContext"]>>[] = [];
    await provide(async (options) => {
      const ctx = await browser.newContext(options);
      contexts.push(ctx);
      const p = await ctx.newPage();
      watchPage(p, errors, `extra#${contexts.length}`);
      return p;
    });
    await Promise.all(contexts.map((c) => c.close()));
  },
});

export const htmlAttrs = (page: Page) => page.evaluate(() => ({ lang: document.documentElement.lang, dir: document.documentElement.dir }));

export function flowEmail(label: string) {
  return `${label}-${randomUUID().slice(0, 8)}@${FLOW_DOMAIN}`;
}

/** Signs up a fresh account through the UI (English labels) and lands on the app. */
export async function signUp(page: Page, opts: { name?: string; email?: string } = {}) {
  const email = opts.email ?? flowEmail("flow");
  await page.goto("/sign-up");
  await page.getByLabel("Name").fill(opts.name ?? "Flow Tester");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(E2E_PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForURL(/\/(home|planner)/);
  return email;
}

/** Signs into a seeded showcase account (labels follow the account's language after sign-in only). */
export async function signInShowcase(page: Page, key: ShowcaseKey, next = "/home") {
  const s = SHOWCASES[key];
  await page.goto(`/sign-in?next=${encodeURIComponent(next)}`);
  await page.locator("#email").fill(s.email);
  await page.locator("#password").fill(E2E_PASSWORD);
  await page.locator("form button[type=submit]").click();
  await page.waitForURL((url) => url.pathname === next.split("?")[0]);
  return s;
}

/** Waits until fonts and lazy images are settled (screenshots and geometry checks). */
export async function settle(page: Page) {
  await page.waitForLoadState("networkidle");
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all([...document.images].map((img) => (img.complete ? null : img.decode().catch(() => null))));
  });
}
