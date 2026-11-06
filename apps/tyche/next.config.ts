import path from "node:path";

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@atlas/ui", "@atlas/sync"],
  output: "standalone",
  outputFileTracingRoot: path.join(import.meta.dirname, "../.."),
  poweredByHeader: false,
  // Lets several development servers of this app run side by side, each with its own build folder.
  ...(process.env.TYCHE_DIST_DIR ? { distDir: process.env.TYCHE_DIST_DIR } : {}),
  env: {
    // Names this build's offline copy: a new build replaces the phone's
    // cached pages and scripts with its own (see public/sw.js).
    NEXT_PUBLIC_TYCHE_BUILD: process.env.NEXT_PUBLIC_TYCHE_BUILD ?? String(Date.now()),
  },
};

export default nextConfig;
