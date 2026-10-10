import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

try {
  process.loadEnvFile(".env");
} catch {
  // No .env — integration tests skip themselves without DATABASE_URL.
}

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      // `server-only` throws outside the React server runtime; tests exercise server modules directly.
      "server-only": fileURLToPath(new URL("./src/test/empty.ts", import.meta.url)),
    },
  },
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
    // Integration suites share one database; run files sequentially.
    fileParallelism: false,
    // Integration tests run many sequential round-trips against a remote Neon branch in CI;
    // vitest's 5s default is too tight for the longer multi-step cases there.
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
