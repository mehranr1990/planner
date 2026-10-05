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
  experimental: {
    serverActions: {
      // Default is 1MB; task attachments (20 MB) and avatars (5 MB) upload as FormData through a
      // Server Action, so the limit needs headroom above the larger of the two plus FormData's own
      // encoding overhead. See docs/HANDOFF.md § Vercel Blob for the per-type limits.
      bodySizeLimit: "22mb",
    },
  },
};

export default withNextIntl(nextConfig);
