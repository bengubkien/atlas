import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    // A throwaway Postgres database (ATLAS_TEST_POSTGRES), shared: one file at a time.
    globalSetup: ["./test/global-setup.ts"],
    fileParallelism: false,
    testTimeout: 30_000,
  },
  resolve: {
    alias: { "server-only": fileURLToPath(new URL("./test/empty.ts", import.meta.url)) },
  },
});
