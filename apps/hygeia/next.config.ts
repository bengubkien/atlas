import path from "node:path";

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@atlas/ui", "@atlas/sync", "@atlas/body"],
  output: "standalone",
  outputFileTracingRoot: path.join(import.meta.dirname, "../.."),
  poweredByHeader: false,
  // Attached files go through the proxy (proxy.ts) on their way to
  // /api/files: let it take Hygeia's largest (25 MB) and the form around it.
  experimental: { proxyClientMaxBodySize: "30mb" },
  env: {
    // Names this build's offline copy: a new build replaces the phone's
    // cached pages and scripts with its own (see public/sw.js).
    NEXT_PUBLIC_HYGEIA_BUILD: process.env.NEXT_PUBLIC_HYGEIA_BUILD ?? String(Date.now()),
  },
};

export default nextConfig;
