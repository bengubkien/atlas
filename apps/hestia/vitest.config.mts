import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    // Seeds micasa's sample database once; the contract tests copy it.
    globalSetup: ["./test/global-setup.ts"],
    // Each test file runs micasa many times.
    testTimeout: 30_000,
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      // Next.js keeps server-only modules out of the browser; tests run on the server anyway.
      "server-only": fileURLToPath(new URL("./test/empty.ts", import.meta.url)),
    },
  },
});
