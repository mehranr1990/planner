import { SHOWCASES, TEAMMATES } from "./support/fixtures-data";
import { expect, settle, signInShowcase, test } from "./support/test";

// Seeded showcase data: 8 project members (owner + 7 teammates), one with a photo avatar,
// one Persian name, and real open-task allocations (see e2e/support/fixtures-data.ts).

test.describe("PeopleCluster", () => {
  test("project card shows the allocation group near the top with real counts and +N", async ({ page }) => {
    await signInShowcase(page, "en-light", "/projects");
    const card = page.locator("article", { hasText: SHOWCASES["en-light"].projectName });
    const group = card.getByRole("group", { name: "Project members" });
    await expect(group).toBeVisible();
    await expect(card.getByText("Task allocation")).toBeVisible();

    // Faces carry name + badge meaning; 5 shown, the rest collapse into "+3".
    await expect(group.getByRole("img", { name: "Arash Karimi — 5 open tasks" })).toBeVisible();
    await expect(group.getByRole("img", { name: "Mina Rahimi — 3 open tasks" })).toBeVisible();
    await expect(group.getByRole("img", { name: "3 more people" })).toHaveText("+3");

    // Real avatar → <img>; no avatar → initials.
    const photo = group.locator(`img[alt^="${TEAMMATES[1].name}"]`);
    await expect(photo).toHaveAttribute("src", /^data:image\/svg\+xml/);
    await expect(group.getByRole("img", { name: /^Arash Karimi/ })).toHaveText("AK");

    // The group sits in the card's top area, above the metrics.
    const groupBox = (await group.boundingBox())!;
    const metricBox = (await card.getByText("Open tasks").boundingBox())!;
    expect(groupBox.y).toBeLessThan(metricBox.y);
  });

  test("project detail header carries the member strip; task rows show assignee groups", async ({ page }) => {
    const s = await signInShowcase(page, "en-light", "/projects");
    await page.goto(`/projects/${s.projectId}`);
    const strip = page.getByRole("group", { name: "Project members" });
    await expect(strip).toBeVisible();
    const h1 = (await page.getByRole("heading", { level: 1 }).boundingBox())!;
    const box = (await strip.boundingBox())!;
    expect(Math.abs(box.y + box.height / 2 - (h1.y + h1.height / 2))).toBeLessThan(40); // same header row

    const row = page.locator("li", { has: page.getByRole("link", { name: "Audit analytics tags" }) });
    const assignees = row.getByRole("group", { name: "Assignees" });
    await expect(assignees).toBeVisible();
    // 5 assignees (only 4 loaded as a preview), max 3 faces → "+2" from the real total.
    await expect(assignees.getByRole("img", { name: "2 more people" })).toHaveText("+2");
    await expect(assignees.locator(":scope > span")).toHaveCount(4); // 3 faces + overflow chip
    // xs faces fit one initial only.
    for (const face of await assignees.locator(":scope > span [aria-hidden]").all()) {
      const text = (await face.textContent()) ?? "";
      if (!text.startsWith("+")) expect([...text]).toHaveLength(1);
    }
  });

  test("dark surfaces: Next-up card renders assignees with dark-matched rings", async ({ page }) => {
    await signInShowcase(page, "en-dark", "/home");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    const nextUp = page.locator("[aria-labelledby=next-heading]");
    const group = nextUp.getByRole("group", { name: "Assignees" });
    await expect(group).toBeVisible();
    await expect(group.locator(".ring-surface-dark").first()).toBeVisible();
  });

  test("RTL: the stack mirrors (first face at the inline start = right)", async ({ page }) => {
    const s = await signInShowcase(page, "fa-light", "/projects");
    await page.goto(`/projects/${s.projectId}`);
    await settle(page);
    const faces = page.getByRole("group", { name: "اعضای پروژه" }).locator(":scope > span");
    const first = (await faces.nth(0).boundingBox())!;
    const second = (await faces.nth(1).boundingBox())!;
    expect(first.x).toBeGreaterThan(second.x);
    await expect(page.getByRole("group", { name: "اعضای پروژه" }).getByRole("img", { name: /نفر دیگر/ })).toHaveText("+۳");
  });
});
