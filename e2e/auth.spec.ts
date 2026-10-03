import { E2E_PASSWORD } from "./support/fixtures-data";
import { expect, flowEmail, htmlAttrs, signUp, test } from "./support/test";

test.describe("authentication", () => {
  test("unauthenticated visitors are sent to sign-in and come back afterwards", async ({ page }) => {
    await page.goto("/planner/today");
    await expect(page).toHaveURL(/\/sign-in\?next=%2Fplanner%2Ftoday/);
    expect(await htmlAttrs(page)).toEqual({ lang: "en", dir: "ltr" });
  });

  test("sign-up validates, creates the account and signs in", async ({ page }) => {
    await page.goto("/sign-up?next=%2Fplanner%2Ftoday");
    await page.getByLabel("Name").fill("Mina Rahimi");
    await page.getByLabel("Email").fill(flowEmail("signup"));
    await page.getByLabel("Password").fill("short");
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page.getByText("Use at least 10 characters")).toBeVisible();
    await page.getByLabel("Password").fill(E2E_PASSWORD);
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page).toHaveURL(/\/planner\/today$/);
    await expect(page.getByRole("heading", { name: "Planner" })).toBeVisible();
  });

  test("sign-out, wrong password (generic error) and sign-in", async ({ page }) => {
    const email = await signUp(page);
    await page.locator("summary[aria-label='Account menu']").click();
    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(page).toHaveURL(/\/sign-in$/);

    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill("not the password");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.locator("form").getByRole("alert")).toHaveText("Email or password is incorrect");

    await page.getByLabel("Password").fill(E2E_PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/home$/);
  });
});
