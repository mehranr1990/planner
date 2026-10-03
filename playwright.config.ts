import { defineConfig } from "@playwright/test";

// End-to-end + visual regression. See README → "End-to-end tests" and docs/QA.md.
//
// Browser: Playwright's bundled Chromium by default (`npx playwright install chromium`).
// Where its CDN is unreachable, use an installed browser: PW_CHANNEL=msedge or PW_CHANNEL=chrome.
// Visual baselines are stored per platform + browser so they never get mixed.

const PORT = Number(process.env.E2E_PORT ?? 3210);
const BASE_URL = `http://localhost:${PORT}`;
const channel = process.env.PW_CHANNEL || undefined;
const browserLabel = channel ?? "chromium";

export default defineConfig({
  testDir: "e2e",
  // One worker: the local dev database (PGlite) serves a single connection, and flows share it.
  workers: 1,
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  timeout: 90_000,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  globalSetup: "./e2e/support/global-setup.ts",
  globalTeardown: "./e2e/support/global-teardown.ts",
  snapshotPathTemplate: `{testDir}/__screenshots__/{platform}-${browserLabel}/{projectName}/{arg}{ext}`,
  expect: {
    timeout: 15_000,
    toHaveScreenshot: {
      // Anti-aliasing noise only; real layout shifts move far more pixels than this.
      maxDiffPixelRatio: 0.002,
      animations: "disabled",
      caret: "hide",
      scale: "css",
    },
  },
  use: {
    baseURL: BASE_URL,
    channel,
    locale: "en-US",
    timezoneId: "Asia/Tehran",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "flows", testIgnore: /visual\.spec\.ts/, use: { viewport: { width: 1440, height: 960 } } },
    { name: "visual-desktop", testMatch: /visual\.spec\.ts/, grep: /@desktop/, use: { viewport: { width: 1440, height: 960 } } },
    { name: "visual-mobile", testMatch: /visual\.spec\.ts/, grep: /@mobile/, use: { viewport: { width: 390, height: 844 }, hasTouch: true } },
  ],
  webServer: {
    // Production server by default (what users get); E2E_DEV=1 runs against `next dev` instead.
    command: process.env.E2E_DEV ? `npx next dev -p ${PORT}` : `npm run build && npx next start -p ${PORT}`,
    url: `${BASE_URL}/sign-in`,
    // Separate build output: a developer's own `next dev` keeps using .next undisturbed.
    env: { NEXT_DIST_DIR: ".next-e2e", DATABASE_POOL_IDLE_MS: "300" },
    reuseExistingServer: !process.env.CI,
    timeout: 300_000,
  },
});
