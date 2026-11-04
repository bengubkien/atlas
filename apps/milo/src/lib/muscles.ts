import type { MuscleGroup } from "@atlas/body/parts";

import { MUSCLE_LABELS } from "./library";
import type { Exercise, Muscle, Workout, WorkoutSet } from "./model";
import { counts } from "./stats";

// The muscle map's numbers, from the device's copy: how much each muscle
// worked in the last 7 days, when it last worked, and a few plain notes on
// balance. A workout going on counts too, so its sets show as you do them.

const DAY = 24 * 60 * 60 * 1000;

/** The muscles on the figure, in the order the list shows them. */
export const MAPPED: MuscleGroup[] = ["chest", "back", "shoulders", "biceps", "triceps", "forearms", "core", "glutes", "quads", "hamstrings", "calves"];

export type Standing = {
  muscle: MuscleGroup;
  /** Sets that count (done, not warm-ups) in the last 7 days: today and the six before. */
  sets: number;
  /** When it last had a set that counts; null if never. */
  lastAt: number | null;
  /** Whole days since then, by the calendar (0 today, 1 yesterday); null if never. */
  days: number | null;
};

/** Midnight of a moment's day, where you are. */
const midnight = (ms: number) => {
  const date = new Date(ms);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
};
const calendarDays = (from: number, to: number) => Math.round((midnight(to) - midnight(from)) / DAY);

/** Each mapped muscle's sets in the last 7 days and when it last worked. */
export function standings(workouts: Workout[], sets: WorkoutSet[], exercises: Map<string, Exercise>, now = Date.now()): Map<MuscleGroup, Standing> {
  const live = new Map(workouts.filter((w) => !w.deleted).map((w) => [w.id, w]));
  // Today and the six days before it, by the calendar, as "days ago" counts.
  const since = midnight(now) - 6 * DAY;
  const result = new Map<MuscleGroup, Standing>(MAPPED.map((muscle) => [muscle, { muscle, sets: 0, lastAt: null, days: null }]));
  for (const set of sets) {
    if (!counts(set)) continue;
    const workout = live.get(set.workoutId);
    const standing = result.get(exercises.get(set.exerciseId)?.muscle as MuscleGroup);
    if (!workout || !standing) continue;
    if (workout.startedAt >= since && workout.startedAt <= now) standing.sets += 1;
    if (workout.startedAt <= now && (standing.lastAt === null || workout.startedAt > standing.lastAt)) standing.lastAt = workout.startedAt;
  }
  for (const standing of result.values()) standing.days = standing.lastAt === null ? null : calendarDays(standing.lastAt, now);
  return result;
}

/** The step on the "last 7 days" scale: 0 none, then 1–4, 5–9, 10–14 and 15 or more sets. */
export const SET_STEPS = [
  { label: "None", test: (n: number) => n === 0 },
  { label: "1–4 sets", test: (n: number) => n >= 1 && n <= 4 },
  { label: "5–9", test: (n: number) => n >= 5 && n <= 9 },
  { label: "10–14", test: (n: number) => n >= 10 && n <= 14 },
  { label: "15 or more", test: (n: number) => n >= 15 },
] as const;
export const setStep = (sets: number) => SET_STEPS.findIndex((step) => step.test(sets));

/** The step on the "last trained" scale: 0 not in two weeks (or never), then 8–14 days, 4–7, 2–3, today or yesterday. */
export const RECENT_STEPS = [
  { label: "Over 2 weeks", test: (days: number | null) => days === null || days > 14 },
  { label: "8–14 days ago", test: (days: number | null) => days !== null && days >= 8 && days <= 14 },
  { label: "4–7", test: (days: number | null) => days !== null && days >= 4 && days <= 7 },
  { label: "2–3", test: (days: number | null) => days !== null && days >= 2 && days <= 3 },
  { label: "Today or yesterday", test: (days: number | null) => days !== null && days <= 1 },
] as const;
export const recentStep = (days: number | null) => RECENT_STEPS.findIndex((step) => step.test(days));

/** "today", "yesterday", "3 days ago", "never". */
export function ago(days: number | null): string {
  if (days === null) return "never";
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  return `${days} days ago`;
}

export type ExerciseUse = { exercise: Exercise; lastAt: number | null; lastSets: number };

/**
 * A muscle's exercises: the ones you've done, most recent first, with how
 * many sets you did last time; then the rest, by name.
 */
