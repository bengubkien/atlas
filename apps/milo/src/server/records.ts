import "server-only";

import { SYNC_BATCH, type Change } from "@/lib/model";

import { ready } from "./db";

/**
 * Saves changes from a device. A change replaces what the server has only if
 * it's newer (its `updatedAt` is later): the last change wins, whichever
 * device it came from. Returns how many were newer.
 */
export async function applyChanges(changes: Change[]): Promise<number> {
  if (changes.length === 0) return 0;
  // The same record twice in one batch: keep its newest change.
  const newest = new Map<string, Change>();
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

export type Page = { changes: Change[]; cursor: string; more: boolean };

/** The changes after `cursor` (a `seq`, as a string), oldest first, at most `limit`. */
export async function changesSince(cursor: string, limit = SYNC_BATCH): Promise<Page> {
  const after = /^\d+$/.test(cursor) ? cursor : "0";
  const db = await ready();
  const { rows } = await db.query<{ kind: Change["kind"]; data: Change["record"]; seq: string }>(
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
