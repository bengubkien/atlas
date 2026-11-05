import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// One lint for the pnpm workspace: Next's recommended rules (React, hooks,
// accessibility, Core Web Vitals) and TypeScript's. Kairos has its own
// (apps/kairos/eslint.config.mjs), as it isn't part of the workspace.

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    settings: { next: { rootDir: ["apps/atlas/", "apps/hestia/", "apps/milo/", "apps/hygeia/"] } },
  },
  globalIgnores([
    "**/.next/**",
    "**/node_modules/**",
    "**/next-env.d.ts",
    "apps/kairos/**",
    // Generated: MakeHuman's figures as data.
    "packages/body/src/figures.ts",
  ]),
]);
