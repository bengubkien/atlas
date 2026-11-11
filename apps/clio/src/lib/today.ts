import { todayReport, type TodayItem, type TodayReport } from "@atlas/ui/today";

import { goalMet, streak, totalsOn } from "./activity";
import { dayOf } from "./dates";
import type { Day, Settings, Word } from "./model";
import { dueWords } from "./words";

// Clio's answer to Atlas's Today (see @atlas/ui/today), from what your
// devices have synced: the words due for review, and whether today's goal
// is met.

export type TodayRecords = {
  words: Word[];
  days: Day[];
  settings: Settings;
};

export function clioToday(records: TodayRecords, now = Date.now()): TodayReport {
  const today = dayOf(now);
  const due = dueWords(records.words, now).length;
  const goal = records.settings.dailyGoal;
  const minutes = Math.floor(totalsOn(records.days, today).seconds / 60);
  const met = goalMet(totalsOn(records.days, today), goal);
  const run = streak(records.days, today, goal);
  const words = (count: number) => `${count} ${count === 1 ? "word" : "words"}`;
  const days = (count: number) => `${count} ${count === 1 ? "day" : "days"}`;

  const items: TodayItem[] = [];
  if (due > 0) items.push({ title: `${words(due)} to review`, detail: "Due now", href: "/review", tone: "soon" });
  items.push(
    met
      ? { title: "Today's goal met", detail: run > 1 ? `${days(run)} in a row` : `${minutes} of ${goal} minutes`, href: "/", tone: "done" }
      : { title: "Today's goal", detail: `${minutes} of ${goal} minutes${run > 0 ? `, ${days(run)} in a row so far` : ""}`, href: "/" },
  );

  const summary =
    due > 0
      ? `${words(due)} to review.`
      : met
        ? "Nothing to review, and today's goal is met."
        : "Nothing to review.";
  return todayReport(summary, items);
}
