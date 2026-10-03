import { expect, signUp, test } from "./support/test";

test("a second account sees none of the first account's tasks or projects", async ({ page, openPage }) => {
  await signUp(page, { name: "Owner One" });
  await page.goto("/planner/inbox");
  await page.getByLabel("New task").fill("Private errand");
  await page.getByRole("button", { name: "Add task" }).click();
  await expect(page.getByRole("link", { name: "Private errand" })).toBeVisible();
  await page.goto("/projects");
  await page.getByRole("button", { name: "New project" }).first().click();
  await page.getByRole("dialog").getByLabel("Name", { exact: true }).fill("Secret project");
  await page.getByRole("dialog").getByRole("button", { name: "Create project" }).click();
  await expect(page).toHaveURL(/\/projects\/c[a-z0-9]+$/);
  const projectUrl = new URL(page.url()).pathname;

  const other = await openPage();
  await signUp(other, { name: "Someone Else" });
  await other.goto("/planner/all");
  await expect(other.getByText("No tasks yet")).toBeVisible();
  await expect(other.getByRole("link", { name: "Private errand" })).toHaveCount(0);
  await other.goto("/projects");
  await expect(other.locator("article")).toHaveCount(0);
  // Direct URL access looks exactly like a missing page.
  await other.goto(projectUrl);
  await expect(other.getByRole("heading", { name: "Not available" })).toBeVisible();
});
