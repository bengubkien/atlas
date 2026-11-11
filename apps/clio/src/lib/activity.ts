import { addDays } from "./dates";
import type { Day } from "./model";

// The daily goal and the streak, from the `day` records. Each device keeps
// its own record per day (model.ts says why), so a day's numbers are the
// sum over its devices.

export type DayTotals = Pick<Day, "seconds" | "reviews" | "textsFinished" | "wordsRead">;

const EMPTY: DayTotals = { seconds: 0, reviews: 0, textsFinished: 0, wordsRead: 0 };

/** Each date's totals, over every device. */
export function totalsByDate(days: readonly Day[]): Map<string, DayTotals> {
  const totals = new Map<string, DayTotals>();
  for (const day of days) {
    if (day.deleted) continue;
    const sum = totals.get(day.date) ?? { ...EMPTY };
    sum.seconds += day.seconds;
    sum.reviews += day.reviews;
    sum.textsFinished += day.textsFinished;
    sum.wordsRead += day.wordsRead;
    totals.set(day.date, sum);
  }
  return totals;
}

export const totalsOn = (days: readonly Day[], date: string): DayTotals => totalsByDate(days).get(date) ?? { ...EMPTY };

/** Whether a day's time reached the goal (in minutes). */
export const goalMet = (totals: DayTotals, goalMinutes: number) => totals.seconds >= goalMinutes * 60;

/**
 * Days in a row the goal was met, up to today. Today not met yet doesn't
 * break it (the day isn't over): the streak then counts back from yesterday.
 * A day is judged by the goal as it is now: raising the goal can end a
 * streak that the old goal kept, and lowering it can lengthen one.
 */
export function streak(days: readonly Day[], today: string, goalMinutes: number): number {
  const totals = totalsByDate(days);
  const met = (date: string) => goalMet(totals.get(date) ?? EMPTY, goalMinutes);
  // Nothing is met before the first day with a record, which also ends the
  // walk if a goal of zero or less would otherwise meet every day.
  const first = [...totals.keys()].sort()[0];
  if (first === undefined) return 0;
  let date = met(today) ? today : addDays(today, -1);
  let count = 0;
  while (date >= first && met(date)) {
    count++;
    date = addDays(date, -1);
  }
  return count;
}

/** The longest run of days in a row with the goal met, ever. */
export function longestStreak(days: readonly Day[], goalMinutes: number): number {
  const totals = totalsByDate(days);
  const met = [...totals.entries()].filter(([, day]) => goalMet(day, goalMinutes)).map(([date]) => date).sort();
  let best = 0;
  let run = 0;
  let previous: string | null = null;
  for (const date of met) {
    run = previous !== null && addDays(previous, 1) === date ? run + 1 : 1;
    best = Math.max(best, run);
    previous = date;
  }
  return best;
}

/** met: the goal reached. partly: something done, short of it. none: nothing. */
export type DayStanding = "met" | "partly" | "none";

export type DaySummary = { date: string; minutes: number; seconds: number; standing: DayStanding };

/** The last `count` days up to and including `today`, oldest first. */
export function lastDays(days: readonly Day[], today: string, count: number, goalMinutes: number): DaySummary[] {
  const totals = totalsByDate(days);
  return Array.from({ length: count }, (_, i) => {
    const date = addDays(today, i + 1 - count);
    const day = totals.get(date) ?? EMPTY;
    const did = day.seconds > 0 || day.reviews > 0 || day.textsFinished > 0;
    return { date, seconds: day.seconds, minutes: Math.floor(day.seconds / 60), standing: goalMet(day, goalMinutes) ? "met" : did ? "partly" : "none" };
  });
}

/** Whole minutes still to go to meet the goal today, rounded up; 0 once met. */
export const minutesToGo = (totals: DayTotals, goalMinutes: number) => Math.max(0, Math.ceil((goalMinutes * 60 - totals.seconds) / 60));

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

/** "4 days in a row." and, while today's goal isn't met, what keeps or starts it: "Read for 6 more minutes to keep it." */
export function streakLines(run: number, met: boolean, minutesLeft: number): { streak: string; next: string | null } {
  const next = met ? null : `Read for ${plural(minutesLeft, "more minute", "more minutes")} to ${run > 0 ? "keep it" : "start one"}.`;
  return { streak: run > 0 ? `${plural(run, "day", "days")} in a row.` : "No streak yet.", next };
}
