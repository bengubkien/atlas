import { z } from "zod";

// The floor plan of your home, drawn in Hestia: rooms as rectangles, and the
// things in them that need looking after (the fridge, the boiler, the water
// shut-off), each one linked to its appliance in micasa if it is one.
// Metres, seen from above: x to the right, y down the page (into the screen
// in 3D). An L-shaped room is two rectangles with the same name.

export const ITEM_TYPES = [
  "fridge",
  "freezer",
  "oven",
  "dishwasher",
  "washer",
  "dryer",
  "water-heater",
  "boiler",
  "air-conditioner",
  "radiator",
  "smoke-alarm",
  "water-shutoff",
  "breaker-panel",
  "sink",
  "toilet",
  "shower",
  "bath",
  "window",
  "other",
] as const;
export type ItemType = (typeof ITEM_TYPES)[number];

export type Suggestion = { name: string; months: number; category: string };

type TypeInfo = {
  label: string;
  /** Width, depth and height in metres, facing the way it's turned (0°: its front to the bottom of the plan). */
  size: [number, number, number];
  /** How high it hangs, for those on a wall or the ceiling. */
  lift?: number;
  /** An appliance in micasa's sense, with a brand, a warranty and a manual. */
  appliance: boolean;
  /** Upkeep it usually needs, as maintenance items to add in one tap (micasa's categories). */
  suggestions: Suggestion[];
};

export const ITEM_TYPE: Record<ItemType, TypeInfo> = {
  fridge: { label: "Fridge", size: [0.6, 0.65, 1.8], appliance: true, suggestions: [{ name: "Clean the fridge", months: 3, category: "Appliance" }, { name: "Vacuum the fridge's coils", months: 12, category: "Appliance" }] },
  freezer: { label: "Freezer", size: [0.6, 0.65, 0.85], appliance: true, suggestions: [{ name: "Defrost the freezer", months: 6, category: "Appliance" }] },
  oven: { label: "Oven or cooker", size: [0.6, 0.6, 0.9], appliance: true, suggestions: [{ name: "Clean the oven", months: 3, category: "Appliance" }, { name: "Clean the cooker hood filter", months: 3, category: "Appliance" }] },
  dishwasher: { label: "Dishwasher", size: [0.6, 0.6, 0.85], appliance: true, suggestions: [{ name: "Clean the dishwasher filter", months: 1, category: "Appliance" }] },
  washer: { label: "Washing machine", size: [0.6, 0.6, 0.85], appliance: true, suggestions: [{ name: "Clean the washing machine's filter and drum", months: 1, category: "Appliance" }] },
  dryer: { label: "Dryer", size: [0.6, 0.6, 0.85], appliance: true, suggestions: [{ name: "Clean the dryer's lint filter and vent", months: 3, category: "Appliance" }] },
  "water-heater": { label: "Water heater", size: [0.5, 0.5, 1.2], appliance: true, suggestions: [{ name: "Flush the water heater", months: 12, category: "Plumbing" }] },
  boiler: { label: "Boiler", size: [0.45, 0.35, 0.75], lift: 1.1, appliance: true, suggestions: [{ name: "Boiler service", months: 12, category: "HVAC" }] },
  "air-conditioner": { label: "Air conditioner", size: [0.8, 0.25, 0.3], lift: 2.0, appliance: true, suggestions: [{ name: "Clean the air conditioner's filters", months: 3, category: "HVAC" }] },
  radiator: { label: "Radiator", size: [1.0, 0.1, 0.6], lift: 0.1, appliance: false, suggestions: [{ name: "Bleed the radiators", months: 12, category: "HVAC" }] },
  "smoke-alarm": { label: "Smoke alarm", size: [0.15, 0.15, 0.05], lift: 2.4, appliance: true, suggestions: [{ name: "Test the smoke alarm", months: 1, category: "Safety" }, { name: "Change the smoke alarm's battery", months: 12, category: "Safety" }] },
  "water-shutoff": { label: "Water shut-off", size: [0.15, 0.1, 0.15], lift: 0.3, appliance: false, suggestions: [{ name: "Turn the water shut-off valve, so it doesn't seize", months: 12, category: "Plumbing" }] },
  "breaker-panel": { label: "Breaker panel", size: [0.4, 0.1, 0.5], lift: 1.4, appliance: false, suggestions: [{ name: "Test the trip switch (RCD)", months: 6, category: "Electrical" }] },
  sink: { label: "Sink", size: [0.6, 0.5, 0.85], appliance: false, suggestions: [{ name: "Clean the sink trap", months: 6, category: "Plumbing" }] },
  toilet: { label: "Toilet", size: [0.4, 0.65, 0.8], appliance: false, suggestions: [{ name: "Check the toilet for leaks", months: 12, category: "Plumbing" }] },
  shower: { label: "Shower", size: [0.9, 0.9, 0.1], appliance: false, suggestions: [{ name: "Clean the shower drain", months: 3, category: "Plumbing" }, { name: "Reseal the shower", months: 24, category: "Plumbing" }] },
  bath: { label: "Bath", size: [0.7, 1.7, 0.55], appliance: false, suggestions: [{ name: "Reseal the bath", months: 24, category: "Plumbing" }] },
  window: { label: "Window", size: [1.0, 0.1, 1.2], lift: 0.9, appliance: false, suggestions: [{ name: "Clean the windows", months: 3, category: "Interior" }] },
  other: { label: "Something else", size: [0.5, 0.5, 0.5], appliance: false, suggestions: [] },
};

