// Runs before Playwright stops the web server. The server closes idle DB connections after
// DATABASE_POOL_IDLE_MS (300ms in E2E); waiting past that means no connection is open when the
// process is killed — local PGlite wedges if a client disappears mid-connection.
export default async function globalTeardown() {
  await new Promise((resolve) => setTimeout(resolve, 1500));
}
