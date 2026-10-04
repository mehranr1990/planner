import { E2E_PASSWORD } from "./support/fixtures-data";
import { expect, flowEmail, htmlAttrs, test } from "./support/test";

test.describe("localization", () => {
  test("Persian visitor: RTL before sign-in, localized validation, saved preference", async ({ openPage }) => {
    const page = await openPage({ locale: "fa-IR", timezoneId: "Asia/Tehran" });
    await page.goto("/sign-in");
    expect(await htmlAttrs(page)).toEqual({ lang: "fa", dir: "rtl" });
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("خوش برگشتید");

    await page.getByRole("link", { name: "ساخت حساب" }).click();
    await page.locator("#name").fill("مینا رحیمی");
    await page.locator("#email").fill(flowEmail("fa"));
    await page.locator("#password").fill("short");
    await page.getByRole("button", { name: "ساخت حساب" }).click();
    await expect(page.getByText("دست‌کم ۱۰ نویسه به کار ببرید")).toBeVisible();
    await page.locator("#password").fill(E2E_PASSWORD);
    await page.getByRole("button", { name: "ساخت حساب" }).click();
    // A brand-new account is never onboarded, so this always lands on /onboarding first.
    await page.waitForURL(/\/onboarding$/);
    await page.getByRole("button", { name: "ادامه" }).click();
    await page.getByRole("button", { name: "شخصی" }).click();
    await page.getByRole("button", { name: "فعلاً رد شو" }).click();
    await page.waitForURL(/\/home$/);
    expect(await htmlAttrs(page)).toEqual({ lang: "fa", dir: "rtl" });
    await expect(page.getByRole("navigation", { name: "اصلی" }).first().getByRole("link", { name: "برنامه‌ریز" })).toBeVisible();
  });

  test("switching language keeps route, workspace and session; cookie survives sign-out", async ({ openPage }) => {
    const page = await openPage({ locale: "fa-IR", timezoneId: "Asia/Tehran" });
    const email = flowEmail("switch");
    await page.goto("/sign-up");
    await page.locator("#name").fill("Switcher");
    await page.locator("#email").fill(email);
    await page.locator("#password").fill(E2E_PASSWORD);
    await page.locator("form button[type=submit]").click();
    await page.waitForURL(/\/onboarding$/);
    await page.getByRole("button", { name: "ادامه" }).click();
    await page.getByRole("button", { name: "شخصی" }).click();
    await page.getByRole("button", { name: "فعلاً رد شو" }).click();
    await page.waitForURL(/\/home$/);

    await page.goto("/settings/account");
    await page.locator("#ws-name").fill("استودیو نوروز");
    await page.getByRole("button", { name: "ساخت فضای کاری" }).click();
    await expect(page.locator("summary[aria-label*='استودیو نوروز']")).toBeVisible();

    await page.locator("#account-locale").selectOption("en");
    await page.getByRole("button", { name: "ذخیره", exact: true }).click();
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    expect(await htmlAttrs(page)).toEqual({ lang: "en", dir: "ltr" });
    await expect(page).toHaveURL(/\/settings\/account$/); // route preserved
    await expect(page.getByRole("heading", { level: 1, name: "Settings" })).toBeVisible(); // still signed in
    await expect(page.locator("summary[aria-label='Context: استودیو نوروز. Change context']")).toBeVisible(); // workspace preserved
    await page.reload();
    expect((await htmlAttrs(page)).lang).toBe("en");

    await page.locator("summary[aria-label='Account menu']").click();
    await page.getByRole("button", { name: "Sign out" }).click();
    await page.waitForURL(/\/sign-in$/);
    expect((await htmlAttrs(page)).lang).toBe("en"); // cookie beats the fa browser

    await page.getByRole("button", { name: "فارسی" }).click();
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await page.locator("#email").fill(email);
    await page.locator("#password").fill("wrong password!");
    await page.locator("form button[type=submit]").click();
    await expect(page.locator("form").getByRole("alert")).toHaveText("ایمیل یا گذرواژه نادرست است");
    await page.locator("#password").fill(E2E_PASSWORD);
    await page.locator("form button[type=submit]").click();
    await page.waitForURL(/\/home$/);
    expect((await htmlAttrs(page)).lang).toBe("en"); // account preference wins after sign-in
  });

  test("unsupported cookie values are ignored", async ({ openPage }) => {
    const page = await openPage({ locale: "en-US" });
    await page.context().addCookies([{ name: "locale", value: "de", url: test.info().project.use.baseURL! }]);
    await page.goto("/sign-in");
    expect(await htmlAttrs(page)).toEqual({ lang: "en", dir: "ltr" });
  });
});
