import { describe, expect, it } from "vitest";

import { BUILT_IN_EXERCISES, mergeExercises } from "./library";
import { parseChange, type Exercise, type Workout, type WorkoutSet } from "./model";
import {
  bestSet,
  estimatedMax,
  exerciseHistory,
  lastTime,
  personalRecords,
  setsByMuscle,
  startOfWeek,
  volumeKg,
  weeklyTotals,
} from "./stats";
import { clock, parseClock, parseNumber, toKg, weightNumber } from "./units";

const bench = BUILT_IN_EXERCISES.find((e) => e.id === "b-bench-press")!;
const pullUp = BUILT_IN_EXERCISES.find((e) => e.id === "b-pull-up")!;
const exercises = new Map<string, Exercise>([bench, pullUp].map((e) => [e.id, e]));

const day = (iso: string) => new Date(`${iso}T18:00:00`).getTime();
const workout = (id: string, iso: string, ended = true): Workout => ({
  id,
  updatedAt: 1,
  deleted: false,
  name: "Push",
  routineId: null,
  startedAt: day(iso),
  endedAt: ended ? day(iso) + 3_600_000 : null,
  notes: "",
});
let n = 0;
const set = (workoutId: string, exerciseId: string, weightKg: number | null, reps: number, extra: Partial<WorkoutSet> = {}): WorkoutSet => ({
  id: `s${n++}`,
  updatedAt: 1,
  deleted: false,
  workoutId,
  exerciseId,
  position: 0,
  index: n,
  weightKg,
  reps,
  seconds: null,
  meters: null,
  warmup: false,
  done: true,
  ...extra,
});

describe("numbers", () => {
  it("estimates a one-rep max with Epley's formula, within a sensible range of reps", () => {
    expect(estimatedMax(100, 1)).toBe(100);
    expect(estimatedMax(100, 5)).toBeCloseTo(116.67, 2);
    expect(estimatedMax(100, 13)).toBeNull();
    expect(estimatedMax(null, 5)).toBeNull();
  });

  it("counts volume from ticked, non-warm-up sets only", () => {
    const sets = [set("w", "b", 100, 5), set("w", "b", 60, 10, { warmup: true }), set("w", "b", 100, 5, { done: false }), set("w", "b", 100, 5, { deleted: true })];
    expect(volumeKg(sets)).toBe(500);
  });

  it("picks the best set by estimated max, or by reps for bodyweight", () => {
    expect(bestSet([set("w", "b", 100, 5), set("w", "b", 110, 1), set("w", "b", 90, 10)], "load")!.weightKg).toBe(90);
    expect(bestSet([set("w", "p", 0, 8), set("w", "p", 0, 12)], "bodyweight")!.reps).toBe(12);
  });

  it("converts pounds and reads numbers typed with a comma", () => {
    expect(weightNumber(toKg(135, "lb"), "lb")).toBe("135");
    expect(weightNumber(61.235, "kg")).toBe("61.24");
    expect(parseNumber("62,5")).toBe(62.5);
    expect(parseNumber("")).toBeNull();
    expect(parseNumber("6x")).toBeNaN();
    expect(clock(65)).toBe("1:05");
    expect(clock(3723)).toBe("1:02:03");
    expect(parseClock("1:30")).toBe(90);
    expect(parseClock("abc")).toBeNaN();
  });
});

describe("history", () => {
  const workouts = [workout("w1", "2026-10-05"), workout("w2", "2026-10-12"), workout("w3", "2026-10-19"), workout("live", "2026-10-26", false)];
  const sets = [
    set("w1", bench.id, 80, 5),
    set("w1", bench.id, 80, 5),
    set("w2", bench.id, 85, 5),
    set("w2", pullUp.id, 0, 8),
    set("w3", bench.id, 82.5, 5),
    set("w3", pullUp.id, 0, 10),
    set("live", bench.id, 90, 5),
  ];

  it("finds what you did last time, ignoring the workout going on", () => {
    const last = lastTime(bench.id, workouts, sets);
    expect(last.map((s) => s.weightKg)).toEqual([82.5]);
    expect(lastTime(bench.id, workouts, sets, day("2026-10-19")).map((s) => s.weightKg)).toEqual([85]);
  });

  it("lists an exercise's finished sessions, newest first", () => {
    const sessions = exerciseHistory(bench, workouts, sets);
    expect(sessions.map((s) => s.workout.id)).toEqual(["w3", "w2", "w1"]);
    expect(sessions[2]!.sets).toHaveLength(2);
  });

  it("marks the sets that beat everything before, not the first time", () => {
    const records = personalRecords(exercises, workouts, sets);
    expect(records.map((r) => [r.workout.id, r.exercise.id])).toEqual([
      ["w2", bench.id],
      ["w3", pullUp.id],
    ]);
  });

  it("totals weeks from Monday, oldest first, finished workouts only", () => {
    const weeks = weeklyTotals(workouts, sets, 4, day("2026-10-28"));
    expect(weeks).toHaveLength(4);
    expect(new Date(weeks[0]!.start).getDay()).toBe(1);
    expect(weeks.map((w) => w.workouts)).toEqual([1, 1, 1, 0]);
    expect(weeks[2]!.volumeKg).toBe(82.5 * 5);
    expect(startOfWeek(day("2026-11-01"))).toBe(new Date(2026, 9, 26).getTime());
  });

  it("counts sets per muscle in a range", () => {
    const muscles = setsByMuscle(workouts, sets, exercises, day("2026-10-12") - 1, day("2026-10-20"));
    expect(muscles.get("chest")).toBe(2);
    expect(muscles.get("back")).toBe(2);
  });
});

describe("records on the wire", () => {
  it("accepts a valid record and fills its defaults", () => {
    const change = parseChange({ kind: "set", record: { id: "a", updatedAt: 5, workoutId: "w", exerciseId: "e", position: 0, index: 0, reps: 5 } });
    expect(change?.record).toMatchObject({ deleted: false, done: false, weightKg: null, reps: 5 });
  });

  it("refuses a record that isn't its kind", () => {
    expect(parseChange({ kind: "set", record: { id: "a", updatedAt: 5 } })).toBeNull();
    expect(parseChange({ kind: "nope", record: {} })).toBeNull();
  });

  it("merges your exercises over the built-ins, hiding deleted ones", () => {
    const edited = { ...bench, name: "Flat bench", updatedAt: 9 };
    const mine = { ...pullUp, id: "mine", name: "Weighted pull-up" };
    const merged = mergeExercises([edited, mine, { ...pullUp, deleted: true, updatedAt: 9 }]);
    expect(merged.find((e) => e.id === bench.id)!.name).toBe("Flat bench");
    expect(merged.some((e) => e.id === "mine")).toBe(true);
    expect(merged.some((e) => e.id === pullUp.id)).toBe(false);
    expect(new Set(BUILT_IN_EXERCISES.map((e) => e.id)).size).toBe(BUILT_IN_EXERCISES.length);
  });
});
