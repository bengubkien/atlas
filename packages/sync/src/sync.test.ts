import "fake-indexeddb/auto";

import { NextRequest } from "next/server";
import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";
import { z } from "zod";

import { Device } from "./device";
import { changeParser, recordBase } from "./records";

// The sync engine with a tiny app of its own: notes in folders. The server
// runs against a real, throwaway Postgres database; the devices against
// in-memory IndexedDB.

const SCHEMAS = {
  folder: z.object({ ...recordBase, name: z.string() }),
  note: z.object({ ...recordBase, folderId: z.string(), text: z.string().default("") }),
};
type Note = z.infer<typeof SCHEMAS.note>;

const databaseUrl = inject("databaseUrl");
const note = (id: string, text: string, updatedAt = 0): Note => ({ id, updatedAt, deleted: false, folderId: "f1", text });

describe("records on the wire", () => {
  const parse = changeParser(SCHEMAS);
  it("accepts a valid record of a known kind and fills its defaults", () => {
    expect(parse({ kind: "note", record: { id: "a", updatedAt: 5, folderId: "f" } })?.record).toMatchObject({ deleted: false, text: "" });
  });
  it("refuses unknown kinds and records that don't fit", () => {
    expect(parse({ kind: "nope", record: { id: "a", updatedAt: 1 } })).toBeNull();
    expect(parse({ kind: "note", record: { id: "a", updatedAt: 1 } })).toBeNull();
    expect(parse({ kind: "toString", record: {} })).toBeNull();
  });
});

describe("seeding a version", () => {
  it("replaces an older seeded copy, never a real change", async () => {
    const device = new Device({ name: `seed-${Math.random()}`, schemas: SCHEMAS });
    expect(await device.seed([{ kind: "note", record: note("sample-a", "first") }], { at: 2 })).toBe(1);
    expect(await device.seed([{ kind: "note", record: note("sample-a", "again") }], { at: 2 })).toBe(0);
    expect(await device.seed([{ kind: "note", record: note("sample-a", "second") }], { at: 3 })).toBe(1);
    expect(await device.table("note").get("sample-a")).toMatchObject({ text: "second", updatedAt: 3 });
    // An older build seeding its older version changes nothing.
    expect(await device.seed([{ kind: "note", record: note("sample-a", "first") }], { at: 2 })).toBe(0);
    // Deleted for real: it stays deleted at every later version.
    await device.remove("note", ["sample-a"]);
    expect(await device.seed([{ kind: "note", record: note("sample-a", "third") }], { at: 4 })).toBe(0);
    expect((await device.table("note").get("sample-a"))!.deleted).toBe(true);
  });
});

