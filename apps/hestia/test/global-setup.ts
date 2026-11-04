import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import type { TestProject } from "vitest/node";

declare module "vitest" {
  export interface ProvidedContext {
    /** micasa's sample database, seeded fresh for this run; null without the program. */
    demoDb: string | null;
  }
}

/**
 * Seeds micasa's sample house with the program at MICASA_BIN (default
 * `micasa` on the PATH): the version the tests check Hestia against. Without
 * it, the contract tests are skipped and say why.
 */
export default function setup(project: TestProject) {
  const bin = process.env.MICASA_BIN || "micasa";
  const dir = mkdtempSync(path.join(tmpdir(), "hestia-test-"));
  const db = path.join(dir, "demo.db");
  try {
    execFileSync(bin, ["demo", "--seed-only", db], { stdio: "ignore" });
    const version = execFileSync(bin, ["--version"], { encoding: "utf8" }).trim();
    console.log(`Contract tests against ${version} (${bin})`);
    project.provide("demoDb", db);
  } catch {
    console.warn(`No micasa at "${bin}": the contract tests are skipped. Set MICASA_BIN to run them.`);
    project.provide("demoDb", null);
  }
  return () => rmSync(dir, { recursive: true, force: true });
}
