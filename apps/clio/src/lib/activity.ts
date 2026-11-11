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
 */
export function streak(days: readonly Day[], today: string, goalMinutes: number): number {
  const totals = totalsByDate(days);
  const met = (date: string) => goalMet(totals.get(date) ?? EMPTY, goalMinutes);
  let date = met(today) ? today : addDays(today, -1);
  let count = 0;
  while (met(date)) {
    count++;
    date = addDays(date, -1);
  }
  return count;
}