describe.skipIf(!databaseUrl)("syncing through the server", () => {
  let server: typeof import("./server");
  let fetcher: (url: string, init: RequestInit) => Promise<Response>;
  const phone = new Device({ name: `phone-${Math.random()}`, schemas: SCHEMAS, indexes: { note: "folderId" } });
  const desktop = new Device({ name: `desktop-${Math.random()}`, schemas: SCHEMAS, indexes: { note: "folderId" } });
  const offline = async (): Promise<Response> => {
    throw new TypeError("Failed to fetch");
  };

  beforeAll(async () => {
    process.env.DATABASE_URL = databaseUrl!;
    server = await import("./server");
    const POST = server.syncHandler(SCHEMAS);
    fetcher = (url, init) => POST(new NextRequest(`http://app.test${url}`, init as ConstructorParameters<typeof NextRequest>[1]));
  });
  afterAll(async () => {
    await server.closeForTests();
  });

  it("stores changes, lets the newer win, and pages through them", async () => {
    expect(await server.applyChanges([{ kind: "note", record: note("a", "one", 10) }, { kind: "note", record: note("b", "two", 10) }])).toBe(2);
    const first = await server.changesSince("0");
    expect(first.changes.map((c) => c.record.id)).toEqual(["a", "b"]);
    expect(await server.applyChanges([{ kind: "note", record: note("a", "old", 5) }])).toBe(0);
    expect(await server.applyChanges([{ kind: "note", record: note("a", "new", 20) }])).toBe(1);
    const next = await server.changesSince(first.cursor);
    expect(next.changes).toHaveLength(1);
    expect(next.changes[0]!.record).toMatchObject({ id: "a", text: "new" });
    await server.applyChanges(Array.from({ length: 25 }, (_, i) => ({ kind: "note", record: note(`p${i}`, "x", 30) })));
    const page = await server.changesSince("0", 10);
    expect(page.changes).toHaveLength(10);
    expect(page.more).toBe(true);
  });

  it("keeps changes made offline and sends them when the server is back", async () => {
    await phone.put("folder", { id: "f1", updatedAt: 0, deleted: false, name: "Ideas" });
    await phone.save([{ kind: "note", record: note("n1", "first") }, { kind: "note", record: note("n2", "second") }]);
    await phone.sync(offline);
    expect((await phone.syncState()).status).toBe("offline");
    expect(await phone.pendingCount()).toBe(3);
    await phone.sync(fetcher);
    expect(await phone.pendingCount()).toBe(0);
    await desktop.sync(fetcher);
    expect((await desktop.table("folder").get("f1"))?.name).toBe("Ideas");
    expect(await desktop.table("note").where("folderId").equals("f1").count()).toBeGreaterThanOrEqual(2);
  });

  it("lets the later change win when both devices edit the same record, and syncs deletions", async () => {
    await desktop.put("note", { ...(await desktop.table("note").get("n1"))!, text: "desktop" });
    await new Promise((resolve) => setTimeout(resolve, 5));
    await phone.put("note", { ...(await phone.table("note").get("n1"))!, text: "phone" });
    await desktop.sync(fetcher);
    await phone.sync(fetcher);
    await desktop.sync(fetcher);
    expect((await desktop.table("note").get("n1"))!.text).toBe("phone");
    await phone.remove("note", ["n2"]);
    await phone.sync(fetcher);
    await desktop.sync(fetcher);
    expect((await desktop.table("note").get("n2"))!.deleted).toBe(true);
  });

  it("never lets a record a device made up by itself win over a real change", async () => {
    // Both devices make next month's bill; the phone also marks it paid.
    expect(await phone.seed([{ kind: "note", record: note("bill", "expected") }])).toBe(1);
    expect(await phone.seed([{ kind: "note", record: note("bill", "expected again") }])).toBe(0);
    await phone.put("note", { ...(await phone.table("note").get("bill"))!, text: "paid" });
    await phone.sync(fetcher);
    // The desktop made it later in time, before hearing from the phone.
    await new Promise((resolve) => setTimeout(resolve, 5));
    await desktop.seed([{ kind: "note", record: note("bill", "expected") }]);
    await desktop.sync(fetcher);
    await phone.sync(fetcher);
    expect((await desktop.table("note").get("bill"))!.text).toBe("paid");
    expect((await phone.table("note").get("bill"))!.text).toBe("paid");
    // A deleted record counts as had: a skipped bill isn't made again.
    await phone.remove("note", ["bill"]);
    expect(await phone.seed([{ kind: "note", record: note("bill", "expected") }])).toBe(0);
    expect((await phone.table("note").get("bill"))!.deleted).toBe(true);
    await phone.sync(fetcher);
  });

  it("says when the server refuses a record, and keeps it", async () => {
    const response = await fetcher("/api/sync", { method: "POST", body: JSON.stringify({ changes: [{ kind: "note", record: { id: "x" } }] }) });
    expect(response.status).toBe(400);
    const refusing = async () => Response.json({ error: "Change 0 isn't a valid record." }, { status: 400 });
    await phone.put("note", note("n3", "third"));
    await phone.sync(refusing);
    expect(await phone.syncState()).toMatchObject({ status: "error", error: "Change 0 isn't a valid record." });
    expect(await phone.pendingCount()).toBe(1);
  });

  it("gives a device that moved to a new version the records its older build skipped", async () => {
    // A later version of the app adds a kind of record.
    const LATER = { ...SCHEMAS, tag: z.object({ ...recordBase, label: z.string() }) };
    const later = server.syncHandler(LATER);
    const fetchLater = (url: string, init: RequestInit) => later(new NextRequest(`http://app.test${url}`, init as ConstructorParameters<typeof NextRequest>[1]));
    const name = `tablet-${Math.random()}`;

    const tablet = new Device({ name, schemas: SCHEMAS });
    await tablet.put("note", note("t-note", "kept"));
    await tablet.sync(fetcher);
    // Another device, already updated, adds a tag; the tablet, still on the old build, syncs past it.
    const updated = new Device({ name: `updated-${Math.random()}`, schemas: LATER, version: 2 });
    await updated.put("tag", { id: "t1", updatedAt: 1, deleted: false, label: "knee" });
    await updated.sync(fetchLater);
    await tablet.sync(fetcher);
    (tablet as unknown as { db: { close(): void } }).db.close();

    // The tablet gets the new build: same database, version 2.
    const upgraded = new Device({ name, schemas: LATER, version: 2 });
    await upgraded.sync(fetchLater);
    expect(await upgraded.table("tag").get("t1")).toMatchObject({ label: "knee" });
    expect(await upgraded.table("note").get("t-note")).toMatchObject({ text: "kept" });
    expect((await upgraded.syncState()).status).toBe("idle");
  });

  it("puts back what devices logged after a backup, once the server is restored from it", async () => {
    const db = await server.ready();
    const laptop = new Device({ name: `laptop-${Math.random()}`, schemas: SCHEMAS });
    await laptop.put("note", note("before", "in the backup"));
    await laptop.sync(fetcher);
    await db.query("drop table if exists backup_copy; create table backup_copy as select * from records");
    const before = await server.epoch();

    await laptop.put("note", note("after", "logged after the backup"));
    await laptop.sync(fetcher);
    await phone.put("note", note("phone-after", "also after"));
    await phone.sync(fetcher);

    // The restore, as deploy/backup/atlas-backup.sh does it: the backup's
    // records, the sequence moved ahead, and a new epoch.
    await db.query("delete from records; insert into records select * from backup_copy; drop table backup_copy");
    await db.query("select setval('records_seq', coalesce((select max(seq) from records), 0) + 1000000)");
    await db.query("update sync_epoch set value = gen_random_uuid()::text");
    expect(await server.epoch()).not.toBe(before);
    expect((await server.changesSince("0", 10_000)).changes.some((c) => c.record.id === "after")).toBe(false);

    await laptop.sync(fetcher);
    await phone.sync(fetcher);
    const ids = (await server.changesSince("0", 10_000)).changes.map((c) => c.record.id);
    expect(ids).toEqual(expect.arrayContaining(["before", "after", "phone-after", "n1"]));
    // Each device has what the other logged, and nothing is left to send.
    expect(await phone.table("note").get("after")).toMatchObject({ text: "logged after the backup" });
    await laptop.sync(fetcher);
    expect(await laptop.table("note").get("phone-after")).toMatchObject({ text: "also after" });
    expect(await laptop.pendingCount()).toBe(0);
    expect(await phone.pendingCount()).toBe(0);
  });

  it("serves the current records of some kinds, without deleted ones", async () => {
    const notes = await server.currentRecords(SCHEMAS, ["note"]);
    expect(notes.every((change) => change.kind === "note" && !change.record.deleted)).toBe(true);
    expect(notes.some((change) => change.record.id === "n2")).toBe(false);
  });
});
