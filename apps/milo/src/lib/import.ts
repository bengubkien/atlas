import type { Change, Distance, Equipment, Exercise, Muscle, Tracking, Unit, Workout, WorkoutSet } from "./model";
import { toKg, toMeters } from "./units";

// Importing workouts from another app's CSV export: Strong's and Hevy's,
// the two most used. One row per set; the rows of a workout share its start
// time and name. Exercises are matched to Milo's by name, or added.
//
// The columns, as their exports write them:
// - Strong: Date, Workout Name, Duration, Exercise Name, Set Order, Weight,
//   Reps, Distance, Seconds, Notes, Workout Notes, RPE. The units are the ones
//   set in Strong, which the file doesn't say, so you pick them.
// - Hevy: title, start_time, end_time, description, exercise_title,
//   superset_id, exercise_notes, set_index, set_type, weight_kg (or
//   weight_lbs), reps, distance_km (or distance_miles), duration_seconds, rpe.
//
// IDs are made from what's imported, so importing the same file twice adds
// nothing new: workouts already here are left as they are.

export type Source = "Strong" | "Hevy";

export type ImportPlan = {
  source: Source;
  workouts: { workout: Workout; sets: WorkoutSet[] }[];
  /** Exercises the file has that Milo doesn't, added as your own. */
  newExercises: Exercise[];
  /** How many of the file's exercises are ones Milo has. */
  matched: number;
  /** Rows left out: rest timers, and sets with nothing in them. */
  skipped: number;
  /** The file doesn't say its units (Strong): they're the ones passed in. */
  unitsAsked: boolean;
};

/** Rows of a CSV file, quotes and all; the delimiter is a comma or a semicolon, whichever the header uses. */
export function parseCsv(text: string): string[][] {
  const body = text.replace(/^﻿/, "");
  const firstLine = body.slice(0, body.indexOf("\n") === -1 ? undefined : body.indexOf("\n"));
  const delimiter = (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ";" : ",";
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < body.length; i++) {
    const c = body[i]!;
    if (quoted) {
      if (c === '"' && body[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === delimiter) {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && body[i + 1] === "\n") i++;
      row.push(field);
      if (row.some((each) => each.trim() !== "")) rows.push(row);
      row = [];
      field = "";
    } else field += c;
  }
  row.push(field);
  if (row.some((each) => each.trim() !== "")) rows.push(row);
  return rows;
}

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

/** A moment from "2024-10-26 17:45:00" (Strong) or "26 Oct 2024, 17:45" (Hevy), in local time; null if neither. */
export function parseWhen(text: string): number | null {
  const value = text.trim();
  let match = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?/.exec(value);
  if (match) {
    const [, y, m, d, h = "0", mi = "0", s = "0"] = match;
    return new Date(Number(y), Number(m) - 1, Number(d), Number(h), Number(mi), Number(s)).getTime();
  }
  match = /^(\d{1,2}) ([A-Za-z]{3,}) (\d{4}),? (\d{1,2}):(\d{2})/.exec(value);
  if (match) {
    const month = MONTHS.indexOf(match[2]!.slice(0, 3).toLowerCase());
    if (month < 0) return null;
    return new Date(Number(match[3]), month, Number(match[1]), Number(match[4]), Number(match[5])).getTime();
  }
  return null;
}

/** Strong's duration: "1h 12m", "45m", "50s"; null if it isn't one. */
export function parseDuration(text: string): number | null {
  const value = text.trim().toLowerCase();
  if (!value) return null;
  if (/^\d+$/.test(value)) return Number(value);
  let seconds = 0;
  let any = false;
  for (const [, n, unit] of value.matchAll(/(\d+)\s*([hms])/g)) {
    seconds += Number(n) * (unit === "h" ? 3600 : unit === "m" ? 60 : 1);
    any = true;
  }
  return any ? seconds : null;
}

const number = (text: string | undefined): number | null => {
  const value = (text ?? "").trim().replace(",", ".");
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

/** A stable short ID from text: the same file gives the same IDs. */
function hash(text: string): string {
  let a = 0x811c9dc5;
  let b = 0x01000193;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    a = Math.imul(a ^ c, 0x01000193) >>> 0;
    b = Math.imul(b ^ c, 0x5bd1e995) >>> 0;
  }
  return a.toString(16).padStart(8, "0") + b.toString(16).padStart(8, "0");
}

const normalize = (name: string) =>
  name
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\bups\b/g, "up")
    .replace(/s\b/g, "");

const EQUIPMENT_WORDS: [RegExp, Equipment][] = [
  [/smith|machine|lever|plate loaded/, "machine"],
  [/barbell|ez bar|trap bar/, "barbell"],
  [/dumbbell/, "dumbbell"],
  [/cable|rope/, "cable"],
  [/kettlebell/, "kettlebell"],
  [/band/, "band"],
  [/bodyweight|assisted|weighted/, "bodyweight"],
];

