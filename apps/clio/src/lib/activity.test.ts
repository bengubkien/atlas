import { describe, expect, it } from "vitest";

import { goalMet, lastDays, longestStreak, minutesToGo, streak, streakLines, totalsOn } from "./activity";
import { dayOf } from "./dates";
import { dayId, type Day } from "./model";

const day = (date: string, device: string, seconds: number, more: Partial<Day> = {}): Day => ({
  id: dayId(date, device),
  updatedAt: 1,
  deleted: false,
  date,
  device,
  seconds,
  reviews: 0,
  textsFinished: 0,
  wordsRead: 0,
  ...more,
});

describe("a day's totals", () => {
  it("sums devices and leaves out deleted records", () => {
    const days = [day("2026-11-11", "a", 100, { reviews: 2 }), day("2026-11-11", "b", 50, { wordsRead: 30 }), day("2026-11-11", "c", 999, { deleted: true })];
    expect(totalsOn(days, "2026-11-11")).toEqual({ seconds: 150, reviews: 2, textsFinished: 0, wordsRead: 30 });
    expect(totalsOn(days, "2026-11-12")).toEqual({ seconds: 0, reviews: 0, textsFinished: 0, wordsRead: 0 });
  });

  it("meets the goal at exactly the minutes, not a second less", () => {
    expect(goalMet({ seconds: 599, reviews: 0, textsFinished: 0, wordsRead: 0 }, 10)).toBe(false);
    expect(goalMet({ seconds: 600, reviews: 0, textsFinished: 0, wordsRead: 0 }, 10)).toBe(true);
  });

  it("says the minutes to go, rounded up", () => {
    const at = (seconds: number) => ({ seconds, reviews: 0, textsFinished: 0, wordsRead: 0 });
    expect(minutesToGo(at(0), 10)).toBe(10);
    expect(minutesToGo(at(541), 10)).toBe(1);
    expect(minutesToGo(at(9999), 10)).toBe(0);
  });
});

describe("days are the device's local days", () => {
  it("puts 23:59 and 00:01 on different days, whatever the zone's offset", () => {
    const before = new Date(2026, 10, 10, 23, 59).getTime();
    const after = new Date(2026, 10, 11, 0, 1).getTime();
    expect(dayOf(before)).toBe("2026-11-10");
    expect(dayOf(after)).toBe("2026-11-11");
  });

  it("walks back over a month end and a clock change without losing a day", () => {
    const days = ["2026-10-30", "2026-10-31", "2026-11-01", "2026-11-02"].map((date) => day(date, "a", 600));
    expect(streak(days, "2026-11-02", 10)).toBe(4);
  });
});

describe("the longest streak", () => {
  it("finds the longest run, not the latest", () => {
    const days = ["2026-10-01", "2026-10-02", "2026-10-03", "2026-10-05", "2026-10-06"].map((date) => day(date, "a", 600));
    expect(longestStreak(days, 10)).toBe(3);
    expect(longestStreak(days, 11)).toBe(0);
    expect(longestStreak([], 10)).toBe(0);
  });

  it("counts two devices' halves of a day as one met day", () => {
    const days = [day("2026-10-01", "a", 300), day("2026-10-01", "b", 300), day("2026-10-02", "a", 600)];
    expect(longestStreak(days, 10)).toBe(2);
  });
});

describe("the last days", () => {
  it("lists them oldest first, as met, partly or nothing", () => {
    const days = [day("2026-11-09", "a", 600), day("2026-11-10", "a", 0, { reviews: 3 }), day("2026-11-11", "a", 120)];
    const week = lastDays(days, "2026-11-11", 7, 10);
    expect(week.map((d) => d.date)).toEqual(["2026-11-05", "2026-11-06", "2026-11-07", "2026-11-08", "2026-11-09", "2026-11-10", "2026-11-11"]);
    expect(week.map((d) => d.standing)).toEqual(["none", "none", "none", "none", "met", "partly", "partly"]);
    expect(week.at(-1)).toMatchObject({ minutes: 2, seconds: 120 });
  });
});

describe("the words for it", () => {
  it("speaks plainly", () => {
    expect(streakLines(4, false, 6)).toEqual({ streak: "4 days in a row.", next: "Read for 6 more minutes to keep it." });
    expect(streakLines(1, true, 0)).toEqual({ streak: "1 day in a row.", next: null });
    expect(streakLines(0, false, 1)).toEqual({ streak: "No streak yet.", next: "Read for 1 more minute to start one." });
  });
});
