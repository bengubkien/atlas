import { describe, expect, it } from "vitest";

import type { Workout, WorkoutSet } from "./model";
import { miloToday } from "./today";

const at = (date: string, time: string) => new Date(`${date}T${time}:00`).getTime();
const workout = (fields: Partial<Workout>): Workout => ({
  id: "w1",
  updatedAt: 1,
  deleted: false,
  name: "Push",
  routineId: null,
  startedAt: at("2026-11-04", "07:00"),
  endedAt: at("2026-11-04", "07:52"),
  notes: "",
  ...fields,
});
const set = (workoutId: string, index: number, fields: Partial<WorkoutSet> = {}): WorkoutSet => ({
  id: `${workoutId}-s${index}`,
  updatedAt: 1,
  deleted: false,
  workoutId,
  exerciseId: "b-bench-press",
  position: 0,
  index,
  weightKg: 60,
  reps: 8,
  seconds: null,
  meters: null,
  warmup: false,
  done: true,
  ...fields,
});

// Wednesday 4 November 2026; the week started on Monday the 2nd.
const evening = at("2026-11-04", "19:00");

describe("Milo's answer to Atlas's Today", () => {
  it("shows a workout going on, and today's finished ones", () => {
    const report = miloToday(
      [workout({}), workout({ id: "w2", name: "Pull", startedAt: at("2026-11-04", "18:30"), endedAt: null })],
      [set("w1", 0), set("w1", 1), set("w1", 2, { warmup: true }), set("w1", 3, { done: false })],
      "en-US",
      evening,
    );
    expect(report.items).toEqual([
      { title: "Pull", detail: "Going on now, since 6:30 PM", href: "/workout", tone: "soon" },
      { title: "Push", detail: "52 min, 2 sets", href: "/history?w=w1", tone: "done" },
    ]);
    expect(report.summary).toBe("1 workout and 2 sets this week.");
  });

  it("otherwise says when the last workout was", () => {
    const report = miloToday([workout({ startedAt: at("2026-10-29", "07:00"), endedAt: at("2026-10-29", "08:00") })], [], "en-US", evening);
    expect(report.items).toEqual([{ title: "Push", detail: "Last workout, 6 days ago", href: "/history?w=w1" }]);
    expect(report.summary).toBe("No workout yet this week.");
  });

  it("says nothing more with no workouts, or only deleted ones", () => {
    expect(miloToday([workout({ deleted: true })], [], "en-US", evening)).toEqual({ summary: "No workout yet this week.", items: [], more: 0 });
  });
});
