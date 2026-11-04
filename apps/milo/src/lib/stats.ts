import type { Exercise, Muscle, Tracking, Workout, WorkoutSet } from "./model";

// Numbers about training, from the records alone. Only sets that are ticked
// off, aren't warm-ups and aren't deleted count.

export const counts = (set: WorkoutSet) => set.done && !set.warmup && !set.deleted;

/** Above this many reps, a one-rep max worked out from a set means little. */
export const MAX_REPS_FOR_ESTIMATE = 12;

/**
 * The weight you could lift once, estimated from a set with Epley's formula
 * (weight × (1 + reps / 30)); the weight itself for a single. Null without
 * weight, or with too many reps to say.
 */
export function estimatedMax(weightKg: number | null, reps: number | null): number | null {
  if (!weightKg || !reps || reps < 1 || reps > MAX_REPS_FOR_ESTIMATE) return null;
  return reps === 1 ? weightKg : weightKg * (1 + reps / 30);
}

/** Weight × reps over the sets that count, in kilograms. */
export function volumeKg(sets: WorkoutSet[]): number {
  return sets.filter(counts).reduce((sum, set) => sum + (set.weightKg ?? 0) * (set.reps ?? 0), 0);
}

/** How a set ranks for its kind of exercise: the higher, the better. */
export function setScore(set: WorkoutSet, tracking: Tracking): number {
  switch (tracking) {
    case "load":
      return estimatedMax(set.weightKg, set.reps) ?? (set.weightKg ?? 0) * 0.5;
    case "bodyweight":
      return (set.reps ?? 0) + (set.weightKg ?? 0) / 100;
    case "duration":
      return (set.seconds ?? 0) + (set.weightKg ?? 0) / 100;
    case "cardio":
      return set.meters ?? 0;
  }
}

/** The best of these sets that count, for the exercise's kind; null if none. */
export function bestSet(sets: WorkoutSet[], tracking: Tracking): WorkoutSet | null {
  let best: WorkoutSet | null = null;
  for (const set of sets.filter(counts)) {
    if (!best || setScore(set, tracking) > setScore(best, tracking)) best = set;
  }
  return best;
}

/** Midnight on the Monday of that week, where you are. */
export function startOfWeek(ms: number): number {
  const date = new Date(ms);
  const sinceMonday = (date.getDay() + 6) % 7;
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() - sinceMonday).getTime();
}

export type WeekTotals = { start: number; workouts: number; sets: number; volumeKg: number };

/** The last `weeks` weeks, oldest first, this one included. Only finished workouts count. */
export function weeklyTotals(workouts: Workout[], sets: WorkoutSet[], weeks = 12, now = Date.now()): WeekTotals[] {
  const thisWeek = startOfWeek(now);
  const starts = Array.from({ length: weeks }, (_, i) => {
    const date = new Date(thisWeek);
    date.setDate(date.getDate() - 7 * (weeks - 1 - i));
    return date.getTime();
  });
  const totals = new Map(starts.map((start) => [start, { start, workouts: 0, sets: 0, volumeKg: 0 }]));
  const setsByWorkout = groupBy(sets.filter(counts), (set) => set.workoutId);
  for (const workout of workouts) {
    if (workout.deleted || workout.endedAt === null) continue;
    const week = totals.get(startOfWeek(workout.startedAt));
    if (!week) continue;
    const done = setsByWorkout.get(workout.id) ?? [];
    week.workouts += 1;
    week.sets += done.length;
    week.volumeKg += volumeKg(done);
  }
  return [...totals.values()];
}

