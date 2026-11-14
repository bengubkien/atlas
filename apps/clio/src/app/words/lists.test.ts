import { describe, expect, it } from "vitest";

import { Dictionary } from "@/lib/dictionary";
import { HskList, type HskEntry } from "@/lib/hsk";
import type { Word } from "@/lib/model";
import { wordBook } from "@/lib/words";

import { bandProgress, bandRows, charactersOf, dueLabel, foundFrom, planMark, planMarks, searchHsk, tabCounts, wordsContaining, yourWords } from "./lists";

const entry = (word: string, pinyin: string, band: HskEntry["band"], gloss?: string): HskEntry => ({ word, pinyin, band, gloss });
const hsk = new HskList([
  entry("你好", "nǐ hǎo", 1, "hello"),
  entry("图书馆", "tú shū guǎn", 3, "library"),
  entry("书", "shū", 1, "book"),
  entry("图书", "tú shū", 4, "books"),
  entry("看书", "kàn shū", 2, "to read"),
  entry("书店", "shū diàn", 2, "bookstore"),
  entry("地道", "dì dao", 4, "authentic"),
  entry("胡同", "hú tòng", 5, "alley"),
  entry("敬业", "jìng yè", 7),
]);

const word = (id: string, fields: Partial<Word> = {}): Word => ({
  id,
  updatedAt: 1,
  deleted: false,
  status: "new",
  saved: false,
  source: "marked",
  context: null,
  card: null,
  ...fields,
});
const card = (due: number): NonNullable<Word["card"]> => ({ due, stability: 1, difficulty: 1, elapsedDays: 0, scheduledDays: 1, learningSteps: 0, reps: 1, lapses: 0, state: 2, lastReview: null });

describe("progress by band", () => {
  it("counts a band's words as known up to the assumed band, with no records", () => {
    const rows = bandProgress(hsk, wordBook([]), 3);
    expect(rows.find((r) => r.band === 1)).toEqual({ band: 1, known: 2, total: 2 });
    expect(rows.find((r) => r.band === 3)).toEqual({ band: 3, known: 1, total: 1 });
    expect(rows.find((r) => r.band === 4)).toEqual({ band: 4, known: 0, total: 2 });
    expect(rows.find((r) => r.band === 7)).toEqual({ band: 7, known: 0, total: 1 });
  });

  it("lets a record decide, either way, and leaves ignored words out of the known", () => {
    const book = wordBook([word("地道", { status: "known" }), word("书", { status: "learning" }), word("你好", { status: "ignored" })]);
    const rows = bandProgress(hsk, book, 3);
    expect(rows.find((r) => r.band === 4)?.known).toBe(1);
    expect(rows.find((r) => r.band === 1)).toEqual({ band: 1, known: 0, total: 2 });
  });

  it("knows nothing without bands assumed", () => {
    expect(bandProgress(hsk, wordBook([]), 0).every((r) => r.known === 0)).toBe(true);
  });
});

describe("your words", () => {
  const words = [
    word("a", { status: "learning", card: card(3000), updatedAt: 5 }),
    word("b", { status: "learning", card: card(1000), updatedAt: 1 }),
    word("c", { status: "learning", updatedAt: 9 }),
    word("d", { status: "new", saved: true, updatedAt: 8 }),
    word("e", { status: "new", updatedAt: 7 }),
    word("f", { status: "known", updatedAt: 2 }),
    word("g", { status: "known", updatedAt: 6 }),
    word("h", { status: "ignored" }),
    word("i", { status: "known", deleted: true }),
  ];

  it("lists learning by what's due first, then the rest by newest", () => {
    expect(yourWords(words, "learning").map((w) => w.id)).toEqual(["b", "a", "c", "d"]);
  });

  it("lists known and ignored by newest, and skips deleted and unmarked ones", () => {
    expect(yourWords(words, "known").map((w) => w.id)).toEqual(["g", "f"]);
    expect(yourWords(words, "ignored").map((w) => w.id)).toEqual(["h"]);
  });

  it("counts for the tabs", () => {
    expect(tabCounts(words)).toEqual({ learning: 4, known: 2, ignored: 1 });
  });
});

describe("when a word is due", () => {
  const now = 1_000_000_000;
  it("says it in words", () => {
    expect(dueLabel(null, now)).toBeNull();
    expect(dueLabel({ due: now - 5 }, now)).toBe("Due now");
    expect(dueLabel({ due: now + 10 * 60_000 }, now)).toBe("Due in under an hour");
    expect(dueLabel({ due: now + 5 * 3_600_000 }, now)).toBe("Due in 5 hours");
    expect(dueLabel({ due: now + 26 * 3_600_000 }, now)).toBe("Due tomorrow");
    expect(dueLabel({ due: now + 23.8 * 3_600_000 }, now)).toBe("Due tomorrow");
    expect(dueLabel({ due: now + 3 * 86_400_000 }, now)).toBe("Due in 3 days");
  });
});