/** "Bench Press (Barbell)" → "Bench Press" and barbell. */
function split(name: string): { base: string; equipment: Equipment | null } {
  const match = /^(.*?)\s*\(([^)]*)\)\s*$/.exec(name);
  if (!match) return { base: name, equipment: null };
  const hint = match[2]!.toLowerCase();
  return { base: match[1]!, equipment: EQUIPMENT_WORDS.find(([pattern]) => pattern.test(hint))?.[1] ?? null };
}

// What a new exercise mostly works, from its name: the more specific first.
const MUSCLE_WORDS: [RegExp, Muscle][] = [
  [/\b(run|running|jog|row(ing)? machine|rower|cycl|bike|elliptical|walk|swim|stair|treadmill|ski erg)/, "cardio"],
  [/\bleg curl|romanian|\brdl\b|good morning|hamstring|nordic/, "hamstrings"],
  [/hip thrust|glute|bridge|kickback|abduct/, "glutes"],
  [/calf|calve/, "calves"],
  [/wrist|forearm|grip/, "forearms"],
  [/squat|leg press|lunge|leg extension|step up|hack/, "quads"],
  [/tricep|pushdown|skull|\bdip|close grip|kickback/, "triceps"],
  [/curl|bicep|preacher/, "biceps"],
  [/plank|crunch|sit up|\bab\b|abs\b|leg raise|oblique|twist|hollow|dead bug|wood ?chop/, "core"],
  [/overhead press|shoulder|military|lateral|rear delt|face pull|arnold|upright|shrug/, "shoulders"],
  [/bench|chest|fly|flye|push up|pec|press up/, "chest"],
  [/row|pulldown|pull up|chin up|deadlift|\blat\b|back extension|pullover/, "back"],
];

