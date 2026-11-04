import "server-only";

import { NextResponse, type NextRequest } from "next/server";
import { Pool } from "pg";
import { z } from "zod";

import { changeParser, SYNC_BATCH, type Change, type Schemas } from "./records";

// The server side: one table with every record from every device, as JSON,
// and a number that goes up on every change (`seq`). A device asks for
// "everything after the number I last saw", so it never misses a change and
// never gets one twice. Each app has its own database (DATABASE_URL).

const MIGRATIONS: { id: number; sql: string }[] = [
  {
    id: 1,
    sql: `
      create sequence records_seq;
      create table records (
        kind text not null,
        id text not null,
        data jsonb not null,
        updated_at bigint not null,
        deleted boolean not null default false,
        seq bigint not null default nextval('records_seq'),
        primary key (kind, id)
      );
      create index records_by_seq on records (seq);
    `,
  },
];

let pool: Pool | null = null;
let migrated: Promise<void> | null = null;

function database(): Pool {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL isn't set: the app needs its Postgres database.");
  pool ??= new Pool({ connectionString: process.env.DATABASE_URL, max: 5 });
  return pool;
}

/** Applies the migrations not applied yet, once per process; one server at a time, thanks to an advisory lock. */
export function ready(): Promise<Pool> {
  migrated ??= (async () => {
    const client = await database().connect();
    try {
      await client.query("begin");
      await client.query("select pg_advisory_xact_lock(4242001)");
      await client.query("create table if not exists migrations (id int primary key, applied_at timestamptz not null default now())");
      const { rows } = await client.query<{ id: number }>("select id from migrations");
      const applied = new Set(rows.map((row) => row.id));
      for (const migration of MIGRATIONS) {
        if (applied.has(migration.id)) continue;
        await client.query(migration.sql);
        await client.query("insert into migrations (id) values ($1)", [migration.id]);
      }
      await client.query("commit");
    } catch (error) {
      await client.query("rollback");
      migrated = null; // try again on the next request
      throw error;
    } finally {
      client.release();
    }
  })();
  return migrated.then(() => database());
}

/** For tests: close the pool and forget the migrations ran. */
export async function closeForTests() {
  await pool?.end();
  pool = null;
  migrated = null;
}

type AnyChange = { kind: string; record: { id: string; updatedAt: number; deleted: boolean } };

/**
 * Saves changes from a device. A change replaces what the server has only if
 * it's newer (its `updatedAt` is later): the last change wins, whichever
 * device it came from. Returns how many were newer.
 */
export async function applyChanges(changes: AnyChange[]): Promise<number> {
  if (changes.length === 0) return 0;
  // The same record twice in one batch: keep its newest change.
  const newest = new Map<string, AnyChange>();
  for (const change of changes) {
    const key = `${change.kind}/${change.record.id}`;
    const seen = newest.get(key);
    if (!seen || seen.record.updatedAt <= change.record.updatedAt) newest.set(key, change);
  }
  const batch = [...newest.values()];
  const db = await ready();
  const result = await db.query(
    `insert into records (kind, id, data, updated_at, deleted)
       select * from unnest($1::text[], $2::text[], $3::jsonb[], $4::bigint[], $5::boolean[])
     on conflict (kind, id) do update
       set data = excluded.data,
           updated_at = excluded.updated_at,
           deleted = excluded.deleted,
           seq = nextval('records_seq')
       where records.updated_at < excluded.updated_at`,
    [
      batch.map((change) => change.kind),
      batch.map((change) => change.record.id),
      batch.map((change) => JSON.stringify(change.record)),
      batch.map((change) => change.record.updatedAt),
      batch.map((change) => change.record.deleted),
    ],
  );
  return result.rowCount ?? 0;
}

export type Page = { changes: AnyChange[]; cursor: string; more: boolean };

/** The changes after `cursor` (a `seq`, as a string), oldest first, at most `limit`. */
export async function changesSince(cursor: string, limit = SYNC_BATCH): Promise<Page> {
  const after = /^\d+$/.test(cursor) ? cursor : "0";
  const db = await ready();
  const { rows } = await db.query<{ kind: string; data: AnyChange["record"]; seq: string }>(
    "select kind, data, seq from records where seq > $1 order by seq limit $2",
    [after, limit + 1],
  );
  const more = rows.length > limit;
  const page = more ? rows.slice(0, limit) : rows;
  return {
    changes: page.map((row) => ({ kind: row.kind, record: row.data })),
    cursor: page.at(-1)?.seq ?? after,
    more,
  };
}

/** The current records of some kinds, deleted ones left out: for what the server itself serves (a calendar feed). */
export async function currentRecords<S extends Schemas, K extends keyof S & string>(schemas: S, kinds: K[]): Promise<Change<S>[]> {
  const db = await ready();
  const { rows } = await db.query<{ kind: string; data: unknown }>("select kind, data from records where kind = any($1) and not deleted", [kinds]);
  const parse = changeParser(schemas);
  return rows.map((row) => parse({ kind: row.kind, record: row.data })).filter((change) => change !== null);
}

const requestBody = z.object({
  cursor: z.string().max(30).default("0"),
  changes: z.array(z.unknown()).max(SYNC_BATCH).default([]),
});

/**
 * The sync endpoint, for an app's app/api/sync/route.ts:
 * `export const POST = syncHandler(SCHEMAS)`. The device sends what changed on
 * it since the last sync, and gets back what changed anywhere since the
 * cursor it last had. The app's proxy.ts has already checked it's you.
 */
export function syncHandler<S extends Schemas>(schemas: S) {
  const parse = changeParser(schemas);
  return async function POST(request: NextRequest) {
    const parsed = requestBody.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "A sync request is { cursor, changes }." }, { status: 400 });

    const changes: Change<S>[] = [];
    for (const [index, raw] of parsed.data.changes.entries()) {
      const change = parse(raw);
      if (!change) return NextResponse.json({ error: `Change ${index} isn't a valid record.` }, { status: 400 });
      changes.push(change);
    }

    try {
      const applied = await applyChanges(changes as AnyChange[]);
      const page = await changesSince(parsed.data.cursor);
      return NextResponse.json({ ...page, applied });
    } catch (error) {
      console.error("sync failed", error);
      return NextResponse.json({ error: "The server couldn't save. Your changes stay on this device." }, { status: 503 });
    }
  };
}
