import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
  resolve: {
    alias: { "server-only": fileURLToPath(new URL("./test/empty.ts", import.meta.url)) },
  },
});
