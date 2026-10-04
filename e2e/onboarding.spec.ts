import { E2E_PASSWORD } from "./support/fixtures-data";
import { expect, flowEmail, test } from "./support/test";

test.describe("onboarding", () => {
  test("team path: setup, choose team, create a workspace, skip the first action", async ({ page }) => {
    await page.goto("/sign-up");
    await page.getByLabel("Name").fill("Team Starter");
    await page.getByLabel("Email").fill(flowEmail("onboarding-team"));
    await page.getByLabel("Password").fill(E2E_PASSWORD);
    await page.getByRole("button", { name: "Create account" }).click();
    await page.waitForURL(/\/onboarding$/);

    await expect(page.getByRole("heading", { name: "Your setup" })).toBeVisible();
    await page.getByRole("button", { name: "Continue" }).click();

    await expect(page.getByRole("heading", { name: "How will you use planner?" })).toBeVisible();
    await page.getByRole("button", { name: "With a team" }).click();

    await expect(page.getByRole("heading", { name: "Set up your workspace" })).toBeVisible();
    await page.getByLabel("Workspace name").fill("Acme Onboarding Co");
    await page.getByRole("button", { name: "Continue" }).click();

    await expect(page.getByRole("heading", { name: "Bring your team in" })).toBeVisible();
    await page.getByRole("button", { name: "Skip for now" }).click();
    await page.waitForURL(/\/home$/);

    await expect(page.locator("summary[aria-label^='Context: Acme Onboarding Co']")).toBeVisible();

    // Idempotent: re-visiting onboarding after completion just bounces back to /home.
    await page.goto("/onboarding");
    await page.waitForURL(/\/home$/);
  });
});