/** Words only, for the patterns above (normalize's plural trimming would turn "chest" into "ches"). */
const words = (name: string) => name.toLowerCase().replace(/['’]/g, "").replace(/[^a-z0-9]+/g, " ").trim();

export const guessMuscle = (name: string): Muscle => MUSCLE_WORDS.find(([pattern]) => pattern.test(words(name)))?.[1] ?? "full_body";

/** Finds the exercise of Milo's (yours or built in) that a name in the file means. */
export function matcher(exercises: Exercise[]): (name: string) => Exercise | null {
  const byName = new Map<string, Exercise[]>();
  for (const exercise of exercises.filter((each) => !each.deleted)) {
    const key = normalize(exercise.name);
    byName.set(key, [...(byName.get(key) ?? []), exercise]);
  }
  return (name) => {
    const exact = byName.get(normalize(name))?.[0];
    if (exact) return exact;
    const { base, equipment } = split(name);
    if (equipment) {
      const withEquipment = byName.get(normalize(`${equipment} ${base}`))?.[0];
      if (withEquipment) return withEquipment;
    }
    // "Squat (Barbell)" is Milo's "Squat", if Milo's is done with a barbell too.
    return byName.get(normalize(base))?.find((exercise) => !equipment || exercise.equipment === equipment) ?? null;
  };
}

type Row = {
  workoutKey: string;
  title: string;
  start: number;
  end: number | null;
  notes: string;
  exercise: string;
  warmup: boolean;
  weight: number | null;
  reps: number | null;
  seconds: number | null;
  distance: number | null;
  superset: string;
};

type Columns = Record<string, number>;
const column = (header: string[]): Columns => Object.fromEntries(header.map((name, i) => [name.trim().toLowerCase(), i]));
const cell = (row: string[], columns: Columns, ...names: string[]) => {
  for (const name of names) if (columns[name] !== undefined) return (row[columns[name]!] ?? "").trim();
  return "";
};

/**
 * Reads an export into workouts ready to save. `units` are what Strong's
 * weights and distances are in (Hevy's file says). Exercises are matched to
 * `exercises` or added.
 */
export function planImport(text: string, exercises: Exercise[], units: { weight: Unit; distance: Distance }): ImportPlan | { error: string } {
  const rows = parseCsv(text);
  if (rows.length < 2) return { error: "That file has no workouts in it." };
  const columns = column(rows[0]!);
  const has = (name: string) => columns[name] !== undefined;
  let source: Source;
  let weightUnit: Unit = units.weight;
  let distanceUnit: Distance = units.distance;
  if (has("exercise_title") && has("start_time")) {
    source = "Hevy";
    weightUnit = has("weight_lbs") && !has("weight_kg") ? "lb" : "kg";
    distanceUnit = has("distance_miles") && !has("distance_km") ? "mi" : "km";
  } else if (has("exercise name") && has("set order") && has("date")) {
    source = "Strong";
  } else {
    return { error: "That isn't an export Milo knows: it reads Strong's and Hevy's CSV files." };
  }

  let skipped = 0;
  const parsed: Row[] = [];
  for (const row of rows.slice(1)) {
    const read = (...names: string[]) => cell(row, columns, ...names);
    let warmup = false;
    let start: number | null;
    let end: number | null = null;
    let title: string;
    let notes: string;
    if (source === "Strong") {
      const order = read("set order");
      if (!/^\d+$/.test(order) && !/^[wdf]$/i.test(order)) {
        skipped++; // rest timers and notes
        continue;
      }
      warmup = /^w$/i.test(order);
      start = parseWhen(read("date"));
      const length = parseDuration(read("duration", "workout duration"));
      end = start !== null && length ? start + length * 1000 : null;
      title = read("workout name");
      notes = read("workout notes");
    } else {
      warmup = read("set_type").toLowerCase() === "warmup";
      start = parseWhen(read("start_time"));
      end = parseWhen(read("end_time"));
      title = read("title");
      notes = read("description");
    }
    const exercise = read("exercise name", "exercise_title");
    const weight = number(read("weight", "weight_kg", "weight_lbs"));
    const reps = number(read("reps"));
    const seconds = number(read("seconds", "duration_seconds"));
    const distance = number(read("distance", "distance_km", "distance_miles"));
    if (start === null || !exercise || [weight, reps, seconds, distance].every((value) => !value)) {
      skipped++;
      continue;
    }
    parsed.push({
      workoutKey: `${source}|${start}|${title}`,
      title: title || "Imported workout",
      start,
      end,
      notes,
      exercise,
      warmup,
      weight,
      reps: reps === null ? null : Math.round(reps),
      seconds: seconds === null ? null : Math.round(seconds),
      distance,
      superset: source === "Hevy" ? read("superset_id") : "",
    });
  }
  if (parsed.length === 0) return { error: "No sets could be read from that file." };

  // The file's exercises: Milo's, or new ones of your own, tracked as their sets are.
  const find = matcher(exercises);
  const chosen = new Map<string, Exercise>();
  const newExercises: Exercise[] = [];
  let matched = 0;
  for (const name of new Set(parsed.map((row) => row.exercise))) {
    const known = find(name);
    if (known) {
      chosen.set(name, known);
      matched++;
      continue;
    }
    const mine = parsed.filter((row) => row.exercise === name);
    const tracking: Tracking = mine.some((row) => row.distance)
      ? "cardio"
      : mine.some((row) => row.weight && row.reps)
        ? "load"
        : mine.some((row) => row.reps)
          ? "bodyweight"
          : mine.some((row) => row.seconds)
            ? "duration"
            : "load";
    const muscle = tracking === "cardio" ? "cardio" : guessMuscle(name);
    const exercise: Exercise = {
      id: `imp-ex-${hash(normalize(name))}`,
      updatedAt: 0,
      deleted: false,
      name: name.slice(0, 80),
      muscle,
      equipment: split(name).equipment ?? (tracking === "bodyweight" ? "bodyweight" : "other"),
      tracking,
      notes: `Imported from ${source}.`,
    };
    chosen.set(name, exercise);
    newExercises.push(exercise);
  }

  // Workouts: their rows in order; a new exercise starts where the name changes.
  const byWorkout = new Map<string, Row[]>();
  for (const row of parsed) byWorkout.set(row.workoutKey, [...(byWorkout.get(row.workoutKey) ?? []), row]);
  const workouts = [...byWorkout.entries()].map(([key, list]) => {
    const first = list[0]!;
    const id = `imp-${hash(key)}`;
    const workout: Workout = {
      id,
      updatedAt: 0,
      deleted: false,
      name: first.title.slice(0, 80),
      routineId: null,
      startedAt: first.start,
      endedAt: first.end && first.end > first.start ? first.end : first.start + 3_600_000,
      notes: first.notes.slice(0, 4000),
    };
    const sets: WorkoutSet[] = [];
    let position = -1;
    let index = 0;
    let previous = "";
    for (const row of list) {
      if (row.exercise !== previous) {
        position++;
        index = 0;
        previous = row.exercise;
      }
      const exercise = chosen.get(row.exercise)!;
      sets.push({
        id: `${id}-${position}-${index}`,
        updatedAt: 0,
        deleted: false,
        workoutId: id,
        exerciseId: exercise.id,
        position,
        index: index++,
        weightKg: row.weight ? Math.round(toKg(row.weight, weightUnit) * 1000) / 1000 : null,
        reps: row.reps || null,
        seconds: row.seconds || null,
        meters: row.distance ? toMeters(row.distance, distanceUnit) : null,
        warmup: row.warmup,
        done: true,
        superset: row.superset ? `${id}-ss${row.superset}` : null,
      });
    }
    return { workout, sets };
  });

  return { source, workouts: workouts.sort((a, b) => a.workout.startedAt - b.workout.startedAt), newExercises, matched, skipped, unitsAsked: source === "Strong" };
}

/** What saving a plan writes: new exercises, and the workouts not already on this device. */
export function importChanges(plan: ImportPlan, existing: Set<string>): Change[] {
  const fresh = plan.workouts.filter(({ workout }) => !existing.has(workout.id));
  return [
    ...plan.newExercises.filter((exercise) => !existing.has(exercise.id)).map((record): Change => ({ kind: "exercise", record })),
    ...fresh.flatMap(({ workout, sets }) => [{ kind: "workout", record: workout } as Change, ...sets.map((record): Change => ({ kind: "set", record }))]),
  ];
}
