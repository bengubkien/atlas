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
};

export default nextConfig;
