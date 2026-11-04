import type { MiloDevice as Device } from "./local/device";
import { newId, type Change, type Exercise, type RoutineItem, type Workout, type WorkoutSet } from "./model";

// What you do during a workout, as changes to this device's copy.

const blankSet = (workoutId: string, exerciseId: string, position: number, index: number): WorkoutSet => ({
  id: newId(),
  updatedAt: 0,
  deleted: false,
  workoutId,
  exerciseId,
  position,
  index,
  weightKg: null,
  reps: null,
  seconds: null,
  meters: null,
  warmup: false,
  done: false,
});

/** "Morning workout", "Evening workout"… by the hour it starts. */
export function workoutName(now = new Date()): string {
  const hour = now.getHours();
  if (hour < 5) return "Night workout";
  if (hour < 12) return "Morning workout";
  if (hour < 17) return "Afternoon workout";
  return "Evening workout";
}

/** What a workout starts with: a routine, or exercises picked another way (the muscle map), unsaved. */
export type Plan = { id?: string; name: string; items: Pick<RoutineItem, "exerciseId" | "sets">[] };

/** Starts a workout, empty or with a routine's (or a plan's) exercises and sets laid out. */
export async function startWorkout(device: Device, routine?: Plan): Promise<string> {
  const workout: Workout = {
    id: newId(),
    updatedAt: 0,
    deleted: false,
    name: routine?.name ?? workoutName(),
    routineId: routine?.id ?? null,
    startedAt: Date.now(),
    endedAt: null,
    notes: "",
  };
  const sets = (routine?.items ?? []).flatMap((item, position) =>
    Array.from({ length: item.sets }, (_, index) => blankSet(workout.id, item.exerciseId, position, index)),
  );
  await device.save([{ kind: "workout", record: workout }, ...sets.map((set): Change => ({ kind: "set", record: set }))]);
  return workout.id;
}

/** Repeats a past workout: its exercises and number of sets, empty. */
export async function repeatWorkout(device: Device, past: Workout, sets: WorkoutSet[]): Promise<string> {
  const workout: Workout = { ...past, id: newId(), updatedAt: 0, startedAt: Date.now(), endedAt: null, notes: "" };
  const fresh = sets.filter((set) => set.done && !set.deleted).map((set) => ({ ...blankSet(workout.id, set.exerciseId, set.position, set.index), warmup: set.warmup }));
  await device.save([{ kind: "workout", record: workout }, ...fresh.map((set): Change => ({ kind: "set", record: set }))]);
  return workout.id;
}

/** Adds an exercise at the end, with one empty set. */
export async function addExercise(device: Device, workoutId: string, exercise: Exercise, sets: WorkoutSet[]) {
  const position = sets.length ? Math.max(...sets.map((set) => set.position)) + 1 : 0;
  await device.put("set", blankSet(workoutId, exercise.id, position, 0));
}

/** Adds a plan's exercises to a workout going on, after its own, each with its sets laid out. */
export async function addPlan(device: Device, workoutId: string, items: Plan["items"], sets: WorkoutSet[]) {
  const first = sets.length ? Math.max(...sets.map((set) => set.position)) + 1 : 0;
  const fresh = items.flatMap((item, offset) =>
    Array.from({ length: item.sets }, (_, index) => blankSet(workoutId, item.exerciseId, first + offset, index)),
  );
  await device.save(fresh.map((set): Change => ({ kind: "set", record: set })));
}

/** Adds a set to an exercise, after its last one. */
export async function addSet(device: Device, workoutId: string, exerciseId: string, position: number, sets: WorkoutSet[]) {
  const mine = sets.filter((set) => set.position === position);
  const index = mine.length ? Math.max(...mine.map((set) => set.index)) + 1 : 0;
  await device.put("set", blankSet(workoutId, exerciseId, position, index));
}

/** Takes an exercise and all its sets out of the workout. */
export async function removeExercise(device: Device, position: number, sets: WorkoutSet[]) {
  await device.remove(
    "set",
    sets.filter((set) => set.position === position).map((set) => set.id),
  );
}

/** Swaps an exercise with the one before (-1) or after (+1). */
export async function moveExercise(device: Device, position: number, direction: -1 | 1, sets: WorkoutSet[]) {
  const positions = [...new Set(sets.map((set) => set.position))].sort((a, b) => a - b);
  const at = positions.indexOf(position);
  const other = positions[at + direction];
  if (other === undefined) return;
  await device.save(
    sets
      .filter((set) => set.position === position || set.position === other)
      .map((set): Change => ({ kind: "set", record: { ...set, position: set.position === position ? other : position } })),
  );
}

/**
 * Ends the workout: sets that weren't ticked off are dropped. A workout with
 * nothing ticked is discarded instead. Returns whether anything was kept.
 */
export async function finishWorkout(device: Device, workout: Workout, sets: WorkoutSet[]): Promise<boolean> {
  const done = sets.filter((set) => set.done);
  if (done.length === 0) {
    await discardWorkout(device, workout, sets);
    return false;
  }
  await device.save([
    { kind: "workout", record: { ...workout, endedAt: Date.now() } },
    ...sets.filter((set) => !set.done).map((set): Change => ({ kind: "set", record: { ...set, deleted: true } })),
  ]);
  return true;
}

/** Throws the workout away, sets and all. */
export async function discardWorkout(device: Device, workout: Workout, sets: WorkoutSet[]) {
  await device.save([
    { kind: "workout", record: { ...workout, deleted: true } },
    ...sets.map((set): Change => ({ kind: "set", record: { ...set, deleted: true } })),
  ]);
}

/** The exercises of a workout, in order, each with its sets. */
export function blocks(sets: WorkoutSet[]): { position: number; exerciseId: string; sets: WorkoutSet[] }[] {
  const byPosition = new Map<number, WorkoutSet[]>();
  for (const set of sets) {
    const group = byPosition.get(set.position);
    if (group) group.push(set);
    else byPosition.set(set.position, [set]);
  }
  return [...byPosition.entries()]
    .sort(([a], [b]) => a - b)
    .map(([position, group]) => ({
      position,
      exerciseId: group[0]!.exerciseId,
      sets: group.sort((a, b) => a.index - b.index),
    }));
}
