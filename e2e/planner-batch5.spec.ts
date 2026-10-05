import { expect, signUp, test } from "./support/test";
import type { Page } from "@playwright/test";

// Phase 3 Batch 5: the subtask-reorder UI carry-over from Batch 4, plus Board (column create +
// card move between columns) and Milestones (create/complete/delete). Exercised against a fresh
// personal account — a personal project is enough to reach all three tabs (Board/Timeline/
// Milestones don't require a workspace). Timeline has no dedicated flow here: it's read-first
// (no drag/resize), so its date-window/permission behavior is covered by the integration suite.

async function addTask(page: Page, title: string) {
  const input = page.getByLabel("New task");
  await input.fill(title);
  await page.getByRole("button", { name: "Add task" }).click();
  await expect(input).toHaveValue("");
}

/** Manual pointer sequence (not `.dragTo()`) — dnd-kit's PointerSensor needs a real mousedown →
 * incremental moves past its activation distance → mouseup, matching planner-batch4.spec.ts. */
async function dragHandle(page: Page, from: { x: number; y: number; width: number; height: number }, to: { x: number; y: number; width: number; height: number }) {
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2 - 15, { steps: 5 });
  await page.waitForTimeout(100);
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 10 });
  await page.waitForTimeout(100);
  await page.mouse.up();
}

async function createPersonalProject(page: Page, name: string) {
  await page.goto("/projects");
  await page.getByRole("button", { name: "New project" }).first().click();
  await page.getByLabel("Name").fill(name);
  await page.getByRole("button", { name: "Create project" }).click();
  await page.waitForURL(/\/projects\/[^/]+$/);
}

test.describe("Batch 5: subtask reorder, board, milestones", () => {
  test.beforeEach(async ({ page }) => {
    await signUp(page);
  });

  test("reordering subtasks in the task sheet persists after reload", async ({ page }) => {
    await page.goto("/planner/inbox");
    await addTask(page, "Subtask parent");
    await page.getByRole("link", { name: "Subtask parent" }).click();
    await expect(page.getByRole("dialog", { name: "Subtask parent" })).toBeVisible();

    const newSubtask = page.getByPlaceholder("Add a subtask");
    await newSubtask.fill("Sub one");
    await page.getByRole("button", { name: "Add subtask" }).click();
    await expect(newSubtask).toHaveValue("");
    await newSubtask.fill("Sub two");
    await page.getByRole("button", { name: "Add subtask" }).click();
    await expect(newSubtask).toHaveValue("");

    await expect(page.getByRole("button", { name: "Sub one", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Sub two", exact: true })).toBeVisible();

    const gripTwo = page.locator('button[aria-label*="Reorder"][aria-label*="Sub two"]');
    const gripOne = page.locator('button[aria-label*="Reorder"][aria-label*="Sub one"]');
    const from = await gripTwo.boundingBox();
    const to = await gripOne.boundingBox();
    if (!from || !to) throw new Error("subtask drag handles not found");
    await dragHandle(page, from, to);

    const subtaskList = page.locator("ul").filter({ has: page.getByRole("button", { name: "Sub one", exact: true }) }).first();
    await expect(subtaskList.getByRole("button", { name: /^Sub (one|two)$/, exact: true }).first()).toHaveText("Sub two");
    await page.reload();
    await expect(subtaskList.getByRole("button", { name: /^Sub (one|two)$/, exact: true }).first()).toHaveText("Sub two");
  });

  test("dragging a card from the unsectioned column into a new board column persists after reload", async ({ page }) => {
    await createPersonalProject(page, "Board Project");
    // Batch 5 added a matching SubNav rail icon link (icon-only, same accessible name) alongside
    // the existing pill tab, so the pill nav (visible text) needs disambiguating by its own label.
    await page.getByRole("navigation", { name: "Project views" }).getByRole("link", { name: "Board" }).click();
    await page.waitForURL(/\/board$/);

    await addTask(page, "Card to move");

    await page.getByRole("button", { name: "Add column" }).first().click();
    await page.getByPlaceholder("Column name").fill("Doing");
    await page.getByRole("button", { name: "Add column", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Doing" })).toBeVisible();

    const card = page.locator('button[aria-label*="Reorder"][aria-label*="Card to move"]');
    const doingColumn = page.getByRole("region", { name: "Doing" });
    const from = await card.boundingBox();
    const to = await doingColumn.boundingBox();
    if (!from || !to) throw new Error("board drag targets not found");
    await dragHandle(page, from, to);

    await expect(doingColumn.getByText("Card to move")).toBeVisible();
    await page.reload();
    await expect(page.getByRole("region", { name: "Doing" }).getByText("Card to move")).toBeVisible();
  });

  test("creating, completing and deleting a milestone", async ({ page }) => {
    await createPersonalProject(page, "Milestone Project");
    await page.getByRole("navigation", { name: "Project views" }).getByRole("link", { name: "Milestones" }).click();
    await page.waitForURL(/\/milestones$/);

    await page.getByRole("button", { name: "New milestone" }).click();
    await page.getByLabel("Title").fill("Launch");
    await page.getByRole("button", { name: "Create milestone" }).click();
    await expect(page.getByText("Launch")).toBeVisible();

    await page.getByRole("checkbox", { name: "Mark complete" }).click();
    await expect(page.getByText("Completed")).toBeVisible();

    await page.getByRole("button", { name: "Delete milestone" }).click();
    await page.getByRole("button", { name: "Delete milestone" }).last().click();
    await expect(page.getByText("Launch")).toHaveCount(0);
  });
});
