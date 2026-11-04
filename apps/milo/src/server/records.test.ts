import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";
import { NextRequest } from "next/server";

import type { Change, WorkoutSet } from "@/lib/model";

// The sync server against a real, throwaway Postgres database.

const databaseUrl = inject("databaseUrl");

const set = (id: string, updatedAt: number, reps: number, extra: Partial<WorkoutSet> = {}): Change => ({
  kind: "set",
  record: {
    id,
    updatedAt,
    deleted: false,
    workoutId: "w1",
    exerciseId: "b-bench-press",
    position: 0,
    index: 0,
    weightKg: 100,
    reps,
    seconds: null,
    meters: null,
    warmup: false,
    done: true,
    ...extra,
  },
});

describe.skipIf(!databaseUrl)("sync server", () => {
  let records: typeof import("./records");
  let db: typeof import("./db");
  let route: typeof import("@/app/api/sync/route");

  beforeAll(async () => {
    process.env.DATABASE_URL = databaseUrl!;
    db = await import("./db");
    records = await import("./records");
    route = await import("@/app/api/sync/route");
  });
  afterAll(async () => {
    await db.closeForTests();
  });

  it("makes its table on first use, and gives back what was saved", async () => {
    expect(await records.applyChanges([set("a", 10, 5), set("b", 10, 6)])).toBe(2);
    const page = await records.changesSince("0");
    expect(page.changes.map((c) => c.record.id)).toEqual(["a", "b"]);
    expect(page.more).toBe(false);
    expect(Number(page.cursor)).toBeGreaterThan(0);
  });

  it("lets the newer change win, and ignores an older one", async () => {
    const before = (await records.changesSince("0")).cursor;
    expect(await records.applyChanges([set("a", 5, 99)])).toBe(0); // older: ignored
    expect(await records.applyChanges([set("a", 20, 8)])).toBe(1); // newer: applied
    const page = await records.changesSince(before);
    expect(page.changes).toHaveLength(1);
    expect(page.changes[0]!.record).toMatchObject({ id: "a", reps: 8, updatedAt: 20 });
  });

  it("keeps the newest of the same record sent twice in one batch", async () => {
    await records.applyChanges([set("c", 30, 1), set("c", 31, 2), set("c", 29, 3)]);
    const all = await records.changesSince("0");
    expect(all.changes.find((c) => c.record.id === "c")!.record).toMatchObject({ reps: 2 });
  });

  it("syncs a deletion like any change", async () => {
    await records.applyChanges([set("b", 40, 6, { deleted: true })]);
    const all = await records.changesSince("0");
    expect(all.changes.find((c) => c.record.id === "b")!.record.deleted).toBe(true);
  });

  it("pages through many changes", async () => {
    await records.applyChanges(Array.from({ length: 25 }, (_, i) => set(`p${i}`, 50, i)));
    const first = await records.changesSince("0", 10);
    expect(first.changes).toHaveLength(10);
    expect(first.more).toBe(true);
    let cursor = first.cursor;
    let seen = first.changes.length;
    for (;;) {
      const page = await records.changesSince(cursor, 10);
      seen += page.changes.length;
      cursor = page.cursor;
      if (!page.more) break;
    }
    expect(seen).toBe((await records.changesSince("0", 1000)).changes.length);
  });

  it("answers a sync request with what's new, and refuses records that aren't valid", async () => {
    const post = (body: unknown) =>
      route.POST(new NextRequest("http://milo.test/api/sync", { method: "POST", body: JSON.stringify(body) }));

    const ok = await post({ cursor: "0", changes: [set("r1", 60, 3)] });
    expect(ok.status).toBe(200);
    const answer = (await ok.json()) as { cursor: string; changes: Change[]; applied: number };
    expect(answer.applied).toBe(1);
    expect(answer.changes.some((c) => c.record.id === "r1")).toBe(true);

    const bad = await post({ cursor: "0", changes: [{ kind: "set", record: { id: "x" } }] });
    expect(bad.status).toBe(400);
    expect(((await bad.json()) as { error: string }).error).toMatch(/Change 0/);
  });
});
