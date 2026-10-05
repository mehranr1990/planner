import type { Page } from "@playwright/test";
import { SHOWCASES, type ShowcaseKey } from "./support/fixtures-data";
import { expect, settle, signInShowcase, test } from "./support/test";

// §88 visual baseline. Representative screens only, seeded deterministic data, one account per
// language × theme. Only time-dependent text is masked ([data-volatile], the native date input).
// Update intentionally with `npm run test:visual -- --update-snapshots` and review the diff.

type Surface = "home" | "planner" | "task-sheet" | "projects" | "project" | "board" | "team" | "settings";

const MATRIX: Record<"visual-desktop" | "visual-mobile", Partial<Record<ShowcaseKey, Surface[]>>> = {
  "visual-desktop": {
    "en-light": ["home", "planner", "task-sheet", "projects", "project", "board", "team", "settings"],
    "en-dark": ["home", "project"],
    "fa-light": ["planner", "task-sheet", "project", "board", "settings"],
    "fa-dark": ["home", "planner"],
  },
  "visual-mobile": {
    "en-light": ["home", "planner", "project", "board"],
    "en-dark": ["home"],
    "fa-light": ["projects", "task-sheet"],
    "fa-dark": ["planner"],
  },
};

const SHEET_TASK: Record<"en" | "fa", string> = { en: "Audit analytics tags", fa: "بازبینی برچسب‌های آمار" };

async function open(page: Page, key: ShowcaseKey, surface: Surface) {
  const s = SHOWCASES[key];
  const path = {
    home: "/home",
    planner: "/planner/today",
    "task-sheet": "/planner/today",
    projects: "/projects",
    project: `/projects/${s.projectId}`,
    board: `/projects/${s.projectId}/board`,
    team: "/team",
    settings: "/settings/profile",
  }[surface];
  await signInShowcase(page, key, path.split("?")[0]!);
  if (surface === "task-sheet") {
    await page.getByRole("link", { name: SHEET_TASK[s.locale] }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
  }
  // Park the pointer so no hover state ends up in the baseline.
  await page.mouse.move(0, 0);
  await settle(page);
}

for (const [project, rows] of Object.entries(MATRIX)) {
  test.describe(project, () => {
    for (const [key, surfaces] of Object.entries(rows) as [ShowcaseKey, Surface[]][]) {
      for (const surface of surfaces) {
        // The tag routes each row to its project (see `grep` in playwright.config.ts).
        test(`${key} · ${surface} ${project === "visual-desktop" ? "@desktop" : "@mobile"}`, async ({ page }) => {
          await open(page, key, surface);
          if (surface === "task-sheet") {
            // The sheet itself is the surface under test. Masks paint above everything, so masking
            // the (blurred) page behind it would also blot out sheet content.
            const sheet = page.getByRole("dialog");
            await expect(sheet).toHaveScreenshot(`${key}-${surface}.png`, { mask: [sheet.locator("[data-volatile], input[type=date]")] });
            return;
          }
          await expect(page).toHaveScreenshot(`${key}-${surface}.png`, {
            fullPage: true,
            mask: [page.locator("[data-volatile]")],
          });
        });
      }
    }
  });
}
