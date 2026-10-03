import { seed } from "./seed";

export default async function globalSetup() {
  try {
    process.loadEnvFile(".env");
  } catch {
    // CI provides the environment directly.
  }
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("E2E needs DATABASE_URL (see README → End-to-end tests).");
  await seed(url);
}
