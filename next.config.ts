import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

// next-intl without locale routing: the locale comes from src/i18n/request.ts.
const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  // E2E builds into its own directory so it never collides with a running `next dev` (.next).
  distDir: process.env.NEXT_DIST_DIR || ".next",
  // The dev indicator would sit on the navigation rail in one direction or the other (the rail
  // is on the left in LTR and on the right in RTL). Runtime errors still open the dev overlay.
  devIndicators: false,
};

export default withNextIntl(nextConfig);
