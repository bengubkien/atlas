import { describe, expect, it } from "vitest";

import { BUILT_IN_EXERCISES, mergeExercises } from "./library";
import { parseChange, type Exercise, type Workout, type WorkoutSet } from "./model";
import { ago, balanceNotes, exercisesFor, MAPPED, planFor, recentStep, restedLongest, setStep, standings } from "./muscles";

const exercises = new Map<string, Exercise>(BUILT_IN_EXERCISES.map((e) => [e.id, e]));
const at = (iso: string, time = "18:00") => new Date(`${iso}T${time}:00`).getTime();
// Wednesday 4 November 2026, in the evening.
const now = at("2026-11-04", "20:00");

const workout = (id: string, iso: string, fields: Partial<Workout> = {}): Workout => ({
  id,
  updatedAt: 1,
  deleted: false,
  name: "Workout",
  routineId: null,
  startedAt: at(iso),
  endedAt: at(iso) + 3_600_000,
  notes: "",
  ...fields,
});
let n = 0;
/** `count` sets that count of an exercise in a workout. */
const sets = (workoutId: string, exerciseId: string, count: number, fields: Partial<WorkoutSet> = {}): WorkoutSet[] =>
  Array.from({ length: count }, (_, index) => ({
    id: `s${n++}`,
    updatedAt: 1,
    deleted: false,
    workoutId,
    exerciseId,
    position: 0,
    index,
    weightKg: 60,
    reps: 8,
    seconds: null,
    meters: null,
    warmup: false,
    done: true,
    ...fields,
  }));

describe("each muscle's standing", () => {
  it("counts the sets of the last 7 days, and when each muscle last worked", () => {
    const workouts = [workout("today", "2026-11-04"), workout("mon", "2026-11-02"), workout("old", "2026-10-20")];
    const all = [
      ...sets("today", "b-bench-press", 4),
      ...sets("today", "b-bench-press", 1, { warmup: true }),
      ...sets("today", "b-bench-press", 1, { done: false }),
      ...sets("mon", "b-squat", 5),
      ...sets("mon", "b-kettlebell-swing", 3), // whole body: not a place on the figure
      ...sets("old", "b-pull-up", 6),
    ];
    const by = standings(workouts, all, exercises, now);
    expect([...by.keys()]).toEqual(MAPPED);
    expect(by.get("chest")).toEqual({ muscle: "chest", sets: 4, lastAt: at("2026-11-04"), days: 0 });
    expect(by.get("quads")).toMatchObject({ sets: 5, days: 2 });
    expect(by.get("back")).toMatchObject({ sets: 0, days: 15 });
    expect(by.get("calves")).toMatchObject({ sets: 0, lastAt: null, days: null });
  });

  it("counts 7 days by the calendar, as \"days ago\" does: a week ago is out", () => {
    const workouts = [workout("six", "2026-10-29", { startedAt: at("2026-10-29", "00:30") }), workout("seven", "2026-10-28", { startedAt: at("2026-10-28", "23:30") })];
    const by = standings(workouts, [...sets("six", "b-squat", 2), ...sets("seven", "b-pull-up", 2)], exercises, now);
    expect(by.get("quads")).toMatchObject({ sets: 2, days: 6 });
    expect(by.get("back")).toMatchObject({ sets: 0, days: 7 });
  });

  it("counts a workout going on, and leaves out deleted ones", () => {
    const workouts = [workout("live", "2026-11-04", { endedAt: null }), workout("gone", "2026-11-03", { deleted: true })];
    const by = standings(workouts, [...sets("live", "b-barbell-curl", 2), ...sets("gone", "b-dip", 3)], exercises, now);
    expect(by.get("biceps")).toMatchObject({ sets: 2, days: 0 });
    expect(by.get("triceps")).toMatchObject({ sets: 0, lastAt: null });
  });
});

