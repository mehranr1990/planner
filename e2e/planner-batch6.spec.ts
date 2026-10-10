import { randomUUID } from "node:crypto";
import pg from "pg";
import { expect, flowEmail, signUp, test } from "./support/test";
import type { Page } from "@playwright/test";

// Phase 3 Batch 6 (final batch): task attachments, avatar upload, workspace ownership transfer,
// and the Batch 5 board-section rename/delete UI carry-over.

// A minimal, valid 1x1 transparent PNG — small enough to inline, real enough to pass the server's
// magic-byte check (image/png signature), unlike a fake buffer that merely claims to be a PNG.
const PNG_1X1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);

async function addTask(page: Page, title: string) {
  const input = page.getByLabel("New task");
  await input.fill(title);
  await page.getByRole("button", { name: "Add task" }).click();
  await expect(input).toHaveValue("");
}

async function createPersonalProject(page: Page, name: string) {
  await page.goto("/projects");
  await page.getByRole("button", { name: "New project" }).first().click();
  await page.getByLabel("Name").fill(name);
  await page.getByRole("button", { name: "Create project" }).click();
  await page.waitForURL(/\/projects\/[^/]+$/);
}

/** zod's `z.cuid()` only checks `/^[cC][0-9a-z]{6,}$/` (not the real CUID algorithm) — good enough
 * to satisfy action validation for a row a test inserts directly. */
function fakeCuid(): string {
  return `c${randomUUID().replace(/-/g, "")}`;
}

/**
 * Adds a second, real ACTIVE member directly into `ownerEmail`'s own workspace. Not a shortcut
 * around anything the app enforces — this only stands in for "an invitation was already accepted"
 * (the invite flow itself sends its token through a real email, which E2E has no way to read back;
 * see invitations.spec.ts, which only covers send/list/revoke for the same reason) and returns the
 * owner's own user id so the caller can assert the pre-/post-transfer role swap precisely.
 */
async function addWorkspaceMember(ownerEmail: string, name: string): Promise<{ ownerId: string; workspaceId: string }> {
  try {
    process.loadEnvFile(".env");
  } catch {
    // CI provides the environment directly.
  }
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is required for this E2E helper — see README → End-to-end tests.");
  const db = new pg.Client({ connectionString: url });
  await db.connect();
  try {
    const { rows } = await db.query<{ id: string; workspace_id: string }>(
      `SELECT u.id, w.id AS workspace_id FROM users u JOIN workspaces w ON w.created_by_id = u.id WHERE u.email = $1`,
      [ownerEmail],
    );
    const { id: ownerId, workspace_id: workspaceId } = rows[0]!;
    const memberId = fakeCuid();
    await db.query(`INSERT INTO users (id, email, name, password_hash, timezone, onboarded_at, created_at, updated_at) VALUES ($1, $2, $3, 'x', 'UTC', now(), now(), now())`, [
      memberId,
      flowEmail("member"),
      name,
    ]);
    await db.query(`INSERT INTO memberships (id, workspace_id, user_id, role, status, joined_at) VALUES ($1, $2, $3, 'MEMBER', 'ACTIVE', now())`, [fakeCuid(), workspaceId, memberId]);
    return { ownerId, workspaceId };
  } finally {
    await db.end();
  }
}

