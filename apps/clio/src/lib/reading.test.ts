import { describe, expect, it } from "vitest";

import type { Reading, Text, Word } from "./model";
import { characterCount, nextText, pause, PAUSE_CAP_MS, readingState, STOPPED, takeSeconds, tick, wordsToMarkKnown, wordTokenCount } from "./reading";
import { wordBook, type BandOf } from "./words";

const BANDS: Record<string, number> = { 我: 1, 喜欢: 1, 吃: 1, 面条: 2, 地道: 4, 胡同: 5, 炸酱面: 6 };
const bandOf: BandOf = (word) => BANDS[word];

const word = (id: string, fields: Partial<Word> = {}): Word => ({
  id,
  updatedAt: 1,
  deleted: false,
  status: "new",
  saved: false,
  source: "tapped",
  context: null,
  card: null,
  ...fields,
});

// 我喜欢吃地道的炸酱面。胡同地道，老王。
const TEXT: Pick<Text, "sentences" | "glossary"> = {
  sentences: [
    { id: "s1", speaker: null, en: "", tokens: [{ t: "我", w: "我" }, { t: "喜欢", w: "喜欢" }, { t: "吃", w: "吃" }, { t: "地道", w: "地道" }, { t: "的" }, { t: "炸酱面", w: "炸酱面" }, { t: "。" }] },
    { id: "s2", speaker: null, en: "", tokens: [{ t: "胡同", w: "胡同" }, { t: "地道", w: "地道" }, { t: "，" }, { t: "老王", w: "老王" }, { t: "。" }] },
  ],
  glossary: { 老王: { pinyin: "Lǎo Wáng", defs: ["Old Wang"] } },
};

describe("finishing a text", () => {
  it("marks the new words you didn't tap, each once, in order", () => {
    expect(wordsToMarkKnown(TEXT, wordBook([]), bandOf, 3)).toEqual(["地道", "炸酱面", "胡同", "老王"]);
  });

  it("leaves every word with a record as it is, whatever it says", () => {
    const book = wordBook([word("地道", { status: "learning" }), word("胡同", { status: "ignored" }), word("老王", { status: "new", source: "marked" })]);
    expect(wordsToMarkKnown(TEXT, book, bandOf, 3)).toEqual(["炸酱面"]);
  });

  it("needs nothing for words known by their band, and goes by the level set", () => {
    expect(wordsToMarkKnown(TEXT, wordBook([]), bandOf, 5)).toEqual(["炸酱面", "老王"]);
    expect(wordsToMarkKnown(TEXT, wordBook([]), bandOf, 0)).toContain("我");
  });

  it("leaves the text's names alone: they count as known", () => {
    const named = { ...TEXT, glossary: { 老王: { pinyin: "Lǎo Wáng", defs: ["Old Wang"], name: true } } };
    expect(wordsToMarkKnown(named, wordBook([]), bandOf, 3)).toEqual(["地道", "炸酱面", "胡同"]);
  });

  it("treats a deleted record (an undone finish) as no record", () => {
    expect(wordsToMarkKnown(TEXT, wordBook([word("炸酱面", { status: "known", deleted: true })]), bandOf, 5)).toEqual(["炸酱面", "老王"]);
  });

  it("counts characters and word tokens", () => {
    expect(characterCount(TEXT)).toBe(16);
    expect(wordTokenCount(TEXT)).toBe(8);
  });
});

describe("where you are with a text", () => {
  const reading = (fields: Partial<Reading> = {}): Reading => ({ id: "t", updatedAt: 1, deleted: false, startedAt: 1, lastReadAt: 1, finishedAt: null, furthest: 0, quiz: null, ...fields });
  it("is unread, started or finished, and finished stays finished", () => {
    expect(readingState(undefined)).toBe("unread");
    expect(readingState(reading({ deleted: true }))).toBe("unread");
    expect(readingState(reading())).toBe("started");
    expect(readingState(reading({ finishedAt: 5, lastReadAt: 9 }))).toBe("finished");
  });
});

describe("choosing the next text", () => {
  const texts = [
    { id: "easy", createdAt: 5 },
    { id: "hard", createdAt: 4 },
    { id: "good", createdAt: 3 },
    { id: "fine", createdAt: 2 },
    { id: "done", createdAt: 1 },
  ];
  const shares: Record<string, number> = { easy: 1, hard: 0.7, good: 0.95, fine: 0.91, done: 0.95 };
  const share = (text: { id: string }) => shares[text.id]!;
  const readingOf = (lastReadAt: number, finishedAt: number | null = null) => ({ lastReadAt, finishedAt, deleted: false });

  it("carries on with the text you had open last", () => {
    const readings = new Map([
      ["hard", readingOf(10)],
      ["fine", readingOf(20)],
      ["done", readingOf(30, 30)],
    ]);
    expect(nextText(texts, readings, share)).toEqual({ text: texts[3], reason: "continue" });
  });

  it("else picks the unread text nearest the middle of the comfortable range", () => {
    const readings = new Map([["done", readingOf(30, 30)]]);
    expect(nextText(texts, readings, share)).toEqual({ text: texts[2], reason: "next" });
    expect(nextText(texts.filter((text) => text.id !== "good"), readings, share)?.text.id).toBe("fine");
  });

  it("with nothing comfortable, picks the nearest to the range; with nothing unread, nothing", () => {
    expect(nextText([texts[0]!, texts[1]!], new Map(), share)?.text.id).toBe("easy");
    expect(nextText([texts[4]!], new Map([["done", readingOf(30, 30)]]), share)).toBeNull();
  });

  it("breaks a tie with the newest", () => {
    expect(nextText([{ id: "a", createdAt: 1 }, { id: "b", createdAt: 2 }], new Map(), () => 0.95)?.text.id).toBe("b");
  });
});

describe("reading time", () => {
  it("counts the time between signs of life", () => {
    let clock = tick(STOPPED, 0);
    clock = tick(clock, 20_000);
    clock = tick(clock, 50_500);
    const [seconds, rest] = takeSeconds(clock);
    expect(seconds).toBe(50);
    expect(rest.ms).toBe(500);
  });

  it("counts a long pause only up to the cap, so a phone left open adds little", () => {
    let clock = tick(STOPPED, 0);
    clock = tick(clock, 60 * 60_000);
    expect(clock.ms).toBe(PAUSE_CAP_MS);
  });

  it("stops while the page is hidden, and starts again from the next sign of life", () => {
    let clock = tick(STOPPED, 0);
    clock = pause(clock, 10_000);
    expect(clock).toEqual({ last: null, ms: 10_000 });
    clock = tick(clock, 500_000);
    clock = tick(clock, 505_000);
    expect(clock.ms).toBe(15_000);
  });

  it("never counts time backwards (a clock set back)", () => {
    expect(tick(tick(STOPPED, 10_000), 5_000).ms).toBe(0);
  });
});
