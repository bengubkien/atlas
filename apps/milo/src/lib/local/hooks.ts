"use client";

import { useSyncInfo, type SyncInfo } from "@atlas/sync/react";
import { useLiveQuery } from "dexie-react-hooks";
import { useMemo } from "react";

import { mergeExercises } from "../library";
import { DEFAULT_SETTINGS, type Exercise, type Routine, type Settings, type Workout, type WorkoutSet } from "../model";

import { thisDevice } from "./device";

// Screens read this device's copy through these hooks; they update by
// themselves when anything changes, here or from a sync. `undefined` means
// still loading (a few milliseconds on first paint).

const alive = <T extends { deleted: boolean }>(records: T[]) => records.filter((record) => !record.deleted);

export function useSettings(): Settings {
  // Defaults first: a record saved before a setting existed doesn't have it.
  const saved = useLiveQuery(() => thisDevice().table("settings").get("settings"), []);
  return { ...DEFAULT_SETTINGS, ...saved };
}

/** The built-in exercises and your own, by name. */
export function useExercises(): Exercise[] | undefined {
  const own = useLiveQuery(() => thisDevice().table("exercise").toArray(), []);
  return useMemo(() => (own ? mergeExercises(own) : undefined), [own]);
}

/** Every exercise by ID, deleted ones included, so old workouts still show their names. */
export function useExerciseMap(): Map<string, Exercise> | undefined {
  const own = useLiveQuery(() => thisDevice().table("exercise").toArray(), []);
  return useMemo(() => {
    if (!own) return undefined;
    const map = new Map(mergeExercises([]).map((exercise) => [exercise.id, exercise]));
    for (const exercise of own) map.set(exercise.id, exercise);
    return map;
  }, [own]);
}

export function useRoutines(): Routine[] | undefined {
  return useLiveQuery(async () => alive(await thisDevice().table("routine").toArray()).sort((a, b) => a.name.localeCompare(b.name)), []);
}

/** Every workout, newest first. */
export function useWorkouts(): Workout[] | undefined {
  return useLiveQuery(async () => alive(await thisDevice().table("workout").orderBy("startedAt").reverse().toArray()), []);
}

/** The workout going on, if there is one (the latest, should there be two). */
export function useActiveWorkout(): Workout | null | undefined {
  return useLiveQuery(async () => {
    const all = alive(await thisDevice().table("workout").orderBy("startedAt").reverse().toArray());
    return all.find((workout) => workout.endedAt === null) ?? null;
  }, []);
}

/** Every set (for history and progress). */
export function useAllSets(): WorkoutSet[] | undefined {
  return useLiveQuery(async () => alive(await thisDevice().table("set").toArray()), []);
}

/** One workout's sets, in order. */
export function useWorkoutSets(workoutId: string | null | undefined): WorkoutSet[] | undefined {
  return useLiveQuery(async () => {
    if (!workoutId) return [];
    const sets = alive(await thisDevice().table("set").where("workoutId").equals(workoutId).toArray());
    return sets.sort((a, b) => a.position - b.position || a.index - b.index);
  }, [workoutId]);
}

export type { SyncInfo };

/** This device's sync state, live. */
export function useSync(): SyncInfo | undefined {
  return useSyncInfo(thisDevice);
}