test.describe("Batch 6: attachments, avatar, ownership transfer, board carry-over", () => {
  test("uploading and deleting a task attachment", async ({ page }) => {
    await signUp(page);
    await page.goto("/planner/inbox");
    await addTask(page, "Task with a file");
    await page.getByRole("link", { name: "Task with a file" }).click();
    const sheet = page.getByRole("dialog", { name: "Task with a file" });
    await expect(sheet).toBeVisible();

    await sheet.locator('input[type="file"]').setInputFiles({ name: "notes.txt", mimeType: "text/plain", buffer: Buffer.from("hello from e2e") });
    await expect(sheet.getByRole("link", { name: "notes.txt", exact: true })).toBeVisible();

    // Downloading goes through the authenticated proxy route and resolves to the real file.
    const [download] = await Promise.all([page.waitForEvent("download"), sheet.getByRole("link", { name: "Download “notes.txt”" }).click()]);
    expect(download.suggestedFilename()).toBe("notes.txt");

    await sheet.getByRole("button", { name: "Remove “notes.txt”" }).click();
    await expect(sheet.getByRole("link", { name: "notes.txt" })).toHaveCount(0);
    await expect(sheet.getByText("No files yet")).toBeVisible();

    await page.reload();
    await expect(page.getByRole("dialog", { name: "Task with a file" }).getByText("No files yet")).toBeVisible();
  });

  test("rejects a disallowed file type with a visible error", async ({ page }) => {
    await signUp(page);
    await page.goto("/planner/inbox");
    await addTask(page, "Task rejects bad file");
    await page.getByRole("link", { name: "Task rejects bad file" }).click();
    const sheet = page.getByRole("dialog", { name: "Task rejects bad file" });

    await sheet.locator('input[type="file"]').setInputFiles({ name: "script.sh", mimeType: "application/x-sh", buffer: Buffer.from("#!/bin/sh\necho hi") });
    await expect(sheet.getByRole("alert")).toBeVisible();
    await expect(sheet.getByText("No files yet")).toBeVisible();
  });

  test("uploading and removing a profile avatar", async ({ page }) => {
    await signUp(page);
    await page.goto("/settings/profile");
    // The avatar also renders in the header's account menu — both are "/api/avatars/…" images, so
    // assertions are scoped to the Profile panel's own preview to avoid ambiguous matches.
    const profilePanel = page.getByRole("region", { name: "Profile" });

    await expect(profilePanel.locator('img[src^="/api/avatars/"]')).toHaveCount(0);
    await page.locator('input[type="file"]').setInputFiles({ name: "avatar.png", mimeType: "image/png", buffer: PNG_1X1 });
    await expect(profilePanel.locator('img[src^="/api/avatars/"]')).toBeVisible();

    await page.getByRole("button", { name: "Remove" }).click();
    await expect(profilePanel.locator('img[src^="/api/avatars/"]')).toHaveCount(0);

    await page.reload();
    await expect(profilePanel.locator('img[src^="/api/avatars/"]')).toHaveCount(0);
  });

  test("transferring workspace ownership", async ({ page }) => {
    const ownerEmail = await signUp(page, { name: "Workspace Owner" });
    await page.goto("/settings/account");
    await page.getByLabel("Workspace name").fill("Ownership Co");
    await page.getByRole("button", { name: "Create workspace" }).click();
    await expect(page.getByText("Workspace created")).toBeVisible();

    await addWorkspaceMember(ownerEmail, "Arash Karimi");
    await page.goto("/team");
    // Each member row mounts with a staggered "rise in" entrance animation (`animate-rise`) that
    // gives the row its own stacking context; letting it settle avoids a flaky click on the
    // just-opened dropdown, same as a human would naturally do by taking a moment before clicking.
    await page.waitForTimeout(500);

    const memberRow = page.locator("li").filter({ hasText: "Arash Karimi" });
    await expect(memberRow).toBeVisible();
    // The menu trigger is a native `<details><summary aria-label="…">` (same pattern as the
    // account/notification menus) — Chromium exposes it with role "generic", not "button", so it's
    // targeted by its aria-label directly rather than via getByRole.
    await memberRow.locator('[aria-label="More actions for Arash Karimi"]').click();
    await memberRow.getByRole("button", { name: "Transfer ownership" }).click();
    const confirmDialog = page.getByRole("dialog", { name: "Make Arash Karimi the workspace owner?" });
    await expect(confirmDialog).toBeVisible();
    await confirmDialog.getByRole("button", { name: "Transfer ownership" }).click();
    await expect(confirmDialog).toBeHidden();

    await expect(memberRow.getByText("Owner", { exact: true })).toBeVisible();
    const ownerRow = page.locator("li").filter({ hasText: "Workspace Owner" });
    await expect(ownerRow.getByText("Admin", { exact: true })).toBeVisible();
  });

  test("renaming and deleting a board column", async ({ page }) => {
    await signUp(page);
    await createPersonalProject(page, "Board Carry-over Project");
    await page.getByRole("navigation", { name: "Project views" }).getByRole("link", { name: "Board" }).click();
    await page.waitForURL(/\/board$/);

    await page.getByRole("button", { name: "Add column" }).first().click();
    await page.getByPlaceholder("Column name").fill("Doing");
    await page.getByRole("button", { name: "Add column", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Doing" })).toBeVisible();

    await page.locator('[aria-label="More actions for the “Doing” column"]').click();
    await page.getByRole("button", { name: "Rename" }).click();
    const renameInput = page.getByRole("region", { name: "Doing" }).getByRole("textbox");
    await renameInput.fill("In Progress");
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByRole("heading", { name: "In Progress" })).toBeVisible();

    await page.locator('[aria-label="More actions for the “In Progress” column"]').click();
    await page.getByRole("button", { name: "Delete" }).click();
    await expect(page.getByRole("dialog", { name: "Delete the “In Progress” column?" })).toBeVisible();
    await page.getByRole("button", { name: "Delete" }).last().click();
    await expect(page.getByRole("heading", { name: "In Progress" })).toHaveCount(0);
  });
});