describe("browsing a band", () => {
  it("lists a band's words with their status, and filters", () => {
    const book = wordBook([word("地道", { status: "known" })]);
    expect(bandRows(hsk, 4, book, 3).map((r) => [r.entry.word, r.status])).toEqual([
      ["图书", "new"],
      ["地道", "known"],
    ]);
    expect(bandRows(hsk, 4, book, 3, "known").map((r) => r.entry.word)).toEqual(["地道"]);
    expect(bandRows(hsk, 4, book, 3, "todo").map((r) => r.entry.word)).toEqual(["图书"]);
    expect(bandRows(hsk, 1, book, 3, "todo")).toEqual([]);
  });
});

describe("marking words", () => {
  it("sets known and learning straight away", () => {
    expect(planMark("known", undefined, "new")).toEqual({ set: "known" });
    expect(planMark("learning", word("x"), "known")).toEqual({ set: "learning" });
  });

  it("forgets a word to make it new when its band says new and nothing is worth keeping", () => {
    expect(planMark("new", word("x", { status: "known" }), "new")).toBe("forget");
    expect(planMark("new", word("x", { status: "learning", card: card(1) }), "new")).toEqual({ set: "new" });
    expect(planMark("new", word("x", { saved: true }), "new")).toEqual({ set: "new" });
  });

  it("writes a record to make a word of an assumed band new", () => {
    expect(planMark("new", undefined, "known")).toEqual({ set: "new" });
  });

  it("splits many words, skipping forgets of words with no record", () => {
    const bands: Record<string, number> = { 书: 1, 地道: 4, 胡同: 5 };
    const book = new Map([["地道", word("地道", { status: "known" })]]);
    expect(planMarks(["书", "地道", "胡同"], "new", book, (w) => bands[w], 3)).toEqual({ set: ["书"], forget: ["地道"] });
    expect(planMarks(["地道", "胡同"], "known", book, (w) => bands[w], 3)).toEqual({ set: ["地道", "胡同"], forget: [] });
  });
});

describe("searching the HSK list", () => {
  it("finds words by characters, exact first", () => {
    expect(searchHsk(hsk, "图书").map((f) => f.word)).toEqual(["图书", "图书馆"]);
  });

  it("finds by pinyin with or without tones and spaces", () => {
    expect(searchHsk(hsk, "nihao").map((f) => f.word)).toEqual(["你好"]);
    expect(searchHsk(hsk, "nǐ hǎo")[0]?.word).toBe("你好");
    expect(searchHsk(hsk, "tushu")[0]).toMatchObject({ word: "图书", match: "pinyin" });
  });

  it("puts a whole syllable ahead of a longer one it starts", () => {
    expect(searchHsk(hsk, "shu").map((f) => f.word).slice(0, 2)).toEqual(["书", "书店"]);
  });

  it("finds by English, and says nothing for an empty or unknown query", () => {
    expect(searchHsk(hsk, "library")[0]).toMatchObject({ word: "图书馆", match: "english", gloss: "library" });
    expect(searchHsk(hsk, "  ")).toEqual([]);
    expect(searchHsk(hsk, "zzzz")).toEqual([]);
  });

  it("honours the limit", () => {
    expect(searchHsk(hsk, "shu", 2)).toHaveLength(2);
  });
});

describe("dictionary results as rows", () => {
  const dictionary = Dictionary.fromJson({ entries: { 图书馆: [["Tú shū guǎn", "Tushuguan (a name)"], ["tú shū guǎn", "library", "CL:家[jiā]", "reading room", "third"]] } }, { hsk });

  it("leads with the everyday reading and a short gloss", () => {
    const [result] = dictionary.search("library");
    expect(foundFrom(result!)).toEqual({ word: "图书馆", pinyin: "tú shū guǎn", gloss: "library; reading room", band: 3, match: "english" });
  });
});

describe("a word's detail", () => {
  it("lists the characters a word is made of", () => {
    expect(charactersOf("图书馆")).toEqual(["图", "书", "馆"]);
    expect(charactersOf("爸爸")).toEqual(["爸"]);
    expect(charactersOf("书")).toEqual([]);
  });

  it("finds other words that contain it, lower bands first", () => {
    expect(wordsContaining(hsk, "书").map((e) => e.word)).toEqual(["书店", "看书", "图书馆", "图书"]);
    expect(wordsContaining(hsk, "书", 2)).toHaveLength(2);
    expect(wordsContaining(hsk, "你好")).toEqual([]);
  });
});
