import { todayReport, type TodayItem, type TodayReport } from "@atlas/ui/today";

import { goalMet, minutesToGo, streak, totalsOn } from "./activity";
import { dayOf } from "./dates";
import type { Day, Reading, Settings, Text, Word } from "./model";
import { nextText, readingState } from "./reading";
import { coverage, dueWords, wordBook } from "./words";

// Clio's answer to Atlas's Today (see @atlas/ui/today), from what your
// devices have synced: the words due for review, the text you're in or the
// one to read next, and whether today's goal is met.

export type TodayRecords = {
  words: Word[];
  days: Day[];
  settings: Settings;
  /** Without these the answer leaves out the text. */
  texts?: Text[];
  readings?: Reading[];
};

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

export function clioToday(records: TodayRecords, now = Date.now()): TodayReport {
  const today = dayOf(now);
  const due = dueWords(records.words, now).length;
  const goal = records.settings.dailyGoal;
  const totals = totalsOn(records.days, today);
  const met = goalMet(totals, goal);
  const left = minutesToGo(totals, goal);
  const run = streak(records.days, today, goal);

  const items: TodayItem[] = [];
  if (due > 0) items.push({ title: `${plural(due, "word", "words")} to review`, detail: "Due now", href: "/review", tone: "soon" });

  // The text you're in, else the one nearest what you can read comfortably. The server has no
  // word lists, so each word's band comes from the text's own glossary, which has every word.
  const book = wordBook(records.words);
  const readings = new Map((records.readings ?? []).filter((reading) => !reading.deleted).map((reading) => [reading.id, reading]));
  const texts = (records.texts ?? []).filter((text) => !text.deleted);
  const pick = nextText(texts, readings, (text) => coverage(text, book, () => undefined, records.settings.assumedBand).share);
  if (pick) {
    const { text } = pick;
    const reading = readings.get(text.id);
    items.push({
      title: `${pick.reason === "continue" ? "Carry on" : "Read next"}: ${text.title.en}`,
      detail:
        pick.reason === "continue" && readingState(reading) === "started"
          ? `Sentence ${Math.min(text.sentences.length, (reading?.furthest ?? 0) + 1)} of ${text.sentences.length}`
          : `HSK ${text.band} · ${Math.floor(coverage(text, book, () => undefined, records.settings.assumedBand).share * 100)}% known`,
      href: `/read?t=${encodeURIComponent(text.id)}`,
    });
  }

  const goalLine = met ? (run > 1 ? `Goal met. ${plural(run, "day", "days")} in a row.` : "Goal met.") : `${plural(left, "minute", "minutes")} to go today.`;
  items.push(
    met
      ? { title: "Today's goal met", detail: run > 1 ? `${plural(run, "day", "days")} in a row` : `${Math.floor(totals.seconds / 60)} of ${goal} minutes`, href: "/", tone: "done" }
      : { title: `${plural(left, "minute", "minutes")} to go today`, detail: `Goal ${goal} minutes${run > 0 ? `, ${plural(run, "day", "days")} in a row so far` : ""}`, href: "/" },
  );

  return todayReport(due > 0 ? `${plural(due, "word", "words")} to review. ${goalLine}` : goalLine, items);
}
