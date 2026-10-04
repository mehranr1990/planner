import { expect, flowEmail, signUp, test } from "./support/test";

test.describe("invitations", () => {
  test("send, list and revoke an invitation", async ({ page }) => {
    await signUp(page);
    await page.goto("/settings/account");
    await page.getByLabel("Workspace name").fill("Invite Co");
    await page.getByRole("button", { name: "Create workspace" }).click();
    await expect(page.getByText("Workspace created")).toBeVisible();

    await page.goto("/team/invitations");
    await page.getByRole("button", { name: "Invite" }).click();
    const dialog = page.getByRole("dialog", { name: "Invite someone" });
    const inviteEmail = flowEmail("invite-target");
    await dialog.getByLabel("Email").fill(inviteEmail);
    await dialog.getByRole("button", { name: "Send invite" }).click();
    await expect(dialog).toBeHidden();

    const row = page.locator("li", { hasText: inviteEmail });
    await expect(row.getByText("Pending")).toBeVisible();

    await row.getByRole("button", { name: "Revoke" }).click();
    await expect(row.getByText("Revoked")).toBeVisible();
    await expect(row.getByRole("button", { name: "Revoke" })).toHaveCount(0);
  });

  test("an invalid invite link shows a clear not-found state", async ({ page }) => {
    await page.goto("/invite/this-token-does-not-exist");
    await expect(page.getByRole("heading", { name: "Invitation not found" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Go to the app" })).toBeVisible();
  });
});
