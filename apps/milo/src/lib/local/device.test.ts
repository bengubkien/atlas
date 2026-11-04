import "fake-indexeddb/auto";

import { NextRequest } from "next/server";
import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";

import type { Workout, WorkoutSet } from "../model";

import { Device } from "./device";

// Two devices, a phone and a desktop, each with its own copy, syncing through
// the real sync endpoint and a real Postgres database.

const databaseUrl = inject("databaseUrl");

const workout: Workout = {
  id: "w-phone",
  updatedAt: 0,
  deleted: false,
  name: "Push day",
  routineId: null,
  startedAt: Date.now(),
  endedAt: null,
  notes: "",
};
const set = (id: string, reps: number): WorkoutSet => ({
  id,
  updatedAt: 0,
  deleted: false,
  workoutId: workout.id,
  exerciseId: "b-bench-press",
  position: 0,
  index: 0,
  weightKg: 80,
  reps,
  seconds: null,
  meters: null,
  warmup: false,
  done: true,
});

describe.skipIf(!databaseUrl)("syncing two devices", () => {
  let server: (url: string, init: RequestInit) => Promise<Response>;
  let closeDb: () => Promise<void>;
  const phone = new Device(`phone-${Math.random()}`);
  const desktop = new Device(`desktop-${Math.random()}`);
  const offline = async (): Promise<Response> => {
    throw new TypeError("Failed to fetch");
  };

  beforeAll(async () => {
    process.env.DATABASE_URL = databaseUrl!;
    const route = await import("@/app/api/sync/route");
    closeDb = (await import("@/server/db")).closeForTests;
    server = (url, init) => route.POST(new NextRequest(`http://milo.test${url}`, init as ConstructorParameters<typeof NextRequest>[1]));
  });
  afterAll(async () => {
    await closeDb();
  });

  it("keeps a workout logged offline on the phone, and sends it once the server is back", async () => {
    await phone.put("workout", workout);
    await phone.save([{ kind: "set", record: set("s1", 8) }, { kind: "set", record: set("s2", 7) }]);

    await phone.sync(offline);
    expect((await phone.syncState()).status).toBe("offline");
    expect(await phone.pendingCount()).toBe(3);

    await phone.sync(server);
    expect((await phone.syncState()).status).toBe("idle");
    expect(await phone.pendingCount()).toBe(0);

    await desktop.sync(server);
    expect((await desktop.db.workout.get("w-phone"))?.name).toBe("Push day");
    expect(await desktop.db.set.where("workoutId").equals("w-phone").count()).toBe(2);
  });

  it("lets the later change win when both devices edit the same set", async () => {
    const onDesktop = (await desktop.db.set.get("s1"))!;
    await desktop.put("set", { ...onDesktop, reps: 9 });
    await new Promise((resolve) => setTimeout(resolve, 5));
    const onPhone = (await phone.db.set.get("s1"))!;
    await phone.put("set", { ...onPhone, reps: 10 }); // later

    await desktop.sync(server);
    await phone.sync(server);
    await desktop.sync(server);
    expect((await phone.db.set.get("s1"))!.reps).toBe(10);
    expect((await desktop.db.set.get("s1"))!.reps).toBe(10);
    expect(await phone.pendingCount()).toBe(0);
    expect(await desktop.pendingCount()).toBe(0);
  });

  it("syncs a deletion", async () => {
    await phone.remove("set", ["s2"]);
    await phone.sync(server);
    await desktop.sync(server);
    expect((await desktop.db.set.get("s2"))!.deleted).toBe(true);
  });

  it("says when the server refuses, and keeps the change", async () => {
    const refusing = async () => Response.json({ error: "Change 0 isn't a valid record." }, { status: 400 });
    await phone.put("set", { ...set("s3", 5) });
    await phone.sync(refusing);
    expect(await phone.syncState()).toMatchObject({ status: "error", error: "Change 0 isn't a valid record." });
    expect(await phone.pendingCount()).toBe(1);
  });
});
