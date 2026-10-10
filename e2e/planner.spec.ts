import { expect, serverActionDone, signUp, test } from "./support/test";

const VIEWS = [
  ["inbox", "Inbox"],
  ["today", "Today"],
  ["upcoming", "Upcoming"],
  ["overdue", "Overdue"],
  ["scheduled", "Scheduled"],
  ["someday", "Someday"],
  ["completed", "Completed"],
  ["all", "All tasks"],
] as const;

test.describe("planner and tasks", () => {
  test.beforeEach(async ({ page }) => {
    await signUp(page);
  });

  test("every planner view is reachable from the view pills", async ({ page }) => {
    await page.goto("/planner/today");
    const nav = page.getByRole("navigation", { name: "Planner views" });
    for (const [slug, label] of VIEWS) {
      await nav.getByRole("link", { name: new RegExp(`^${label}`) }).click();
      await expect(page).toHaveURL(new RegExp(`/planner/${slug}$`));
      await expect(page.locator("#view-heading")).toHaveText(label);
      await expect(nav.getByRole("link", { name: new RegExp(`^${label}`) })).toHaveAttribute("aria-current", "page");
    }
  });

  test("quick add previews and parses natural language; tasks land in the right views", async ({ page }) => {
    await page.goto("/planner/today");
    const input = page.getByLabel("New task");
    await input.fill("Pay rent tomorrow 9am !high");
    const preview = page.locator("#quick-add-preview");
    await expect(preview).toContainText("9:00 AM");
    await expect(preview).toContainText("High");
    await page.getByRole("button", { name: "Add task" }).click();
    await expect(input).toHaveValue("");

    await input.fill("Water plants");
    await page.getByRole("button", { name: "Add task" }).click();
    await expect(page.getByRole("link", { name: "Water plants" })).toBeVisible(); // Today view defaults to today
    await expect(page.getByRole("link", { name: "Pay rent" })).toHaveCount(0); // tomorrow → not today

    await page.goto("/planner/upcoming");
    const row = page.locator("li", { has: page.getByRole("link", { name: "Pay rent" }) });
    await expect(row).toContainText("Tomorrow");
    await expect(row).toContainText("High");

    await page.goto("/planner/inbox");
    await page.getByLabel("New task").fill("Learn piano someday");
    const created = serverActionDone(page);
    await page.getByRole("button", { name: "Add task" }).click();
    await created;
    await page.goto("/planner/someday");
    await expect(page.getByRole("link", { name: "Learn piano" })).toBeVisible();
  });

  test("schedule and edit a task in the sheet, then complete it", async ({ page }) => {
    await page.goto("/planner/inbox");
    await page.getByLabel("New task").fill("Book dentist");
    await page.getByRole("button", { name: "Add task" }).click();
    await page.getByRole("link", { name: "Book dentist" }).click();

    const sheet = page.getByRole("dialog");
    await expect(sheet).toBeVisible();
    const today = await page.evaluate(() => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tehran" }).format(new Date()));
    await sheet.getByLabel("Due date").fill(today);
    await sheet.getByLabel("Priority").selectOption("URGENT");
    await sheet.getByLabel("Notes").fill("Ask about the 6-month check-up");
    await sheet.getByRole("button", { name: "Save changes" }).click();
    await expect(sheet.getByRole("status")).toHaveText("Saved");
    await sheet.getByRole("button", { name: "Close" }).click();
    await expect(sheet).toBeHidden();

    await page.goto("/planner/today");
    const row = page.locator("li", { has: page.getByRole("link", { name: "Book dentist" }) });
    await expect(row).toContainText("Urgent");

    await page.getByRole("checkbox", { name: "Complete “Book dentist”" }).click();
    await expect(page.getByRole("link", { name: "Book dentist" })).toHaveCount(0);
    await page.goto("/planner/completed");
    await expect(page.getByRole("checkbox", { name: "Reopen “Book dentist”" })).toBeVisible();
  });
});
