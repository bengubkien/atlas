import type { MiloDevice as Device } from "./local/device";
import { newId, type Change, type Exercise, type RoutineItem, type Workout, type WorkoutSet } from "./model";

// What you do during a workout, as changes to this device's copy.

const blankSet = (workoutId: string, exerciseId: string, position: number, index: number, extra: Partial<WorkoutSet> = {}): WorkoutSet => ({
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
  superset: null,
  ...extra,
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
export type Plan = { id?: string; name: string; items: (Pick<RoutineItem, "exerciseId" | "sets"> & { superset?: boolean })[] };

/**
 * Superset IDs for a plan's items: an item marked "with the next" shares
 * one with the item after it, and so on down a chain.
 */
export function supersetIds(items: { superset?: boolean }[]): (string | null)[] {
  const ids: (string | null)[] = items.map(() => null);
  items.forEach((item, i) => {
    if (!item.superset || i === items.length - 1) return;
    const id = ids[i] ?? newId();
    ids[i] = id;
    ids[i + 1] = id;
  });
  return ids;
}

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
  const items = routine?.items ?? [];
  const groups = supersetIds(items);
  const sets = items.flatMap((item, position) =>
    Array.from({ length: item.sets }, (_, index) => blankSet(workout.id, item.exerciseId, position, index, { superset: groups[position] ?? null })),
  );
  await device.save([{ kind: "workout", record: workout }, ...sets.map((set): Change => ({ kind: "set", record: set }))]);
  return workout.id;
}

/** Repeats a past workout: its exercises and number of sets, empty. */
export async function repeatWorkout(device: Device, past: Workout, sets: WorkoutSet[]): Promise<string> {
  const workout: Workout = { ...past, id: newId(), updatedAt: 0, startedAt: Date.now(), endedAt: null, notes: "" };
  // The same supersets, under new IDs.
  const groups = new Map<string, string>();
  const group = (id: string | null) => (id ? (groups.get(id) ?? groups.set(id, newId()).get(id)!) : null);
  const fresh = sets
    .filter((set) => set.done && !set.deleted)
    .map((set) => blankSet(workout.id, set.exerciseId, set.position, set.index, { warmup: set.warmup, superset: group(set.superset) }));
  await device.save([{ kind: "workout", record: workout }, ...fresh.map((set): Change => ({ kind: "set", record: set }))]);
  return workout.id;
}

/** Adds an exercise at the end, with one empty set (already done when editing a finished workout). */
export async function addExercise(device: Device, workoutId: string, exercise: Exercise, sets: WorkoutSet[], done = false) {
  const position = sets.length ? Math.max(...sets.map((set) => set.position)) + 1 : 0;
  await device.put("set", blankSet(workoutId, exercise.id, position, 0, { done }));
}

/** Adds a plan's exercises to a workout going on, after its own, each with its sets laid out. */
export async function addPlan(device: Device, workoutId: string, items: Plan["items"], sets: WorkoutSet[]) {
  const first = sets.length ? Math.max(...sets.map((set) => set.position)) + 1 : 0;
  const fresh = items.flatMap((item, offset) =>
    Array.from({ length: item.sets }, (_, index) => blankSet(workoutId, item.exerciseId, first + offset, index)),
  );
  await device.save(fresh.map((set): Change => ({ kind: "set", record: set })));
}

/** Adds a set to an exercise, after its last one (already done when editing a finished workout). */
export async function addSet(device: Device, workoutId: string, exerciseId: string, position: number, sets: WorkoutSet[], done = false) {
  const mine = sets.filter((set) => set.position === position);
  const index = mine.length ? Math.max(...mine.map((set) => set.index)) + 1 : 0;
  await device.put("set", blankSet(workoutId, exerciseId, position, index, { done, superset: mine[0]?.superset ?? null }));
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

/** Joins an exercise and the one after it in a superset (the next one's, if it's in one already). */
export async function joinSuperset(device: Device, position: number, sets: WorkoutSet[]) {
  const positions = [...new Set(sets.map((set) => set.position))].sort((a, b) => a - b);
  const next = positions[positions.indexOf(position) + 1];
  if (next === undefined) return;
  const at = (p: number) => sets.filter((set) => set.position === p);
  const id = at(position)[0]?.superset ?? at(next)[0]?.superset ?? newId();
  const old = new Set([at(position)[0]?.superset, at(next)[0]?.superset].filter((each): each is string => Boolean(each)));
  // Whole supersets either side join too, so a chain stays one superset.
  const joined = sets.filter((set) => set.position === position || set.position === next || (set.superset !== null && old.has(set.superset)));
  await device.save(joined.map((set): Change => ({ kind: "set", record: { ...set, superset: id } })));
}

/** Takes an exercise out of its superset; a superset left with one exercise ends. */
export async function leaveSuperset(device: Device, position: number, sets: WorkoutSet[]) {
  const id = sets.find((set) => set.position === position)?.superset;
  if (!id) return;
  const rest = sets.filter((set) => set.superset === id && set.position !== position);
  const alone = new Set(rest.map((set) => set.position)).size < 2;
  const changed = sets.filter((set) => set.position === position || (alone && set.superset === id));
  await device.save(changed.map((set): Change => ({ kind: "set", record: { ...set, superset: null } })));
}

/** Drops sets with nothing in them, when a finished workout's editing is done. */
export async function dropEmptySets(device: Device, sets: WorkoutSet[]) {
  const empty = sets.filter((set) => set.weightKg === null && set.reps === null && set.seconds === null && set.meters === null);
  if (empty.length) await device.remove("set", empty.map((set) => set.id));
}

/** Throws the workout away, sets and all. */
export async function discardWorkout(device: Device, workout: Workout, sets: WorkoutSet[]) {
  await device.save([
    { kind: "workout", record: { ...workout, deleted: true } },
    ...sets.map((set): Change => ({ kind: "set", record: { ...set, deleted: true } })),
  ]);
}

export type Block = {
  position: number;
  exerciseId: string;
  sets: WorkoutSet[];
  /** Its superset, if it's in one, and its place there: rest comes after the last. */
  superset: { id: string; first: boolean; last: boolean } | null;
};

/** Blocks in runs: each superset's exercises together, every other exercise on its own. */
export function runs<B extends { superset: Block["superset"] }>(list: B[]): B[][] {
  const result: B[][] = [];
  for (const block of list) {
    const last = result.at(-1);
    if (block.superset && !block.superset.first && last) last.push(block);
    else result.push([block]);
  }
  return result;
}

/** The exercises of a workout, in order, each with its sets and its place in a superset. */
export function blocks(sets: WorkoutSet[]): Block[] {
  const byPosition = new Map<number, WorkoutSet[]>();
  for (const set of sets) {
    const group = byPosition.get(set.position);
    if (group) group.push(set);
    else byPosition.set(set.position, [set]);
  }
  const list = [...byPosition.entries()]
    .sort(([a], [b]) => a - b)
    .map(([position, group]) => ({ position, exerciseId: group[0]!.exerciseId, sets: group.sort((a, b) => a.index - b.index), id: group[0]!.superset }));
  // A superset is the exercises next to each other with the same ID; one on its own isn't one.
  return list.map((block, i): Block => {
    const before = list[i - 1]?.id === block.id && block.id !== null;
    const after = list[i + 1]?.id === block.id && block.id !== null;
    return {
      position: block.position,
      exerciseId: block.exerciseId,
      sets: block.sets,
      superset: block.id && (before || after) ? { id: block.id, first: !before, last: !after } : null,
    };
  });
}
