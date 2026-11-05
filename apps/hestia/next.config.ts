import path from "node:path";

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The design kit ships as TypeScript source.
  transpilePackages: ["@atlas/ui"],
  // A self-contained server for the Docker image, traced from the repo's root
  // so the kit is included.
  output: "standalone",
  outputFileTracingRoot: path.join(import.meta.dirname, "../.."),
  poweredByHeader: false,
  // Documents are uploaded through a Server Action, and pass through the
  // proxy (proxy.ts) on the way: let both take micasa's largest file (50 MB),
  // with room for the form around it. Next's defaults are 1 MB and 10 MB.
  experimental: {
    serverActions: { bodySizeLimit: "55mb" },
    proxyClientMaxBodySize: "55mb",
  },
};

export default nextConfig;
