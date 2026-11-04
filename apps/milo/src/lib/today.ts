import { formatRelativeDays } from "@atlas/ui/format";
import { todayReport, type TodayItem, type TodayReport } from "@atlas/ui/today";

import type { Workout, WorkoutSet } from "./model";
import { counts, weeklyTotals } from "./stats";
import { duration } from "./summary";

// Milo's answer to Atlas's Today (see @atlas/ui/today), from what the phone
// has synced: a workout going on now, today's finished ones, or else the
// last one. Milo has no schedule, so nothing is ever "due".

const day = (ms: number) => new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit" }).format(ms);
const daysAgo = (from: number, now: number) => Math.round((Date.parse(day(now)) - Date.parse(day(from))) / 86_400_000);
const plural = (n: number, one: string) => `${n} ${n === 1 ? one : `${one}s`}`;

export function miloToday(allWorkouts: Workout[], sets: WorkoutSet[], locale: string, now = Date.now()): TodayReport {
  const workouts = allWorkouts.filter((workout) => !workout.deleted).sort((a, b) => b.startedAt - a.startedAt);
  const active = workouts.find((workout) => workout.endedAt === null);
  const finished = workouts.filter((workout) => workout.endedAt !== null);
  const doneSets = (workout: Workout) => sets.filter((set) => set.workoutId === workout.id && counts(set)).length;
  const time = (ms: number) => new Intl.DateTimeFormat(locale, { hour: "numeric", minute: "2-digit" }).format(ms);

  const items: TodayItem[] = [];
  if (active) items.push({ title: active.name, detail: `Going on now, since ${time(active.startedAt)}`, href: "/workout", tone: "soon" });
  const today = finished.filter((workout) => day(workout.startedAt) === day(now));
  for (const workout of today) {
    items.push({
      title: workout.name,
      detail: [duration(workout), plural(doneSets(workout), "set")].filter(Boolean).join(", "),
      href: `/history?w=${encodeURIComponent(workout.id)}`,
      tone: "done",
    });
  }
  const last = finished[0];
  if (!active && today.length === 0 && last) {
    items.push({
      title: last.name,
      detail: `Last workout, ${formatRelativeDays(-daysAgo(last.startedAt, now), locale)}`,
      href: `/history?w=${encodeURIComponent(last.id)}`,
    });
  }

  const [week] = weeklyTotals(finished, sets, 1, now);
  const summary =
    week && week.workouts > 0
      ? `${plural(week.workouts, "workout")} and ${plural(week.sets, "set")} this week.`
      : "No workout yet this week.";
  return todayReport(summary, items);
}
