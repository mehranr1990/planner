import { expect, signUp, test } from "./support/test";

test.describe("workspaces, projects and preferences", () => {
  test("create a workspace and project, add project tasks, switch context", async ({ page }) => {
    await signUp(page);

    await page.goto("/settings");
    await page.getByLabel("Workspace name").fill("Northwind Studio");
    await page.getByRole("button", { name: "Create workspace" }).click();
    await expect(page.getByText("Workspace created")).toBeVisible();
    await expect(page.locator("summary[aria-label^='Context: Northwind Studio']")).toBeVisible();

    await page.goto("/projects");
    await expect(page.getByRole("heading", { name: "Northwind Studio projects" })).toBeVisible();
    await page.getByRole("button", { name: "New project" }).first().click();
    const dialog = page.getByRole("dialog", { name: "New project" });
    await dialog.getByLabel("Name", { exact: true }).fill("Website relaunch");
    await dialog.getByLabel("Description").fill("Launch before the end of the quarter.");
    await dialog.getByRole("button", { name: "Create project" }).click();
    await expect(page).toHaveURL(/\/projects\/c[a-z0-9]+$/);
    await expect(page.getByRole("heading", { level: 1, name: "Website relaunch" })).toBeVisible();

    await page.getByLabel("New task").fill("Draft homepage copy tomorrow");
    await page.getByRole("button", { name: "Add task" }).click();
    const row = page.locator("li", { has: page.getByRole("link", { name: "Draft homepage copy" }) });
    await expect(row).toContainText("Tomorrow");
    await expect(page.getByRole("img", { name: /Website relaunch completion|Completion/ }).first()).toBeVisible();

    // Context switch: personal space shows personal projects only.
    await page.locator("summary[aria-label^='Context:']").click();
    await page.getByRole("button", { name: "Personal" }).click();
    await expect(page.locator("summary[aria-label^='Context: Personal']")).toBeVisible();
    await page.goto("/projects");
    await expect(page.getByRole("heading", { name: "Personal projects" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Website relaunch" })).toHaveCount(0);
  });

  test("dark and light theme persist across reloads", async ({ page }) => {
    await signUp(page);
    await page.goto("/home");
    await page.getByRole("button", { name: "Dark theme" }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await expect(page.getByRole("button", { name: "Dark theme" })).toHaveAttribute("aria-pressed", "true");
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await page.getByRole("button", { name: "Light theme" }).click();
    await expect(page.getByRole("button", { name: "Light theme" })).toHaveAttribute("aria-pressed", "true");
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  });
});
