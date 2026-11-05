import type { Exercise, Workout, WorkoutSet } from "./model";
import { bestSet, counts, estimatedMax, groupBy } from "./stats";

// Body weight, from Hygeia: what you weighed around a workout, and how much
// you lift for your weight. Hygeia keeps the readings; Milo keeps a copy on
// the device so it works offline (see bodyweight-hook.ts).

export type BodyWeight = { at: number; kg: number };

/** A reading counts for a workout this many days either side of it. */
export const NEAR_DAYS = 30;

/** What you weighed around a moment: the nearest reading within NEAR_DAYS, or null. */
export function weightAt(weights: BodyWeight[], ms: number): number | null {
  let best: BodyWeight | null = null;
  for (const reading of weights) {
    if (Math.abs(reading.at - ms) > NEAR_DAYS * 86_400_000) continue;
    if (!best || Math.abs(reading.at - ms) < Math.abs(best.at - ms)) best = reading;
  }
  return best?.kg ?? null;
}

export type Relative = { exercise: Exercise; set: WorkoutSet; workout: Workout; maxKg: number; bodyKg: number; ratio: number };

/**
 * For each lift (weight × reps), its best estimated one-rep max over your
 * weight at the time: 1.5 means once and a half your weight. The heaviest
 * lifts first, at most `limit`.
 */
export function strengthForWeight(exercises: Map<string, Exercise>, workouts: Workout[], sets: WorkoutSet[], weights: BodyWeight[], limit = 6): Relative[] {
  const finished = new Map(workouts.filter((w) => !w.deleted && w.endedAt !== null).map((w) => [w.id, w]));
  const byExercise = groupBy(sets.filter((set) => counts(set) && finished.has(set.workoutId)), (set) => set.exerciseId);
  const result: Relative[] = [];
  for (const [exerciseId, done] of byExercise) {
    const exercise = exercises.get(exerciseId);
    if (!exercise || exercise.tracking !== "load") continue;
    const set = bestSet(done, "load");
    const maxKg = set ? estimatedMax(set.weightKg, set.reps) : null;
    if (!set || !maxKg) continue;
    const workout = finished.get(set.workoutId)!;
    const bodyKg = weightAt(weights, workout.startedAt);
    if (!bodyKg) continue;
    result.push({ exercise, set, workout, maxKg, bodyKg, ratio: maxKg / bodyKg });
  }
  return result.sort((a, b) => b.maxKg - a.maxKg).slice(0, limit);
}

/** Weekly averages over the last `weeks` weeks, oldest first; null for a week without a reading. */
export function weeklyWeights(weights: BodyWeight[], weekStarts: number[]): (number | null)[] {
  return weekStarts.map((start) => {
    const week = weights.filter((reading) => reading.at >= start && reading.at < start + 7 * 86_400_000);
    return week.length ? week.reduce((sum, reading) => sum + reading.kg, 0) / week.length : null;
  });
}
