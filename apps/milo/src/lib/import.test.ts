import { describe, expect, it } from "vitest";

import { guessMuscle, importChanges, parseCsv, parseDuration, parseWhen, planImport, type ImportPlan } from "./import";
import { BUILT_IN_EXERCISES } from "./library";

// Files written as Strong and Hevy write their exports (see import.ts for the columns).

const STRONG = `Date,Workout Name,Duration,Exercise Name,Set Order,Weight,Reps,Distance,Seconds,Notes,Workout Notes,RPE
2026-10-20 07:30:00,"Push, heavy",1h 5m,Bench Press (Barbell),W,95,10,0,0,,"Felt good",
2026-10-20 07:30:00,"Push, heavy",1h 5m,Bench Press (Barbell),1,185,5,0,0,,"Felt good",8
2026-10-20 07:30:00,"Push, heavy",1h 5m,Bench Press (Barbell),2,185,5,0,0,,"Felt good",
2026-10-20 07:30:00,"Push, heavy",1h 5m,Bench Press (Barbell),Rest Timer,0,0,0,90,,"Felt good",
2026-10-20 07:30:00,"Push, heavy",1h 5m,Bench Press (Dumbbell),1,60,10,0,0,,"Felt good",
2026-10-20 07:30:00,"Push, heavy",1h 5m,Bicep Curl (Barbell),1,65,12,0,0,,"Felt good",
2026-10-22 18:00:00,Run,25m,Running,1,0,0,3.1,1500,,,
2026-10-22 18:00:00,Run,25m,Pull Up,1,0,8,0,0,,,
`;

const HEVY = `"title","start_time","end_time","description","exercise_title","superset_id","exercise_notes","set_index","set_type","weight_lbs","reps","distance_miles","duration_seconds","rpe"
"Legs","26 Oct 2026, 17:45","26 Oct 2026, 18:50","","Squat (Barbell)","","","0","warmup","135","5","","",""
"Legs","26 Oct 2026, 17:45","26 Oct 2026, 18:50","","Squat (Barbell)","","","1","normal","225","5","","","8"
"Legs","26 Oct 2026, 17:45","26 Oct 2026, 18:50","","Leg Extension (Machine)","0","","0","normal","100","12","","",""
"Legs","26 Oct 2026, 17:45","26 Oct 2026, 18:50","","Seated Leg Curl (Machine)","0","","0","normal","90","12","","",""
"Legs","26 Oct 2026, 17:45","26 Oct 2026, 18:50","","Plank","","","0","normal","","","","60",""
`;

const units = { weight: "lb", distance: "mi" } as const;
const plan = (text: string, u: { weight: "kg" | "lb"; distance: "km" | "mi" } = units) => planImport(text, BUILT_IN_EXERCISES, u) as ImportPlan;

describe("reading exports", () => {
  it("reads quoted CSV, with commas or semicolons", () => {
    expect(parseCsv('a,"b, c","say ""hi"""\r\n1,2,3\n')).toEqual([
      ["a", "b, c", 'say "hi"'],
      ["1", "2", "3"],
    ]);
    expect(parseCsv("a;b\n1,5;2\n")).toEqual([
      ["a", "b"],
      ["1,5", "2"],
    ]);
  });

  it("reads Strong's and Hevy's dates and Strong's durations", () => {
    expect(new Date(parseWhen("2026-10-20 07:30:00")!).getHours()).toBe(7);
    const hevy = new Date(parseWhen("26 Oct 2026, 17:45")!);
    expect([hevy.getFullYear(), hevy.getMonth(), hevy.getDate(), hevy.getHours(), hevy.getMinutes()]).toEqual([2026, 9, 26, 17, 45]);
    expect(parseWhen("yesterday")).toBeNull();
    expect([parseDuration("1h 5m"), parseDuration("25m"), parseDuration("50s"), parseDuration("")]).toEqual([3900, 1500, 50, null]);
  });

  it("imports Strong's workouts: warm-ups, units, exercises matched or added, rest timers left out", () => {
    const strong = plan(STRONG);
    expect(strong).toMatchObject({ source: "Strong", unitsAsked: true, skipped: 1, matched: 4 });
    expect(strong.workouts.map(({ workout }) => [workout.name, workout.notes, (workout.endedAt! - workout.startedAt) / 60_000])).toEqual([
      ["Push, heavy", "Felt good", 65],
      ["Run", "", 25],
    ]);
    const push = strong.workouts[0]!.sets;
    expect(push.map((set) => [set.exerciseId, set.position, set.index, set.warmup])).toEqual([
      ["b-bench-press", 0, 0, true],
      ["b-bench-press", 0, 1, false],
      ["b-bench-press", 0, 2, false],
      ["b-dumbbell-bench-press", 1, 0, false],
      [strong.newExercises[0]!.id, 2, 0, false],
    ]);
    expect(push[1]!.weightKg).toBeCloseTo(83.915, 2); // 185 lb
    expect(strong.newExercises.map((e) => [e.name, e.muscle, e.equipment, e.tracking])).toEqual([["Bicep Curl (Barbell)", "biceps", "barbell", "load"]]);
    const run = strong.workouts[1]!.sets;
    expect(run.map((set) => [set.exerciseId, set.meters, set.seconds, set.reps])).toEqual([
      ["b-running", 4989, 1500, null], // 3.1 miles
      ["b-pull-up", null, null, 8],
    ]);
  });

  it("imports Hevy's, with its units from its columns and its supersets", () => {
    const hevy = plan(HEVY, { weight: "kg", distance: "km" });
    expect(hevy).toMatchObject({ source: "Hevy", unitsAsked: false, skipped: 0 });
    const sets = hevy.workouts[0]!.sets;
    expect(sets.map((set) => set.exerciseId.startsWith("imp-ex-") ? "new" : set.exerciseId)).toEqual(["b-squat", "b-squat", "b-leg-extension", "new", "b-plank"]);
    expect(sets[1]!.weightKg).toBeCloseTo(102.06, 1); // 225 lb, as the column says
    expect(sets[0]!.warmup).toBe(true);
    expect(sets[2]!.superset).toBe(sets[3]!.superset);
    expect(sets[2]!.superset).not.toBeNull();
    expect(sets[4]).toMatchObject({ seconds: 60, superset: null });
    expect(hevy.newExercises[0]).toMatchObject({ name: "Seated Leg Curl (Machine)", muscle: "hamstrings", equipment: "machine" });
  });

  it("adds nothing the second time, and says what it can't read", () => {
    const first = plan(STRONG);
    const saved = new Set(importChanges(first, new Set()).map((change) => change.record.id));
    expect(importChanges(plan(STRONG), saved)).toEqual([]);
    expect(planImport("name,weight\nBench,100\n", BUILT_IN_EXERCISES, units)).toEqual({ error: "That isn't an export Milo knows: it reads Strong's and Hevy's CSV files." });
    expect(planImport("", BUILT_IN_EXERCISES, units)).toHaveProperty("error");
  });

  it("guesses what a new exercise works from its name", () => {
    expect(["Chest Press (Machine)", "Hack Squat", "Cable Crunch", "Arnold Press", "T Bar Row", "Burpee"].map(guessMuscle)).toEqual(["chest", "quads", "core", "shoulders", "back", "full_body"]);
  });
});
