import Dexie, { type Table } from "dexie";

import { changeParser, SYNC_BATCH, type Change, type KindOf, type RecordOf, type Schemas } from "./records";

// The copy of an app on this device. Every screen reads from it and every
// change is written to it first, so the app works the same with or without
// the server. A change is also noted in the outbox; syncing sends the outbox
// to the server and brings back what changed elsewhere since the last time.

type Pending = { key: string; kind: string; id: string };
type Meta = { key: string; value: unknown };

export type SyncState = {
  /** idle: up to date as of lastSyncAt; offline: the server couldn't be reached; error: it refused. */
  status: "idle" | "syncing" | "offline" | "error";
  lastSyncAt: number | null;
  error?: string;
};

export type Fetcher = (url: string, init: RequestInit) => Promise<Response>;

export type DeviceOptions<S extends Schemas> = {
  /** The browser database's name, e.g. "milo". */
  name: string;
  schemas: S;
  /** More indexes per kind, in Dexie's syntax after the ID, e.g. { set: "workoutId, exerciseId" }. */
  indexes?: Partial<Record<KindOf<S>, string>>;
  /** Where the server's sync endpoint is. */
  url?: string;
  /**
   * The device database's version: raise it when a kind of record is added
   * or its indexes change (Dexie only upgrades a database on a new version).
   * A device that opens a new version also syncs once from the start, so it
   * gets the records an older build of the app skipped as unknown.
   */
  version?: number;
};

export class Device<S extends Schemas> {
  readonly db: Dexie;
  readonly kinds: KindOf<S>[];
  private readonly parse: (input: unknown) => Change<S> | null;
  private readonly url: string;
  private running: Promise<void> | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  /** Called after a local change, to sync soon (set by the sync runtime). */
  onChange: (() => void) | null = null;

  private readonly version: number;

  constructor({ name, schemas, indexes = {}, url = "/api/sync", version = 1 }: DeviceOptions<S>) {
    this.version = version;
    this.kinds = Object.keys(schemas) as KindOf<S>[];
    this.parse = changeParser(schemas);
    this.url = url;
    this.db = new Dexie(name);
    const extra = indexes as Record<string, string | undefined>;
    this.db.version(version).stores({
      ...Object.fromEntries(this.kinds.map((kind) => [kind, extra[kind] ? `id, ${extra[kind]}` : "id"])),
      outbox: "key",
      meta: "key",
    });
  }

  /** The table of one kind of record. */
  table<K extends KindOf<S>>(kind: K): Table<RecordOf<S, K>, string> {
    return this.db.table(kind);
  }

  private get outbox(): Table<Pending, string> {
    return this.db.table("outbox");
  }

  private get meta(): Table<Meta, string> {
    return this.db.table("meta");
  }

  private allTables() {
    return [...this.kinds.map((kind) => this.db.table(kind)), this.outbox, this.meta];
  }

  /**
   * Saves records here and notes them for the server. Each gets a new
   * `updatedAt`, always later than its last one, so it wins over what the
   * server has.
   */
  async save(changes: Change<S>[]): Promise<void> {
    if (changes.length === 0) return;
    const now = Date.now();
    await this.db.transaction("rw", this.allTables(), async () => {
      for (const { kind, record } of changes) {
        const table = this.db.table(kind);
        const previous = (await table.get(record.id)) as { updatedAt: number } | undefined;
        const updatedAt = Math.max(now, (previous?.updatedAt ?? 0) + 1);
        await table.put({ ...record, updatedAt });
        await this.outbox.put({ key: `${kind}/${record.id}`, kind, id: record.id });
      }
    });
    this.onChange?.();
  }

  /** Saves one record. */
  put<K extends KindOf<S>>(kind: K, record: RecordOf<S, K>): Promise<void> {
    return this.save([{ kind, record } as Change<S>]);
  }

  /** Deletes records: they're kept, marked deleted, so the deletion syncs too. */
  async remove<K extends KindOf<S>>(kind: K, ids: string[]): Promise<void> {
    const records = (await this.table(kind).bulkGet(ids)).filter((record) => record !== undefined);
    await this.save(records.map((record) => ({ kind, record: { ...record, deleted: true } }) as Change<S>));
  }

  /** How many changes haven't reached the server yet. */
  pendingCount(): Promise<number> {
    return this.outbox.count();
  }

  async syncState(): Promise<SyncState> {
    return ((await this.meta.get("sync"))?.value as SyncState | undefined) ?? { status: "idle", lastSyncAt: null };
  }

  private setState(state: SyncState) {
    return this.meta.put({ key: "sync", value: state });
  }

