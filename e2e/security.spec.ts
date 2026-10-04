import { E2E_PASSWORD } from "./support/fixtures-data";
import { expect, signUp, test } from "./support/test";

test.describe("account security", () => {
  test("change password, see the active session, and sign in with the new password", async ({ page }) => {
    const email = await signUp(page);
    await page.goto("/settings/security");

    await expect(page.getByText("This device")).toBeVisible();

    const newPassword = `${E2E_PASSWORD}-new`;
    await page.getByLabel("Current password").fill(E2E_PASSWORD);
    await page.getByLabel("New password").fill(newPassword);
    await page.getByRole("button", { name: "Change password" }).click();
    await expect(page.getByText("Password changed")).toBeVisible();

    await page.locator("summary[aria-label='Account menu']").click();
    await page.getByRole("button", { name: "Sign out" }).click();
    await page.waitForURL(/\/sign-in$/);

    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(E2E_PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.locator("form").getByRole("alert")).toHaveText("Email or password is incorrect");

    await page.getByLabel("Password").fill(newPassword);
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.waitForURL(/\/home$/);
  });

  test("forgot password shows a generic confirmation regardless of whether the account exists", async ({ page }) => {
    await page.goto("/forgot-password");
    await page.getByLabel("Email").fill("nobody-at-all@example.com");
    await page.getByRole("button", { name: "Send reset link" }).click();
    await expect(page.getByText("If an account exists for that email, a reset link is on its way.")).toBeVisible();
  });
});
