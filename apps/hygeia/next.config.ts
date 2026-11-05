import path from "node:path";

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@atlas/ui", "@atlas/sync", "@atlas/body"],
  output: "standalone",
  outputFileTracingRoot: path.join(import.meta.dirname, "../.."),
  poweredByHeader: false,
  env: {
    // Names this build's offline copy: a new build replaces the phone's
    // cached pages and scripts with its own (see public/sw.js).
    NEXT_PUBLIC_HYGEIA_BUILD: process.env.NEXT_PUBLIC_MILO_BUILD ?? String(Date.now()),
  },
};

export default nextConfig;