const id = z.string().min(1).max(40);
const metres = z.number().min(-200).max(200);

export const roomSchema = z.object({
  id,
  name: z.string().trim().min(1).max(40),
  x: metres,
  y: metres,
  /** Width (along x) and depth (along y), in metres. */
  w: z.number().min(0.5).max(60),
  d: z.number().min(0.5).max(60),
});

export const itemSchema = z.object({
  id,
  type: z.enum(ITEM_TYPES),
  /** Your name for it, if not its type's: "Kitchen sink". */
  name: z.string().trim().max(60).default(""),
  x: metres,
  y: metres,
  rotation: z.union([z.literal(0), z.literal(90), z.literal(180), z.literal(270)]).default(0),
  /** Its appliance in micasa, if it's linked to one. */
  applianceId: z.string().max(40).nullable().default(null),
  /** Maintenance items added for it from the plan, for things that aren't appliances (a sink, the water shut-off). */
  maintenanceIds: z.array(z.string().max(40)).max(30).default([]),
});

export const planSchema = z.object({
  version: z.literal(1).default(1),
  /** How tall the rooms are, for wall areas (and the 3D view). */
  height: z.number().min(2).max(6).default(2.5),
  rooms: z.array(roomSchema).max(80).default([]),
  items: z.array(itemSchema).max(400).default([]),
});

export type Room = z.infer<typeof roomSchema>;
export type Item = z.infer<typeof itemSchema>;
export type Plan = z.infer<typeof planSchema>;

export const EMPTY_PLAN: Plan = { version: 1, height: 2.5, rooms: [], items: [] };

/** What to call a thing: your name for it, or its type's. */
export const itemName = (item: Pick<Item, "type" | "name">) => item.name || ITEM_TYPE[item.type].label;

/** The room a thing stands in, if it's in one (the first, where rooms overlap). */
export function roomOf(item: Pick<Item, "x" | "y">, rooms: Room[]): Room | null {
  return rooms.find((room) => item.x >= room.x && item.x <= room.x + room.w && item.y >= room.y && item.y <= room.y + room.d) ?? null;
}

/**
 * A room's areas, for paint and flooring quotes: the floor, and the walls
 * at the plan's height (doors and windows not taken off). The rectangles
 * that share a name make up one room.
 */
export function roomAreas(name: string, rooms: Room[], height: number): { floor: number; walls: number } {
  const parts = rooms.filter((room) => room.name.trim().toLowerCase() === name.trim().toLowerCase());
  const floor = parts.reduce((sum, room) => sum + room.w * room.d, 0);
  // Walls: the outline of the parts, so a shared edge between two parts isn't counted.
  let edges = 0;
  for (const room of parts) {
    const sides: [number, number, number, number][] = [
      [room.x, room.y, room.x + room.w, room.y],
      [room.x, room.y + room.d, room.x + room.w, room.y + room.d],
      [room.x, room.y, room.x, room.y + room.d],
      [room.x + room.w, room.y, room.x + room.w, room.y + room.d],
    ];
    for (const [x1, y1, x2, y2] of sides) {
      let length = Math.hypot(x2 - x1, y2 - y1);
      for (const other of parts) {
        if (other === room) continue;
        length -= sharedLength([x1, y1, x2, y2], other);
      }
      edges += Math.max(0, length);
    }
  }
  return { floor: round(floor), walls: round(edges * height) };
}

/** How much of a horizontal or vertical side lies along an edge of another rectangle. */
function sharedLength([x1, y1, x2, y2]: [number, number, number, number], room: Room): number {
  const near = (a: number, b: number) => Math.abs(a - b) < 0.01;
  if (near(y1, y2) && (near(y1, room.y) || near(y1, room.y + room.d))) {
    return Math.max(0, Math.min(Math.max(x1, x2), room.x + room.w) - Math.max(Math.min(x1, x2), room.x));
  }
  if (near(x1, x2) && (near(x1, room.x) || near(x1, room.x + room.w))) {
    return Math.max(0, Math.min(Math.max(y1, y2), room.y + room.d) - Math.max(Math.min(y1, y2), room.y));
  }
  return 0;
}

const round = (value: number) => Math.round(value * 10) / 10;

/** The plan's extent, for framing it: its middle and its largest side. */
export function planBounds(plan: Plan): { cx: number; cy: number; size: number } {
  const xs = [...plan.rooms.flatMap((room) => [room.x, room.x + room.w]), ...plan.items.map((item) => item.x)];
  const ys = [...plan.rooms.flatMap((room) => [room.y, room.y + room.d]), ...plan.items.map((item) => item.y)];
  if (xs.length === 0) return { cx: 0, cy: 0, size: 8 };
  const [minX, maxX, minY, maxY] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  return { cx: (minX + maxX) / 2, cy: (minY + maxY) / 2, size: Math.max(4, maxX - minX, maxY - minY) };
}

/** Snaps a length to the plan's 10 cm grid. */
export const snap = (value: number) => Math.round(value * 10) / 10;
