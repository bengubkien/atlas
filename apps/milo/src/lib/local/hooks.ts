"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { useMemo } from "react";

import { mergeExercises } from "../library";
import { DEFAULT_SETTINGS, type Exercise, type Routine, type Settings, type Workout, type WorkoutSet } from "../model";
import { thisDevice, type SyncState } from "./device";

// Screens read this device's copy through these hooks; they update by
// themselves when anything changes, here or from a sync. `undefined` means
// still loading (a few milliseconds on first paint).

const alive = <T extends { deleted: boolean }>(records: T[]) => records.filter((record) => !record.deleted);

export function useSettings(): Settings {
  return useLiveQuery(() => thisDevice().db.settings.get("settings"), []) ?? DEFAULT_SETTINGS;
}

/** The built-in exercises and your own, by name. */
export function useExercises(): Exercise[] | undefined {
  const own = useLiveQuery(() => thisDevice().db.exercise.toArray(), []);
  return useMemo(() => (own ? mergeExercises(own) : undefined), [own]);
}

/** Every exercise by ID, deleted ones included, so old workouts still show their names. */
export function useExerciseMap(): Map<string, Exercise> | undefined {
  const own = useLiveQuery(() => thisDevice().db.exercise.toArray(), []);
  return useMemo(() => {
    if (!own) return undefined;
    const map = new Map(mergeExercises([]).map((exercise) => [exercise.id, exercise]));
    for (const exercise of own) map.set(exercise.id, exercise);
    return map;
  }, [own]);
}

export function useRoutines(): Routine[] | undefined {
  return useLiveQuery(async () => alive(await thisDevice().db.routine.toArray()).sort((a, b) => a.name.localeCompare(b.name)), []);
}

/** Every workout, newest first. */
export function useWorkouts(): Workout[] | undefined {
  return useLiveQuery(async () => alive(await thisDevice().db.workout.orderBy("startedAt").reverse().toArray()), []);
}

/** The workout going on, if there is one (the latest, should there be two). */
export function useActiveWorkout(): Workout | null | undefined {
  return useLiveQuery(async () => {
    const all = alive(await thisDevice().db.workout.orderBy("startedAt").reverse().toArray());
    return all.find((workout) => workout.endedAt === null) ?? null;
  }, []);
}

/** Every set (for history and progress). */
export function useAllSets(): WorkoutSet[] | undefined {
  return useLiveQuery(async () => alive(await thisDevice().db.set.toArray()), []);
}

/** One workout's sets, in order. */
export function useWorkoutSets(workoutId: string | null | undefined): WorkoutSet[] | undefined {
  return useLiveQuery(async () => {
    if (!workoutId) return [];
    const sets = alive(await thisDevice().db.set.where("workoutId").equals(workoutId).toArray());
    return sets.sort((a, b) => a.position - b.position || a.index - b.index);
  }, [workoutId]);
}

export type SyncInfo = SyncState & { pending: number };

export function useSync(): SyncInfo | undefined {
  return useLiveQuery(async () => {
    const device = thisDevice();
    return { ...(await device.syncState()), pending: await device.pendingCount() };
  }, []);
}
