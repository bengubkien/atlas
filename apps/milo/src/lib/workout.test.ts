import { describe, expect, it } from "vitest";

import { strengthForWeight, weightAt, weeklyWeights } from "./bodyweight";
import { fromLocal, localDate, localTime } from "./clock-time";
import type { Exercise, Workout, WorkoutSet } from "./model";
import { distanceNumber, toMeters } from "./units";
import { blocks, runs, supersetIds } from "./workout";

const set = (position: number, index: number, superset: string | null = null): WorkoutSet => ({
  id: `${position}-${index}`,
  updatedAt: 1,
  deleted: false,
  workoutId: "w",
  exerciseId: `e${position}`,
  position,
  index,
  weightKg: 50,
  reps: 10,
  seconds: null,
  meters: null,
  warmup: false,
  done: true,
  superset,
});

describe("supersets", () => {
  it("groups exercises next to each other with the same superset, and says which comes last", () => {
    const list = blocks([set(0, 0), set(1, 0, "a"), set(1, 1, "a"), set(2, 0, "a"), set(3, 0, "b"), set(5, 0, "a")]);
    expect(list.map((block) => block.superset)).toEqual([
      null,
      { id: "a", first: true, last: false },
      { id: "a", first: false, last: true },
      null, // "b" on its own isn't a superset
      null, // nor is "a" again, away from the others
    ]);
  });

  it("keeps a superset's exercises together, and every other exercise on its own", () => {
    const list = blocks([set(0, 0), set(1, 0, "a"), set(2, 0, "a"), set(3, 0)]);
    expect(runs(list).map((run) => run.map((block) => block.position))).toEqual([[0], [1, 2], [3]]);
  });

  it("turns a routine's 'with the next' into one superset per chain", () => {
    const ids = supersetIds([{ superset: true }, { superset: true }, { superset: false }, { superset: true }, {}]);
    expect(ids[0]).toBeTruthy();
    expect(ids[1]).toBe(ids[0]);
    expect(ids[2]).toBe(ids[0]);
    expect(ids[3]).toBeTruthy();
    expect(ids[3]).not.toBe(ids[0]);
    expect(ids[4]).toBe(ids[3]);
    expect(supersetIds([{ superset: true }])).toEqual([null]); // nothing after it to pair with
  });
});

describe("miles and start times", () => {
  it("shows metres in kilometres or miles and reads them back to the metre", () => {
    expect(distanceNumber(5000, "km")).toBe("5");
    expect(distanceNumber(5000, "mi")).toBe("3.11");
    expect(toMeters(3.11, "mi")).toBe(5005);
    expect(toMeters(26.2, "mi")).toBe(42165);
  });

  it("puts a workout's start in date and time fields and back, where you are", () => {
    const start = fromLocal("2026-11-04", "07:05")!;
    expect(localDate(start)).toBe("2026-11-04");
    expect(localTime(start)).toBe("07:05");
    expect(fromLocal("2026-11-04", "")).toBeNull();
  });
});

describe("body weight from Hygeia", () => {
  const day = (n: number) => Date.UTC(2026, 9, 1) + n * 86_400_000;
  const weights = [
    { at: day(0), kg: 80 },
    { at: day(20), kg: 78 },
  ];

  it("takes the nearest reading within a month either side, or none", () => {
    expect(weightAt(weights, day(4))).toBe(80);
    expect(weightAt(weights, day(15))).toBe(78);
    expect(weightAt(weights, day(60))).toBeNull();
    expect(weeklyWeights(weights, [day(0), day(7), day(14)])).toEqual([80, null, 78]);
  });

  it("says how much each lift is for your weight at the time, heaviest first", () => {
    const bench: Exercise = { id: "bench", updatedAt: 1, deleted: false, name: "Bench press", muscle: "chest", equipment: "barbell", tracking: "load", notes: "" };
    const plank: Exercise = { ...bench, id: "plank", name: "Plank", tracking: "duration" };
    const squat: Exercise = { ...bench, id: "squat", name: "Squat", muscle: "quads" };
    const workout: Workout = { id: "w", updatedAt: 1, deleted: false, name: "A", routineId: null, startedAt: day(2), endedAt: day(2) + 3_600_000, notes: "" };
    const lift = (exerciseId: string, weightKg: number, reps: number): WorkoutSet => ({ ...set(0, 0), id: `${exerciseId}-${weightKg}`, exerciseId, weightKg, reps, seconds: null });
    const list = strengthForWeight(
      new Map([bench, plank, squat].map((e) => [e.id, e])),
      [workout],
      [lift("bench", 100, 1), lift("bench", 80, 5), lift("squat", 120, 3), { ...lift("plank", 0, 0), seconds: 60 }],
      weights,
    );
    expect(list.map((each) => [each.exercise.id, Math.round(each.ratio * 100) / 100])).toEqual([
      ["squat", 1.65], // 120 × (1 + 3/30) = 132, over 80 kg
      ["bench", 1.25],
    ]);
  });
});
