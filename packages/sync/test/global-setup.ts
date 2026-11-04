import { randomBytes } from "node:crypto";

import { Client } from "pg";
import type { TestProject } from "vitest/node";

declare module "vitest" {
  export interface ProvidedContext {
    /** A fresh, empty database for this run; null without ATLAS_TEST_POSTGRES. */
    databaseUrl: string | null;
  }
}

/**
 * Makes a throwaway database on the Postgres at ATLAS_TEST_POSTGRES (a
 * connection URL to any database there, e.g. postgres://user:pass@localhost:5432/postgres),
 * and drops it afterwards. Without it, the server tests are skipped.
 */
export default async function setup(project: TestProject) {
  const admin = process.env.ATLAS_TEST_POSTGRES;
  if (!admin) {
    console.warn("No ATLAS_TEST_POSTGRES: the sync tests are skipped.");
    project.provide("databaseUrl", null);
    return;
  }
  const name = `sync_test_${randomBytes(4).toString("hex")}`;
  const client = new Client({ connectionString: admin });
  await client.connect();
  await client.query(`create database ${name}`);
  await client.end();
  const url = new URL(admin);
  url.pathname = `/${name}`;
  project.provide("databaseUrl", url.toString());
  return async () => {
    const cleanup = new Client({ connectionString: admin });
    await cleanup.connect();
    await cleanup.query(`drop database if exists ${name} with (force)`);
    await cleanup.end();
  };
}