describe("rested longest, for Today", () => {
  it("names the big muscles rested two days or more, longest first", () => {
    const workouts = [workout("a", "2026-11-04"), workout("b", "2026-11-01"), workout("c", "2026-10-25")];
    const done = [...sets("a", "b-bench-press", 3), ...sets("b", "b-squat", 3), ...sets("c", "b-pull-up", 3), ...sets("a", "b-overhead-press", 3), ...sets("b", "b-hip-thrust", 3), ...sets("a", "b-romanian-deadlift", 3)];
    const rested = restedLongest(standings(workouts, done, exercises, now));
    expect(rested.map((s) => [s.muscle, s.days])).toEqual([["back", 10], ["quads", 3], ["glutes", 3]]);
  });

  it("is empty before you've trained", () => {
    expect(restedLongest(standings([], [], exercises, now))).toEqual([]);
  });
});

describe("the shading steps", () => {
  it("bins sets and days as the legend says", () => {
    expect([0, 1, 4, 5, 9, 10, 14, 15, 40].map(setStep)).toEqual([0, 1, 1, 2, 2, 3, 3, 4, 4]);
    expect([0, 1, 2, 3, 4, 7, 8, 14, 15, null].map(recentStep)).toEqual([4, 4, 3, 3, 2, 2, 1, 1, 0, 0]);
    expect([null, 0, 1, 5].map(ago)).toEqual(["never", "today", "yesterday", "5 days ago"]);
  });
});

describe("a muscle's exercises", () => {
  it("puts the ones you've done first, newest first, with last time's sets; then the rest by name", () => {
    const own: Exercise = { id: "own-press", updatedAt: 1, deleted: false, name: "Machine chest press", muscle: "chest", equipment: "machine", tracking: "load", notes: "" };
    const all = mergeExercises([own]);
    const workouts = [workout("a", "2026-11-01"), workout("b", "2026-11-03")];
    const done = [...sets("a", "b-push-up", 3), ...sets("b", "b-bench-press", 5), ...sets("a", "b-bench-press", 2)];
    const uses = exercisesFor("chest", all, workouts, done);
    expect(uses.slice(0, 2).map((use) => [use.exercise.id, use.lastSets])).toEqual([["b-bench-press", 5], ["b-push-up", 3]]);
    expect(uses.slice(2).map((use) => use.exercise.name)).toEqual(["Cable fly", "Dumbbell bench press", "Incline bench press", "Incline dumbbell press", "Machine chest press"]);
    expect(planFor(uses)).toEqual([
      { exerciseId: "b-bench-press", sets: 5 },
      { exerciseId: "b-push-up", sets: 3 },
      { exerciseId: "b-cable-fly", sets: 3 },
    ]);
  });
});

describe("notes on balance", () => {
  it("says nothing while you're not training", () => {
    expect(balanceNotes([workout("old", "2026-09-01")], sets("old", "b-squat", 5), exercises, now)).toEqual([]);
  });

  it("names big muscles left out for two weeks, and too much pushing", () => {
    const workouts = [workout("a", "2026-11-03"), workout("b", "2026-10-28")];
    const done = [
      ...sets("a", "b-bench-press", 10),
      ...sets("b", "b-overhead-press", 6),
      ...sets("a", "b-dip", 4),
      ...sets("b", "b-pull-up", 4),
      ...sets("a", "b-squat", 2),
    ];
    expect(balanceNotes(workouts, done, exercises, now)).toEqual([
      "Not trained in two weeks: hamstrings and glutes.",
      "Pushing: 20 sets, pulling: 4, in four weeks. Rows or pull-ups would even it out.",
      "Legs: 2 sets in four weeks, against 24 for your upper body.",
    ]);
  });

  it("stays quiet when things are even", () => {
    const workouts = [workout("a", "2026-11-03")];
    const done = ["b-bench-press", "b-barbell-row", "b-pull-up", "b-overhead-press", "b-squat", "b-romanian-deadlift", "b-hip-thrust"].flatMap((id) => sets("a", id, 4));
    expect(balanceNotes(workouts, done, exercises, now)).toEqual([]);
  });
});

describe("the figure setting", () => {
  it("is male for settings saved before it existed, so old devices still sync", () => {
    const old = parseChange({ kind: "settings", record: { id: "settings", updatedAt: 1, deleted: false, unit: "kg", restSeconds: 90 } });
    expect(old?.record).toMatchObject({ body: "male" });
    const chosen = parseChange({ kind: "settings", record: { id: "settings", updatedAt: 2, deleted: false, unit: "kg", restSeconds: 90, body: "female" } });
    expect(chosen?.record).toMatchObject({ body: "female" });
  });
});
