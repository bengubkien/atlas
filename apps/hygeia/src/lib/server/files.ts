import "server-only";

import { applyChanges, currentRecords, ready } from "@atlas/sync/server";

import { SCHEMAS, type Attachment } from "../model";

export { sniffType } from "../files";

// Attached files, on the server: the bytes in a table of their own in
// Hygeia's database, next to the synced records, so `pg_dump` (the backups)
// has them with nothing more to set up. The record describing each one is an
// ordinary synced `attachment`.

/** The largest file Hygeia takes: a scan or a phone photo is well under it. */
export const MAX_FILE_BYTES = 25 * 1024 * 1024;

let table: Promise<void> | null = null;

async function files() {
  const db = await ready();
  table ??= db
    .query("create table if not exists files (id text primary key, data bytea not null, created_at timestamptz not null default now())")
    .then(() => undefined)
    .catch((error: unknown) => {
      table = null;
      throw error;
    });
  await table;
  return db;
}

/** Saves a file and the record that says what it is. */
export async function saveAttachment(record: Attachment, bytes: Uint8Array): Promise<void> {
  const db = await files();
  await db.query("insert into files (id, data) values ($1, $2) on conflict (id) do update set data = excluded.data", [record.id, Buffer.from(bytes)]);
  await applyChanges([{ kind: "attachment", record }]);
}

/** A file and its record; null if either is gone. */
export async function readAttachment(id: string): Promise<{ record: Attachment; bytes: Buffer } | null> {
  const record = (await currentRecords(SCHEMAS, ["attachment"])).map((change) => change.record as Attachment).find((each) => each.id === id);
  if (!record) return null;
  const db = await files();
  const { rows } = await db.query<{ data: Buffer }>("select data from files where id = $1", [id]);
  return rows[0] ? { record, bytes: rows[0].data } : null;
}

/** Deletes a file, and marks its record deleted, so every device drops it. */
export async function deleteAttachment(id: string): Promise<boolean> {
  const record = (await currentRecords(SCHEMAS, ["attachment"])).map((change) => change.record as Attachment).find((each) => each.id === id);
  const db = await files();
  await db.query("delete from files where id = $1", [id]);
  if (!record) return false;
  await applyChanges([{ kind: "attachment", record: { ...record, deleted: true, updatedAt: Date.now() } }]);
  return true;
}
