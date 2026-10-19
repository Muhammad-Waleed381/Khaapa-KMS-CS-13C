import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
