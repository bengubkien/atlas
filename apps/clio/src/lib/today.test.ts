import { describe, expect, it } from "vitest";

import { streak } from "./activity";
import { DEFAULT_SETTINGS, dayId, type Day, type Word } from "./model";
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

describe("Clio's answer to Atlas's Today", () => {
  it("says when there's nothing", () => {
    const report = clioToday({ words: [], days: [], settings: DEFAULT_SETTINGS }, noon);
    expect(report.summary).toBe("Nothing to review.");
    expect(report.items).toEqual([{ title: "Today's goal", detail: "0 of 10 minutes", href: "/" }]);
  });

  it("counts the words due, not the ones due later", () => {
    const report = clioToday({ words: [due("学习", noon - 1), due("地道", noon - 60_000), due("胡同", noon + 3_600_000)], days: [], settings: DEFAULT_SETTINGS }, noon);
    expect(report.summary).toBe("2 words to review.");
    expect(report.items[0]).toEqual({ title: "2 words to review", detail: "Due now", href: "/review", tone: "soon" });
  });

  it("adds up the day over devices for the goal", () => {
    const days = [day("2026-11-11", "phone", 7 * 60), day("2026-11-11", "laptop", 4 * 60), day("2026-11-10", "phone", 600)];
    const report = clioToday({ words: [], days, settings: DEFAULT_SETTINGS }, noon);
    expect(report.summary).toBe("Nothing to review, and today's goal is met.");
    expect(report.items).toEqual([{ title: "Today's goal met", detail: "2 days in a row", href: "/", tone: "done" }]);
  });
});

describe("the streak", () => {
  const days = [day("2026-11-08", "a", 600), day("2026-11-09", "a", 600), day("2026-11-10", "a", 300), day("2026-11-10", "b", 300)];

  it("counts days in a row with the goal met", () => {
    expect(streak(days, "2026-11-10", 10)).toBe(3);
  });

  it("isn't broken by today, until today is over", () => {
    expect(streak(days, "2026-11-11", 10)).toBe(3);
    expect(streak(days, "2026-11-12", 10)).toBe(0);
  });

  it("follows the goal", () => {
    expect(streak(days, "2026-11-10", 15)).toBe(0);
  });
});
