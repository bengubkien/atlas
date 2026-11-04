import "server-only";

import { Pool } from "pg";

// Milo's server keeps one table: every record from every device, as JSON, with
// a number that goes up on every change (`seq`). A device asks for "everything
// after the number I last saw", so it never misses a change and never gets
// one twice. That's all the server needs to know about training; the phone
// does the rest with its own copy.
//
// DATABASE_URL: the Postgres database (deploy/compose.yml: the "milo" database).

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

export function database(): Pool {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL isn't set: Milo needs its Postgres database.");
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
