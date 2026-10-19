import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Lets a second dev server run beside the main one (e.g. against a local test database).
  distDir: process.env.NEXT_DIST_DIR || ".next",
  cacheComponents: true,
  partialPrefetching: true,
  // Pages load their data in the browser (so they work offline), which instant
  // navigation validation can't check; only validate segments that opt in.
  experimental: { instantInsights: { validationLevel: "manual-warning" } },
  serverExternalPackages: ["@electric-sql/pglite"],
  turbopack: {
    root: __dirname,
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