export function exercisesFor(muscle: Muscle, exercises: Exercise[], workouts: Workout[], sets: WorkoutSet[]): ExerciseUse[] {
  const live = new Map(workouts.filter((w) => !w.deleted).map((w) => [w.id, w]));
  const mine = exercises.filter((exercise) => exercise.muscle === muscle && !exercise.deleted);
  const ids = new Set(mine.map((exercise) => exercise.id));
  const last = new Map<string, { at: number; workoutId: string }>();
  for (const set of sets) {
    if (!ids.has(set.exerciseId) || !counts(set)) continue;
    const workout = live.get(set.workoutId);
    if (!workout) continue;
    const seen = last.get(set.exerciseId);
    if (!seen || workout.startedAt > seen.at) last.set(set.exerciseId, { at: workout.startedAt, workoutId: workout.id });
  }
  return mine
    .map((exercise) => {
      const seen = last.get(exercise.id);
      const lastSets = seen ? sets.filter((s) => s.workoutId === seen.workoutId && s.exerciseId === exercise.id && counts(s)).length : 0;
      return { exercise, lastAt: seen?.at ?? null, lastSets };
    })
    .sort((a, b) => (b.lastAt ?? -1) - (a.lastAt ?? -1) || a.exercise.name.localeCompare(b.exercise.name));
}

/** The exercises to start a workout for a muscle with: up to three, as many sets as last time (3 if never). */
export function planFor(uses: ExerciseUse[]): { exerciseId: string; sets: number }[] {
  return uses.slice(0, 3).map((use) => ({ exerciseId: use.exercise.id, sets: use.lastAt === null ? 3 : Math.min(use.lastSets, 8) }));
}

/** The big groups: what notes and Today name; the small ones (forearms, calves…) often get work from the rest. */
const MAJOR: MuscleGroup[] = ["chest", "back", "shoulders", "quads", "hamstrings", "glutes"];

/**
 * For Today: the big muscles rested longest, at least two days (never
 * trained counts as longest), so choosing a workout starts from them. Empty
 * until you've trained something.
 */
export function restedLongest(byMuscle: Map<MuscleGroup, Standing>, limit = 3): Standing[] {
  const all = MAJOR.map((muscle) => byMuscle.get(muscle)).filter((standing): standing is Standing => Boolean(standing));
  if (!all.some((standing) => standing.lastAt !== null)) return [];
  return all
    .filter((standing) => standing.days === null || standing.days >= 2)
    .sort((a, b) => (b.days ?? Infinity) - (a.days ?? Infinity))
    .slice(0, limit);
}
const PUSH: MuscleGroup[] = ["chest", "shoulders", "triceps"];
const PULL: MuscleGroup[] = ["back", "biceps"];
const LEGS: MuscleGroup[] = ["quads", "hamstrings", "glutes", "calves"];
const UPPER: MuscleGroup[] = ["chest", "back", "shoulders", "biceps", "triceps", "forearms"];

const list = (items: string[]) => (items.length <= 1 ? items.join("") : `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`);

/**
 * Plain notes on balance over the last four weeks, only while you're
 * training (a workout in the last two weeks): big muscles left out for two
 * weeks, pushing far more than pulling (or the other way), legs left behind.
 */
export function balanceNotes(workouts: Workout[], sets: WorkoutSet[], exercises: Map<string, Exercise>, now = Date.now()): string[] {
  const recent = standings(workouts, sets, exercises, now);
  const training = [...recent.values()].some((standing) => standing.days !== null && standing.days <= 14);
  if (!training) return [];

  const live = new Map(workouts.filter((w) => !w.deleted && w.startedAt >= now - 28 * DAY && w.startedAt <= now).map((w) => [w.id, w]));
  const month = new Map<MuscleGroup, number>();
  for (const set of sets) {
    if (!counts(set) || !live.has(set.workoutId)) continue;
    const muscle = exercises.get(set.exerciseId)?.muscle as MuscleGroup | undefined;
    if (muscle && MAPPED.includes(muscle)) month.set(muscle, (month.get(muscle) ?? 0) + 1);
  }
  const total = (groups: MuscleGroup[]) => groups.reduce((sum, group) => sum + (month.get(group) ?? 0), 0);
  const notes: string[] = [];

  const left = MAJOR.filter((muscle) => {
    const days = recent.get(muscle)?.days ?? null;
    return days === null || days > 14;
  });
  if (left.length) notes.push(`Not trained in two weeks: ${list(left.map((m) => MUSCLE_LABELS[m].toLowerCase()))}.`);

  const push = total(PUSH);
  const pull = total(PULL);
  if (push + pull >= 12 && push >= 2 * pull) notes.push(`Pushing: ${push} sets, pulling: ${pull}, in four weeks. Rows or pull-ups would even it out.`);
  else if (push + pull >= 12 && pull >= 2 * push) notes.push(`Pulling: ${pull} sets, pushing: ${push}, in four weeks. Presses or push-ups would even it out.`);

  const legs = total(LEGS);
  const upper = total(UPPER);
  if (legs + upper >= 20 && legs * 3 < upper) notes.push(`Legs: ${legs} sets in four weeks, against ${upper} for your upper body.`);
  return notes;
}
