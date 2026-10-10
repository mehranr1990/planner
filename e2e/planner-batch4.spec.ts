import { expect, serverActionDone, signUp, test } from "./support/test";
import type { Page } from "@playwright/test";

// Batch 4: advanced filters, bulk actions, drag & drop. Exercised against a fresh personal
// account (same as planner.spec.ts) — filter dimensions needing a workspace (assignee, creator,
// project) are covered by the integration suite instead; this file covers what a personal account
// can exercise end-to-end: priority filtering + chip removal, bulk multi-select + complete, and
// manual drag reorder persisting across a reload.

/** Submits one quick-add task and waits for the input to clear (the submission's completion
 * signal) before returning — matching planner.spec.ts's pattern, required so a second fill()
 * right after doesn't race the first submission's revalidation. */
async function addTask(page: Page, title: string) {
  const input = page.getByLabel("New task");
  await input.fill(title);
  await page.getByRole("button", { name: "Add task" }).click();
  await expect(input).toHaveValue("");
}

test.describe("planner: filters, bulk actions, drag & drop", () => {
  test.beforeEach(async ({ page }) => {
    await signUp(page);
  });

  test("filtering by priority narrows the list; removing the chip restores it", async ({ page }) => {
    await page.goto("/planner/inbox");
    await addTask(page, "Urgent filtered task !urgent");
    await addTask(page, "Plain filtered task");

    await expect(page.getByRole("link", { name: "Urgent filtered task" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Plain filtered task" })).toBeVisible();

    await page.locator("summary", { hasText: "Filters" }).click();
    await page.getByRole("button", { name: "Urgent", exact: true }).click();

    await expect(page).toHaveURL(/priority=URGENT/);
    await expect(page.getByRole("link", { name: "Urgent filtered task" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Plain filtered task" })).toHaveCount(0);

    // Remove the active filter chip — the full list returns.
    await page.getByRole("button", { name: /Priority:/ }).click();
    await expect(page).not.toHaveURL(/priority=URGENT/);
    await expect(page.getByRole("link", { name: "Plain filtered task" })).toBeVisible();
  });

  test("selecting multiple tasks and bulk-completing them removes both from Inbox", async ({ page }) => {
    await page.goto("/planner/inbox");
    await addTask(page, "Bulk select A");
    await addTask(page, "Bulk select B");

    const rowA = page.locator("li", { has: page.getByRole("link", { name: "Bulk select A" }) });
    const rowB = page.locator("li", { has: page.getByRole("link", { name: "Bulk select B" }) });
    await rowA.getByRole("checkbox").first().check();
    await rowB.getByRole("checkbox").first().check();

    await expect(page.getByText("2 selected")).toBeVisible();
    await page.getByRole("button", { name: "Complete", exact: true }).click();
    await expect(page.getByText("Updated 2")).toBeVisible();

    await expect(page.getByRole("link", { name: "Bulk select A" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Bulk select B" })).toHaveCount(0);
    await page.goto("/planner/completed");
    await expect(page.getByRole("link", { name: "Bulk select A" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Bulk select B" })).toBeVisible();
  });

  test("dragging a task to reorder it persists after reload", async ({ page }) => {
    await page.goto("/planner/inbox");
    await addTask(page, "Order first");
    await addTask(page, "Order second");

    const list = page
      .locator("ul")
      .filter({ has: page.getByRole("link", { name: /^Order/ }) })
      .first();
    await expect(list.getByRole("link", { name: /^Order/ }).first()).toHaveText("Order first"); // created first, sorts first

    const gripSecond = page.locator('button[aria-label*="Reorder"][aria-label*="Order second"]');
    const gripFirst = page.locator('button[aria-label*="Reorder"][aria-label*="Order first"]');
    // Manual pointer sequence (not `.dragTo()`) — dnd-kit's PointerSensor needs a real
    // mousedown → several incremental moves past its activation distance → mouseup, with pauses
    // long enough for each step's React state update to land before the next.
    const from = await gripSecond.boundingBox();
    const to = await gripFirst.boundingBox();
    if (!from || !to) throw new Error("drag handles not found");
    await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
    await page.mouse.down();
    await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2 - 15, { steps: 5 });
    await page.waitForTimeout(100);
    await page.mouse.move(to.x + to.width / 2, to.y + 2, { steps: 10 });
    await page.waitForTimeout(100);
    const persisted = serverActionDone(page);
    await page.mouse.up();

    await expect(list.getByRole("link", { name: /^Order/ }).first()).toHaveText("Order second");
    await persisted;
    await page.reload();
    await expect(list.getByRole("link", { name: /^Order/ }).first()).toHaveText("Order second"); // persisted
  });
});
