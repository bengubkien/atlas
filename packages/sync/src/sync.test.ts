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

  it("says when the server refuses a record, and keeps it", async () => {
    const response = await fetcher("/api/sync", { method: "POST", body: JSON.stringify({ changes: [{ kind: "note", record: { id: "x" } }] }) });
    expect(response.status).toBe(400);
    const refusing = async () => Response.json({ error: "Change 0 isn't a valid record." }, { status: 400 });
    await phone.put("note", note("n3", "third"));
    await phone.sync(refusing);
    expect(await phone.syncState()).toMatchObject({ status: "error", error: "Change 0 isn't a valid record." });
    expect(await phone.pendingCount()).toBe(1);
  });

  it("serves the current records of some kinds, without deleted ones", async () => {
    const notes = await server.currentRecords(SCHEMAS, ["note"]);
    expect(notes.every((change) => change.kind === "note" && !change.record.deleted)).toBe(true);
    expect(notes.some((change) => change.record.id === "n2")).toBe(false);
  });
});
