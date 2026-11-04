import "server-only";

import { execFile } from "node:child_process";
import { existsSync } from "node:fs";

import type { z } from "zod";

// Hestia keeps no data of its own: everything is in micasa's SQLite file, and
// every read and write goes through the `micasa` program, so its validation,
// its defaults and its history of changes apply exactly as in its terminal app.
//
// - MICASA_BIN: the program (default `micasa` on the PATH).
// - MICASA_DB_PATH: the database file (default /data/micasa.db), the variable
//   micasa itself reads, so `micasa backup` in the container finds it too.

export class MicasaError extends Error {
  constructor(
    message: string,
    readonly args: readonly string[],
  ) {
    super(message);
    this.name = "MicasaError";
  }
}

export function micasaConfig() {
  return {
    bin: process.env.MICASA_BIN || "micasa",
    db: process.env.MICASA_DB_PATH || "/data/micasa.db",
  };
}

/** micasa's error, without terminal colour codes and Cobra's "Error:" prefix. */
function cleanMessage(stderr: string): string {
  return stderr
    .replace(/\x1b\[[0-9;?]*[A-Za-z]/g, "")
    .replace(/\x1b\][^\x07]*\x07/g, "")
    .replace(/^\s*Error:\s*/i, "")
    .trim()
    .split("\n")
    .filter(Boolean)
    .at(-1) ?? "";
}

type ExecOptions = {
  /** Resolve whatever the exit code (making the database). */
  allowFailure?: boolean;
  /** Exit codes that are answers, not failures: `status` exits 2 when something needs attention. */
  okCodes?: number[];
};

function exec(args: string[], { allowFailure = false, okCodes = [] }: ExecOptions = {}): Promise<string> {
  const { bin } = micasaConfig();
  return new Promise((resolve, reject) => {
    execFile(
      // A program outside the app, chosen at run time: nothing for the bundler to trace.
      /*turbopackIgnore: true*/ bin,
      args,
      { timeout: 30_000, maxBuffer: 128 * 1024 * 1024, env: { ...process.env, NO_COLOR: "1" } },
      (error, stdout, stderr) => {
        const code = typeof error?.code === "number" ? error.code : null;
        if (error && !allowFailure && !(code !== null && okCodes.includes(code))) {
          const missing = (error as NodeJS.ErrnoException).code === "ENOENT";
          reject(
            new MicasaError(
              missing ? `The micasa program isn't at "${bin}". Set MICASA_BIN.` : cleanMessage(stderr) || error.message,
              args,
            ),
          );
        } else {
          resolve(stdout);
        }
      },
    );
  });
}

let ready: Promise<void> | null = null;

/**
 * Makes the database the first time Hestia runs. micasa has no command for
 * that: starting its terminal app creates the file, applies its schema and
 * adds the default categories and project types, then stops, because there's
 * no terminal here. Afterwards the categories must be there, or it failed.
 */
export function ensureDatabase(): Promise<void> {
  ready ??= (async () => {
    const { db } = micasaConfig();
    // The database is outside the app: keep the bundler from tracing it.
    if (existsSync(/*turbopackIgnore: true*/ db)) return;
    await inLine([db], { allowFailure: true });
    const types = JSON.parse(await inLine(["db", "project-type", "list", db])) as unknown[];
    if (!Array.isArray(types) || types.length === 0) {
      throw new MicasaError(`micasa couldn't create its database at ${db}.`, [db]);
    }
  })().catch((error) => {
    ready = null; // try again on the next request
    throw error;
  });
  return ready;
}

function parse<S extends z.ZodType>(schema: S, stdout: string, args: string[]): z.infer<S> {
  let json: unknown;
  try {
    json = JSON.parse(stdout);
  } catch {
    throw new MicasaError(`micasa answered something that isn't JSON: ${stdout.slice(0, 120)}`, args);
  }
  const result = schema.safeParse(json);
  if (!result.success) {
    // micasa changed shape: say where, so the pinned version or the schema can be fixed.
    throw new MicasaError(`micasa's answer didn't have the expected shape: ${result.error.issues[0]?.path.join(".")} ${result.error.issues[0]?.message}`, args);
  }
  return result.data;
}

// One command at a time, reads included: every micasa command applies its
// schema and rebuilds its search index when it opens the database, and two
// doing that at once collide ("table entities_fts already exists"). At about
// 90 ms a command, waiting in line costs little for one person.
let queue: Promise<unknown> = Promise.resolve();

function inLine(args: string[], options: ExecOptions = {}): Promise<string> {
  const run = queue.then(() => exec(args, options));
  queue = run.catch(() => undefined);
  return run;
}

/** Runs a reading command; the database path goes after the other arguments. */
export async function read<S extends z.ZodType>(
  schema: S,
  args: string[],
  flags: string[] = [],
  options: Pick<ExecOptions, "okCodes"> = {},
): Promise<z.infer<S>> {
  await ensureDatabase();
  const full = [...args, micasaConfig().db, ...flags];
  return parse(schema, await inLine(full, options), full);
}

/** Runs a writing command. The same line as reads; a separate name, so callers say which they mean. */
export const write = read;

/** For tests: forget that the database was checked. */
export function resetForTests() {
  ready = null;
  queue = Promise.resolve();
}
