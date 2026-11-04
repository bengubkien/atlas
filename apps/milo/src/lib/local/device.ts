import Dexie, { type EntityTable } from "dexie";

import {
  KINDS,
  parseChange,
  SYNC_BATCH,
  type Change,
  type Exercise,
  type Kind,
  type RecordOf,
  type Routine,
  type Settings,
  type Workout,
  type WorkoutSet,
} from "../model";

// The copy of Milo on this device. Every screen reads from it and every
// change is written to it first, so Milo works the same with or without the
// server. A change is also noted in the outbox; syncing sends the outbox to the
// server and brings back what changed elsewhere since the last time.

type Pending = { key: string; kind: Kind; id: string };
type Meta = { key: string; value: unknown };

export type SyncState = {
  /** idle: up to date as of lastSyncAt; offline: the server couldn't be reached; error: it refused. */
  status: "idle" | "syncing" | "offline" | "error";
  lastSyncAt: number | null;
  error?: string;
};

class MiloDatabase extends Dexie {
  exercise!: EntityTable<Exercise, "id">;
  routine!: EntityTable<Routine, "id">;
  workout!: EntityTable<Workout, "id">;
  set!: EntityTable<WorkoutSet, "id">;
  settings!: EntityTable<Settings, "id">;
  outbox!: EntityTable<Pending, "key">;
  meta!: EntityTable<Meta, "key">;

  constructor(name: string) {
    super(name);
    this.version(1).stores({
      exercise: "id",
      routine: "id",
      workout: "id, startedAt",
      set: "id, workoutId, exerciseId",
      settings: "id",
      outbox: "key",
      meta: "key",
    });
  }
}

type Fetcher = (url: string, init: RequestInit) => Promise<Response>;

export class Device {
  readonly db: MiloDatabase;
  private running: Promise<void> | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  /** Called after a local change, to sync soon (set by startSync). */
  onChange: (() => void) | null = null;

  constructor(name = "milo") {
    this.db = new MiloDatabase(name);
  }

  private table<K extends Kind>(kind: K) {
    return this.db.table<RecordOf<K>, string>(kind);
  }

  /**
   * Saves records here and notes them for the server. Each gets a new
   * `updatedAt`, always later than its last one, so it wins over what the
   * server has.
   */
  async save(changes: Change[]): Promise<void> {
    if (changes.length === 0) return;
    const now = Date.now();
    await this.db.transaction("rw", [...KINDS.map((kind) => this.db.table(kind)), this.db.outbox], async () => {
      for (const { kind, record } of changes) {
        const previous = await this.table(kind).get(record.id);
        const updatedAt = Math.max(now, (previous?.updatedAt ?? 0) + 1);
        await this.table(kind).put({ ...record, updatedAt } as never);
        await this.db.outbox.put({ key: `${kind}/${record.id}`, kind, id: record.id });
      }
    });
    this.onChange?.();
  }

  /** Saves one record. */
  put<K extends Kind>(kind: K, record: RecordOf<K>): Promise<void> {
    return this.save([{ kind, record } as Change]);
  }

  /** Deletes records: they're kept, marked deleted, so the deletion syncs too. */
  async remove(kind: Kind, ids: string[]): Promise<void> {
    const records = (await this.table(kind).bulkGet(ids)).filter((record) => record !== undefined);
    await this.save(records.map((record) => ({ kind, record: { ...record, deleted: true } }) as Change));
  }

  /** How many changes haven't reached the server yet. */
  pendingCount(): Promise<number> {
    return this.db.outbox.count();
  }

  async syncState(): Promise<SyncState> {
    return ((await this.db.meta.get("sync"))?.value as SyncState | undefined) ?? { status: "idle", lastSyncAt: null };
  }

  private setState(state: SyncState) {
    return this.db.meta.put({ key: "sync", value: state });
  }

  /**
   * Sends what changed here and brings back what changed elsewhere, until
   * both sides are up to date. One sync at a time: a call while one is running
   * waits for it.
   */
  sync(
    // With the desktop off, a request over Tailscale can wait a long time
    // instead of failing: give up after 15 seconds and call it offline.
    fetcher: Fetcher = (url, init) => fetch(url, { ...init, signal: AbortSignal.timeout(15_000) }),
    url = "/api/sync",
  ): Promise<void> {
    this.running ??= this.syncOnce(fetcher, url).finally(() => {
      this.running = null;
    });
    return this.running;
  }

  private async syncOnce(fetcher: Fetcher, url: string): Promise<void> {
    const previous = await this.syncState();
    await this.setState({ ...previous, status: "syncing" });
    try {
      // Bounded, in case changes keep arriving faster than they're sent.
      for (let round = 0; round < 50; round++) {
        const cursor = ((await this.db.meta.get("cursor"))?.value as string | undefined) ?? "0";
        const pending = await this.db.outbox.limit(SYNC_BATCH).toArray();
        const outgoing: Change[] = [];
        for (const entry of pending) {
          const record = await this.table(entry.kind).get(entry.id);
          if (record) outgoing.push({ kind: entry.kind, record } as Change);
        }

        let response: Response;
        try {
          response = await fetcher(url, {
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
        const answer = (await response.json()) as { cursor: string; changes: unknown[]; more: boolean };
        await this.receive(outgoing, answer.changes, answer.cursor);
        if (!answer.more && (await this.db.outbox.count()) === 0) break;
      }
      await this.setState({ status: "idle", lastSyncAt: Date.now() });
    } catch (error) {
      await this.setState({ ...previous, status: "error", error: error instanceof Error ? error.message : String(error) });
    }
  }

  /** Applies what came back (the newer change wins) and clears what the server now has. */
  private async receive(sent: Change[], incoming: unknown[], cursor: string) {
    await this.db.transaction("rw", [...KINDS.map((kind) => this.db.table(kind)), this.db.outbox, this.db.meta], async () => {
      for (const raw of incoming) {
        const change = parseChange(raw);
        if (!change) continue;
        const local = await this.table(change.kind).get(change.record.id);
        if (!local || change.record.updatedAt > local.updatedAt) {
          await this.table(change.kind).put(change.record as never);
          // A pending change here was older than the server's: it lost.
          await this.db.outbox.delete(`${change.kind}/${change.record.id}`);
        }
      }
      for (const { kind, record } of sent) {
        const now = await this.table(kind).get(record.id);
        // Changed again while syncing? Then it stays pending for the next round.
        if (now && now.updatedAt === record.updatedAt) await this.db.outbox.delete(`${kind}/${record.id}`);
      }
      await this.db.meta.put({ key: "cursor", value: cursor });
    });
  }

  /** Syncs a moment after the last of a burst of changes. */
  syncSoon(delay = 1500, fetcher?: Fetcher) {
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.sync(fetcher), delay);
  }
}

let device: Device | null = null;

/** This browser's copy of Milo. */
export function thisDevice(): Device {
  device ??= new Device();
  return device;
}
