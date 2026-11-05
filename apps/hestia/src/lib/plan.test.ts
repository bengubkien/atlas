import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { ITEM_TYPE, ITEM_TYPES, planBounds, planSchema, roomAreas, roomOf, type Room } from "./plan";
import { readPlan, savePlan } from "./plan-store";

const room = (id: string, name: string, x: number, y: number, w: number, d: number): Room => ({ id, name, x, y, w, d });

describe("the floor plan", () => {
  const rooms = [room("k", "Kitchen", 0, 0, 3, 4), room("l1", "Living room", 3, 0, 5, 4), room("l2", "Living room", 3, 4, 2, 2)];

  it("knows which room a thing is in", () => {
    expect(roomOf({ x: 1, y: 1 }, rooms)?.name).toBe("Kitchen");
    expect(roomOf({ x: 4, y: 5 }, rooms)?.name).toBe("Living room");
    expect(roomOf({ x: 9, y: 9 }, rooms)).toBeNull();
  });

  it("works out a room's floor and walls, an L-shaped one included", () => {
    expect(roomAreas("Kitchen", rooms, 2.5)).toEqual({ floor: 12, walls: 35 }); // 14 m around × 2.5
    // 5×4 and 2×2 under its left end: 24 m² of floor; its outline is 22 m.
    expect(roomAreas("living room", rooms, 2.5)).toEqual({ floor: 24, walls: 55 });
  });

  it("frames the plan, and checks what it's given", () => {
    expect(planBounds({ version: 1, height: 2.5, rooms, items: [] })).toEqual({ cx: 4, cy: 3, size: 8 });
    expect(planSchema.safeParse({ rooms: [{ id: "a", name: "", x: 0, y: 0, w: 3, d: 3 }] }).success).toBe(false);
    expect(planSchema.parse({ items: [{ id: "f", type: "fridge", x: 1, y: 1 }] }).items[0]).toMatchObject({ name: "", rotation: 0, applianceId: null });
    expect(ITEM_TYPES.every((type) => ITEM_TYPE[type].suggestions.every((s) => s.months > 0))).toBe(true);
  });

  it("is saved beside micasa's database and read back; before that, it's empty", async () => {
    process.env.HESTIA_PLAN_PATH = path.join(mkdtempSync(path.join(tmpdir(), "hestia-plan-")), "plan.json");
    try {
      expect(await readPlan()).toEqual({ version: 1, height: 2.5, rooms: [], items: [] });
      await savePlan({ version: 1, height: 2.6, rooms, items: [{ id: "f", type: "fridge", name: "", x: 1, y: 0.4, rotation: 0, applianceId: null, maintenanceIds: [] }] });
      expect((await readPlan()).items[0]?.type).toBe("fridge");
    } finally {
      delete process.env.HESTIA_PLAN_PATH;
    }
  });
});
