import { describe, expect, it } from "vitest";

import { streak } from "./activity";
import { DEFAULT_SETTINGS, dayId, type Day, type Reading, type Word } from "./model";
import { SAMPLE_TEXTS } from "./samples";
import { clioToday } from "./today";

const at = (date: string, time: string) => new Date(`${date}T${time}:00`).getTime();
const noon = at("2026-11-11", "12:00");

const day = (date: string, device: string, seconds: number): Day => ({
  id: dayId(date, device),
  updatedAt: 1,
  deleted: false,
  date,
  device,
  seconds,
  reviews: 0,
  textsFinished: 0,
  wordsRead: 0,
});

const due = (id: string, when: number): Word => ({
  id,
  updatedAt: 1,
  deleted: false,
  status: "learning",
  saved: true,
  source: "tapped",
  context: null,
  card: { due: when, stability: 1, difficulty: 5, elapsedDays: 0, scheduledDays: 1, learningSteps: 0, reps: 1, lapses: 0, state: 2, lastReview: null },
});

const reading = (id: string, furthest: number, lastReadAt: number, finishedAt: number | null = null): Reading => ({ id, updatedAt: 1, deleted: false, startedAt: lastReadAt, lastReadAt, finishedAt, furthest, quiz: null });

describe("Clio's answer to Atlas's Today", () => {
  it("says what's left of the goal when there's nothing else", () => {
    const report = clioToday({ words: [], days: [], settings: DEFAULT_SETTINGS }, noon);
    expect(report.summary).toBe("10 minutes to go today.");
    expect(report.items).toEqual([{ title: "10 minutes to go today", detail: "Goal 10 minutes", href: "/" }]);
  });

  it("counts the words due, not the ones due later", () => {
    const report = clioToday({ words: [due("学习", noon - 1), due("地道", noon - 60_000), due("胡同", noon + 3_600_000)], days: [], settings: DEFAULT_SETTINGS }, noon);
    expect(report.summary).toBe("2 words to review. 10 minutes to go today.");
    expect(report.items[0]).toEqual({ title: "2 words to review", detail: "Due now", href: "/review", tone: "soon" });
  });

  it("adds up the day over devices for the goal, and counts the streak", () => {
    const days = [day("2026-11-11", "phone", 7 * 60), day("2026-11-11", "laptop", 4 * 60), day("2026-11-10", "phone", 600)];
    const report = clioToday({ words: [], days, settings: DEFAULT_SETTINGS }, noon);
    expect(report.summary).toBe("Goal met. 2 days in a row.");
    expect(report.items).toEqual([{ title: "Today's goal met", detail: "2 days in a row", href: "/", tone: "done" }]);
  });

  it("says the minutes to go, rounded up, with the streak it keeps", () => {
    const days = [day("2026-11-10", "phone", 600), day("2026-11-11", "phone", 2 * 60 + 5)];
    const report = clioToday({ words: [], days, settings: DEFAULT_SETTINGS }, noon);
    expect(report.summary).toBe("8 minutes to go today.");
    expect(report.items.at(-1)).toEqual({ title: "8 minutes to go today", detail: "Goal 10 minutes, 1 day in a row so far", href: "/" });
  });

  it("points at the text you're in, with where you are", () => {
    const texts = SAMPLE_TEXTS.slice(0, 3);
    const report = clioToday({ words: [], days: [], settings: DEFAULT_SETTINGS, texts, readings: [reading(texts[1]!.id, 3, noon - 1000), reading(texts[0]!.id, 5, noon - 9000, noon - 8000)] }, noon);
    expect(report.items[0]).toEqual({
      title: `Carry on: ${texts[1]!.title.en}`,
      detail: `Sentence 4 of ${texts[1]!.sentences.length}`,
      href: `/read?t=${encodeURIComponent(texts[1]!.id)}`,
    });
  });

  it("else suggests the next one, and says nothing when every text is read", () => {
    const texts = SAMPLE_TEXTS.slice(0, 2);
    const report = clioToday({ words: [], days: [], settings: DEFAULT_SETTINGS, texts }, noon);
    expect(report.items[0]!.title).toMatch(/^Read next: /);
    expect(report.items[0]!.detail).toMatch(/^HSK \d · \d+% known$/);
    const all = texts.map((text) => reading(text.id, 5, noon - 5000, noon - 4000));
    expect(clioToday({ words: [], days: [], settings: DEFAULT_SETTINGS, texts, readings: all }, noon).items).toHaveLength(1);
  });

  it("keeps reviews, the text and the goal in that order", () => {
    const report = clioToday({ words: [due("学习", noon - 1)], days: [], settings: DEFAULT_SETTINGS, texts: SAMPLE_TEXTS.slice(0, 1) }, noon);
    expect(report.items.map((item) => item.href.split("?")[0])).toEqual(["/review", "/read", "/"]);
  });
});

describe("the streak", () => {
  const days = [day("2026-11-08", "a", 600), day("2026-11-09", "a", 600), day("2026-11-10", "a", 300), day("2026-11-10", "b", 300)];

  it("counts days in a row with the goal met, summing devices", () => {
    expect(streak(days, "2026-11-10", 10)).toBe(3);
  });

  it("isn't broken by today, until today is over", () => {
    expect(streak(days, "2026-11-11", 10)).toBe(3);
    expect(streak(days, "2026-11-12", 10)).toBe(0);
  });

  it("follows the goal as it is now", () => {
    expect(streak(days, "2026-11-10", 15)).toBe(0);
    expect(streak(days, "2026-11-10", 5)).toBe(3);
  });

  it("stops at a gap", () => {
    expect(streak([...days, day("2026-11-06", "a", 900)], "2026-11-10", 10)).toBe(3);
  });

  it("starts at today when today is met", () => {
    expect(streak([...days, day("2026-11-11", "a", 600)], "2026-11-11", 10)).toBe(4);
  });

  it("is zero with no days, and ends with a goal of zero", () => {
    expect(streak([], "2026-11-10", 10)).toBe(0);
    expect(streak(days, "2026-11-10", 0)).toBe(3);
  });
});
