import type { Unit, Workout, WorkoutSet } from "./model";
import { counts, volumeKg } from "./stats";
import { fromKg } from "./units";

/** "52 min", "1 h 05 min": how long a workout took. */
export function duration(workout: Workout): string | null {
  if (workout.endedAt === null) return null;
  const minutes = Math.max(1, Math.round((workout.endedAt - workout.startedAt) / 60_000));
  return minutes < 60 ? `${minutes} min` : `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, "0")} min`;
}

/** "12 sets · 4,250 kg": what a workout added up to. */
export function workoutTotals(sets: WorkoutSet[], unit: Unit, locale: string): string {
  const done = sets.filter(counts);
  const volume = volumeKg(done);
  const parts = [`${done.length} ${done.length === 1 ? "set" : "sets"}`];
  if (volume > 0) parts.push(`${new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(fromKg(volume, unit))} ${unit}`);
  return parts.join(" · ");
}
