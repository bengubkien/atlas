import { describe as group, expect, it } from "vitest";

import { dayStep, describe, places, recent } from "./body";
import { at } from "./health";
import { parseChange, type Symptom } from "./model";

const symptom = (area: string, date: string, time = "18:00", fields: Partial<Symptom> = {}): Symptom => ({
  id: `${area}-${date}-${time}`,
  updatedAt: 1,
  deleted: false,
  area,
  kind: "pain",
  severity: 4,
  at: at(date, time),
  note: "",
  ...fields,
});
const now = at("2026-11-05", "12:00");

group("the body map's numbers", () => {
  it("counts days, not entries, over the last 30, and keeps the latest and the worst", () => {
    const byArea = places(
      [
        symptom("knee-left", "2026-11-04", "09:00"),
        symptom("knee-left", "2026-11-04", "18:00", { severity: 7 }),
        symptom("knee-left", "2026-11-01"),
        symptom("knee-left", "2026-10-07"), // the 30th day back: still in
        symptom("knee-left", "2026-10-06", "18:00", { severity: 9 }), // the 31st: out
        symptom("lower-back", "2026-11-05", "08:00", { kind: "stiffness", severity: 2 }),
      ],
      now,
    );
    expect(byArea.get("knee-left")).toMatchObject({ days: 3, worst: 7 });
    expect(byArea.get("knee-left")!.last!.at).toBe(at("2026-11-04", "18:00"));
    expect(byArea.get("lower-back")).toMatchObject({ days: 1, worst: 2 });
    expect(byArea.get("head")).toMatchObject({ days: 0, last: null });
  });

  it("leaves out deleted ones, ones in the future, and places it doesn't know", () => {
    const byArea = places([symptom("knee-left", "2026-11-04", "18:00", { deleted: true }), symptom("knee-left", "2026-11-06"), symptom("tail-left", "2026-11-04")], now);
    expect(byArea.get("knee-left")).toMatchObject({ days: 0, last: null });
    expect(byArea.has("tail-left" as never)).toBe(false);
  });

  it("lists the places with something lately, most days first", () => {
    const byArea = places([symptom("knee-left", "2026-11-04"), symptom("knee-left", "2026-11-03"), symptom("neck", "2026-11-05", "09:00")], now);
    expect(recent(byArea).map((p) => p.area)).toEqual(["knee-left", "neck"]);
  });

  it("bins days as the legend says, and says what a symptom was", () => {
    expect([0, 1, 2, 3, 4, 7, 8, 30].map(dayStep)).toEqual([0, 1, 2, 2, 3, 3, 4, 4]);
    expect(describe({ kind: "stiffness", severity: 3 })).toBe("Stiffness, 3 of 10");
  });

  it("syncs symptoms, and settings saved before the body map existed", () => {
    expect(parseChange({ kind: "symptom", record: { id: "s", updatedAt: 1, area: "knee-left", at: now } })?.record).toMatchObject({ kind: "pain", severity: 3, note: "" });
    expect(parseChange({ kind: "symptom", record: { id: "s", updatedAt: 1, area: "knee-left", at: now, severity: 11 } })).toBeNull();
    expect(parseChange({ kind: "settings", record: { id: "settings", updatedAt: 1, weightUnit: "kg", glucoseUnit: "mg/dL" } })?.record).toMatchObject({ body: "male" });
  });
});