/** How many sets that count each muscle got, between two times. */
export function setsByMuscle(
  workouts: Workout[],
  sets: WorkoutSet[],
  exercises: Map<string, Exercise>,
  from: number,
  to: number,
): Map<Muscle, number> {
  const inRange = new Set(
    workouts.filter((w) => !w.deleted && w.endedAt !== null && w.startedAt >= from && w.startedAt < to).map((w) => w.id),
  );
  const result = new Map<Muscle, number>();
  for (const set of sets) {
    if (!counts(set) || !inRange.has(set.workoutId)) continue;
    const muscle = exercises.get(set.exerciseId)?.muscle;
    if (muscle) result.set(muscle, (result.get(muscle) ?? 0) + 1);
  }
  return result;
}

export type Session = { workout: Workout; sets: WorkoutSet[]; best: WorkoutSet | null };

/** Every finished workout with the exercise, newest first, with its sets that count and the best of them. */
export function exerciseHistory(exercise: Exercise, workouts: Workout[], sets: WorkoutSet[]): Session[] {
  const mine = groupBy(
    sets.filter((set) => set.exerciseId === exercise.id && counts(set)),
    (set) => set.workoutId,
  );
  return workouts
    .filter((workout) => !workout.deleted && workout.endedAt !== null && mine.has(workout.id))
    .sort((a, b) => b.startedAt - a.startedAt)
    .map((workout) => {
      const done = mine.get(workout.id)!.sort((a, b) => a.position - b.position || a.index - b.index);
      return { workout, sets: done, best: bestSet(done, exercise.tracking) };
    });
}

/**
 * What you did last time: the sets of the exercise in the latest finished
 * workout that had it, in order, warm-ups included (they're shown, not counted).
 */
export function lastTime(exerciseId: string, workouts: Workout[], sets: WorkoutSet[], before = Number.POSITIVE_INFINITY): WorkoutSet[] {
  const finished = new Map(
    workouts.filter((w) => !w.deleted && w.endedAt !== null && w.startedAt < before).map((w) => [w.id, w]),
  );
  let latest: Workout | null = null;
  for (const set of sets) {
    if (set.exerciseId !== exerciseId || !set.done || set.deleted) continue;
    const workout = finished.get(set.workoutId);
    if (workout && (!latest || workout.startedAt > latest.startedAt)) latest = workout;
  }
  if (!latest) return [];
  return sets
    .filter((set) => set.workoutId === latest.id && set.exerciseId === exerciseId && set.done && !set.deleted)
    .sort((a, b) => a.position - b.position || a.index - b.index);
}

export type PersonalRecord = { exercise: Exercise; set: WorkoutSet; workout: Workout; score: number };

/**
 * The sets that beat everything before them, for each exercise, oldest
 * first. The first time you do an exercise doesn't count as a record.
 */
export function personalRecords(exercises: Map<string, Exercise>, workouts: Workout[], sets: WorkoutSet[]): PersonalRecord[] {
  const finished = workouts.filter((w) => !w.deleted && w.endedAt !== null).sort((a, b) => a.startedAt - b.startedAt);
  const setsByWorkout = groupBy(sets.filter(counts), (set) => set.workoutId);
  const bestSoFar = new Map<string, number>();
  const records: PersonalRecord[] = [];
  for (const workout of finished) {
    const byExercise = groupBy(setsByWorkout.get(workout.id) ?? [], (set) => set.exerciseId);
    for (const [exerciseId, done] of byExercise) {
      const exercise = exercises.get(exerciseId);
      if (!exercise || exercise.tracking === "cardio") continue;
      const best = bestSet(done, exercise.tracking);
      if (!best) continue;
      const score = setScore(best, exercise.tracking);
      const previous = bestSoFar.get(exerciseId);
      if (previous !== undefined && score > previous + 1e-9) records.push({ exercise, set: best, workout, score });
      if (previous === undefined || score > previous) bestSoFar.set(exerciseId, score);
    }
  }
  return records;
}

export function groupBy<T, K>(items: T[], key: (item: T) => K): Map<K, T[]> {
  const groups = new Map<K, T[]>();
  for (const item of items) {
    const k = key(item);
    const group = groups.get(k);
    if (group) group.push(item);
    else groups.set(k, [item]);
  }
  return groups;
}