  /**
   * Sends what changed here and brings back what changed elsewhere, until
   * both sides are up to date. One sync at a time: a call while one is
   * running waits for it.
   */
  sync(
    // With the server's computer off, a request over Tailscale can wait a
    // long time instead of failing: give up after 15 seconds, call it offline.
    fetcher: Fetcher = (url, init) => fetch(url, { ...init, signal: AbortSignal.timeout(15_000) }),
  ): Promise<void> {
    this.running ??= this.syncOnce(fetcher).finally(() => {
      this.running = null;
    });
    return this.running;
  }

  private async syncOnce(fetcher: Fetcher): Promise<void> {
    const previous = await this.syncState();
    await this.setState({ ...previous, status: "syncing" });
    try {
      // Bounded, in case changes keep arriving faster than they're sent.
      for (let round = 0; round < 50; round++) {
        // A device last synced by another version of the app starts again from the start (see `version`).
        const synced = ((await this.meta.get("schema"))?.value as number | undefined) ?? 1;
        const saved = (await this.meta.get("cursor"))?.value as string | undefined;
        const cursor = synced === this.version ? (saved ?? "0") : "0";
        const pending = await this.outbox.limit(SYNC_BATCH).toArray();
        const outgoing: Change<S>[] = [];
        for (const entry of pending) {
          const record = await this.db.table(entry.kind).get(entry.id);
          if (record) outgoing.push({ kind: entry.kind, record } as Change<S>);
        }

        let response: Response;
        try {
          response = await fetcher(this.url, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ cursor, changes: outgoing }),
            cache: "no-store",
          });
        } catch {
          await this.setState({ ...previous, status: "offline" });
          return;
        }
        if (!response.ok) {
          const message = ((await response.json().catch(() => null)) as { error?: string } | null)?.error;
          await this.setState({ ...previous, status: response.status >= 500 ? "offline" : "error", error: message });
          return;
        }
        const answer = (await response.json()) as { cursor: string; changes: unknown[]; more: boolean; epoch?: string };
        const known = (await this.meta.get("epoch"))?.value as string | undefined;
        if (answer.epoch && known && answer.epoch !== known) {
          // The server was restored from a backup: start again (see startOver).
          await this.startOver(answer.epoch);
          continue;
        }
        await this.receive(outgoing, answer.changes, answer.cursor, answer.epoch);
        if (!answer.more && (await this.outbox.count()) === 0) break;
      }
      await this.setState({ status: "idle", lastSyncAt: Date.now() });
    } catch (error) {
      await this.setState({ ...previous, status: "error", error: error instanceof Error ? error.message : String(error) });
    }
  }

  /**
   * After the server was restored from a backup, it's missing what was
   * logged since the backup was taken, and this device may be the only place
   * that has it. So everything here goes back in the outbox, to be sent
   * again, and the cursor goes back to the start, to fetch everything the
   * server has. The newer change still wins on both sides, so sending
   * records the server already has changes nothing.
   */
  private async startOver(epoch: string) {
    await this.db.transaction("rw", this.allTables(), async () => {
      for (const kind of this.kinds) {
        const ids = (await this.db.table(kind).toCollection().primaryKeys()) as string[];
        await this.outbox.bulkPut(ids.map((id) => ({ key: `${kind}/${id}`, kind, id })));
      }
      await this.meta.put({ key: "cursor", value: "0" });
      await this.meta.put({ key: "epoch", value: epoch });
    });
  }

  /** Applies what came back (the newer change wins) and clears what the server now has. */
  private async receive(sent: Change<S>[], incoming: unknown[], cursor: string, epoch?: string) {
    await this.db.transaction("rw", this.allTables(), async () => {
      for (const raw of incoming) {
        const change = this.parse(raw);
        if (!change) continue;
        const table = this.db.table(change.kind);
        const local = (await table.get(change.record.id)) as { updatedAt: number } | undefined;
        if (!local || change.record.updatedAt > local.updatedAt) {
          await table.put(change.record);
          // A pending change here was older than the server's: it lost.
          await this.outbox.delete(`${change.kind}/${change.record.id}`);
        }
      }
      for (const { kind, record } of sent) {
        const now = (await this.db.table(kind).get(record.id)) as { updatedAt: number } | undefined;
        // Changed again while syncing? Then it stays pending for the next round.
        if (now && now.updatedAt === record.updatedAt) await this.outbox.delete(`${kind}/${record.id}`);
      }
      await this.meta.put({ key: "cursor", value: cursor });
      await this.meta.put({ key: "schema", value: this.version });
      if (epoch) await this.meta.put({ key: "epoch", value: epoch });
    });
  }

  /** Syncs a moment after the last of a burst of changes. */
  syncSoon(delay = 1500) {
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.sync(), delay);
  }

  /** Every record, for an export. */
  async exportAll(): Promise<Record<string, unknown[]>> {
    return Object.fromEntries(await Promise.all(this.kinds.map(async (kind) => [kind, await this.db.table(kind).toArray()] as const)));
  }
}
