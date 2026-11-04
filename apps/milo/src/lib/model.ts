import { z } from "zod";

// Milo's records, the same on the phone and on the server. Every record has
// an ID made on the device that created it (so it can be created offline),
// the time it last changed on a device (the newer change wins when two
// devices disagree), and a deleted flag (so deleting syncs like any change).
//
// Weights are always stored in kilograms; Settings decides what's shown.

export const KINDS = ["exercise", "routine", "workout", "set", "settings"] as const;
export type Kind = (typeof KINDS)[number];

export const MUSCLES = [
  "chest",
  "back",
  "shoulders",
  "biceps",
  "triceps",
  "forearms",
  "core",
  "quads",
  "hamstrings",
  "glutes",
  "calves",
  "full_body",
  "cardio",
] as const;
export type Muscle = (typeof MUSCLES)[number];

export const EQUIPMENT = ["barbell", "dumbbell", "machine", "cable", "bodyweight", "kettlebell", "band", "other"] as const;
export type Equipment = (typeof EQUIPMENT)[number];

/**
 * What a set of the exercise records:
 * - load: weight × reps (bench press)
 * - bodyweight: reps, and any weight added (pull-ups)
 * - duration: seconds, and any weight held (plank)
 * - cardio: distance and time (running)
 */
export const TRACKING = ["load", "bodyweight", "duration", "cardio"] as const;
export type Tracking = (typeof TRACKING)[number];

const base = {
  id: z.string().min(1).max(64),
  /** When it last changed, in milliseconds, on the device that changed it. */
  updatedAt: z.number().int().nonnegative(),
  deleted: z.boolean().default(false),
};

const name = z.string().trim().min(1).max(80);
const notes = z.string().max(4000).default("");
const time = z.number().int().nonnegative();

export const exerciseSchema = z.object({
  ...base,
  name,
  muscle: z.enum(MUSCLES),
  equipment: z.enum(EQUIPMENT),
  tracking: z.enum(TRACKING),
  notes,
});

export const routineItemSchema = z.object({
  exerciseId: z.string().min(1).max(64),
  sets: z.number().int().min(1).max(20),
  /** The target, as written: "8", "8–12", "AMRAP". */
  reps: z.string().max(16).default(""),
  /** Rest after each set; null uses the default from Settings. */
  restSeconds: z.number().int().min(0).max(900).nullable().default(null),
});

export const routineSchema = z.object({
  ...base,
  name,
  notes,
  items: z.array(routineItemSchema).max(40).default([]),
});

export const workoutSchema = z.object({
  ...base,
  name,
  routineId: z.string().max(64).nullable().default(null),
  startedAt: time,
  /** Null while it's going on. */
  endedAt: time.nullable().default(null),
  notes,
});

export const setSchema = z.object({
  ...base,
  workoutId: z.string().min(1).max(64),
  exerciseId: z.string().min(1).max(64),
  /** The exercise's place in the workout (the same exercise can come twice). */
  position: z.number().int().min(0).max(1000),
  /** The set's place within that exercise. */
  index: z.number().int().min(0).max(100),
  weightKg: z.number().min(0).max(2000).nullable().default(null),
  reps: z.number().int().min(0).max(1000).nullable().default(null),
  seconds: z.number().int().min(0).max(86_400).nullable().default(null),
  meters: z.number().min(0).max(1_000_000).nullable().default(null),
  warmup: z.boolean().default(false),
  /** Ticked off. Only done sets count, and unticked ones are dropped at the end. */
  done: z.boolean().default(false),
});

export const UNITS = ["kg", "lb"] as const;
export type Unit = (typeof UNITS)[number];

/** One record, id "settings": the same on every device. */
export const settingsSchema = z.object({
  ...base,
  unit: z.enum(UNITS).default("kg"),
  /** Rest between sets when a routine doesn't say. */
  restSeconds: z.number().int().min(0).max(900).default(90),
});

export const SCHEMAS = {
  exercise: exerciseSchema,
  routine: routineSchema,
  workout: workoutSchema,
  set: setSchema,
  settings: settingsSchema,
} as const;

export type Exercise = z.infer<typeof exerciseSchema>;
export type RoutineItem = z.infer<typeof routineItemSchema>;
export type Routine = z.infer<typeof routineSchema>;
export type Workout = z.infer<typeof workoutSchema>;
export type WorkoutSet = z.infer<typeof setSchema>;
export type Settings = z.infer<typeof settingsSchema>;

export type RecordOf<K extends Kind> = z.infer<(typeof SCHEMAS)[K]>;
export type AnyRecord = RecordOf<Kind>;

/** A record on the wire: which kind, and the record. */
export const changeSchema = z.object({ kind: z.enum(KINDS), record: z.record(z.string(), z.unknown()) });
export type Change = { kind: Kind; record: AnyRecord };

/** Checks a change from the other side; null when it isn't a valid record of its kind. */
export function parseChange(input: unknown): Change | null {
  const outer = changeSchema.safeParse(input);
  if (!outer.success) return null;
  const record = SCHEMAS[outer.data.kind].safeParse(outer.data.record);
  return record.success ? { kind: outer.data.kind, record: record.data } : null;
}

/** At most this many changes go in one sync request, and come back in one answer. */
export const SYNC_BATCH = 2000;

export const DEFAULT_SETTINGS: Settings = { id: "settings", updatedAt: 0, deleted: false, unit: "kg", restSeconds: 90 };

/** A new ID: random, made on this device. */
export const newId = () => crypto.randomUUID();
