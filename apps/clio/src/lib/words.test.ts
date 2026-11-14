import { describe, expect, it } from "vitest";

import type { Text, Word } from "./model";
import { coverage, dueWords, isKnown, namesIn, statusOf, wordBook, type BandOf } from "./words";

const BANDS: Record<string, number> = { 我: 1, 喜欢: 1, 吃: 1, 面条: 2, 味道: 3, 地道: 4, 胡同: 5 };
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

const text = (tokens: Text["sentences"][number]["tokens"], glossary: Text["glossary"] = {}): Pick<Text, "sentences" | "glossary"> => ({
  sentences: [{ id: "s1", speaker: null, en: "", tokens }],
  glossary,
});

describe("whether a word is known", () => {
  it("goes by its band when there's no record", () => {
    const book = wordBook([]);
    expect(isKnown("味道", book, bandOf)).toBe(true);
    expect(isKnown("地道", book, bandOf)).toBe(false);
    expect(isKnown("地道", book, bandOf, 4)).toBe(true);
    expect(isKnown("我", book, bandOf, 0)).toBe(false);
  });

  it("counts a word on no list as new", () => {
    expect(statusOf("王府井", wordBook([]), bandOf)).toBe("new");
  });

  it("lets a record override the band, either way", () => {
    const book = wordBook([word("吃", { status: "learning" }), word("胡同", { status: "known" })]);
    expect(statusOf("吃", book, bandOf)).toBe("learning");
    expect(isKnown("吃", book, bandOf)).toBe(false);
    expect(isKnown("胡同", book, bandOf)).toBe(true);
  });

  it("ignores deleted records", () => {
    expect(isKnown("吃", wordBook([word("吃", { status: "learning", deleted: true })]), bandOf)).toBe(true);
  });
});

describe("coverage", () => {
  const sample = text([{ t: "我", p: "wǒ", w: "我" }, { t: "喜欢", p: "xǐhuan", w: "喜欢" }, { t: "地道", p: "dìdao", w: "地道" }, { t: "的", p: "de", w: "的" }, { t: "面条", p: "miàntiáo", w: "面条" }, { t: "地道", p: "dìdao", w: "地道" }, { t: "。" }], {
    的: { pinyin: "de", defs: ["(possessive particle)"], band: 1 },
  });

  it("is the share of word tokens known, punctuation left out", () => {
    // 我 喜欢 的 面条 known (的 by the glossary's band), 地道 twice not.
    expect(coverage(sample, wordBook([]), bandOf)).toEqual({ known: 4, total: 6, share: 4 / 6, unknown: ["地道"] });
  });

  it("follows records", () => {
    const book = wordBook([word("地道", { status: "known" }), word("面条", { status: "learning" })]);
    expect(coverage(sample, book, bandOf)).toMatchObject({ known: 5, total: 6, unknown: ["面条"] });
  });

  it("leaves ignored words out", () => {
    expect(coverage(sample, wordBook([word("地道", { status: "ignored" })]), bandOf)).toMatchObject({ known: 4, total: 4, share: 1 });
  });

  it("is whole for a text with no words", () => {
    expect(coverage(text([{ t: "！" }]), wordBook([]), bandOf).share).toBe(1);
  });
});

describe("words due", () => {
  const card = (due: number) => ({ due, stability: 1, difficulty: 5, elapsedDays: 0, scheduledDays: 1, learningSteps: 0, reps: 1, lapses: 0, state: 2, lastReview: 0 });
  it("are the ones in review whose card has come due", () => {
    const words = [
      word("a", { status: "learning", card: card(100) }),
      word("b", { status: "learning", card: card(300) }),
      word("c", { status: "known", card: card(100) }),
      word("d", { status: "learning" }),
      word("e", { status: "learning", card: card(100), deleted: true }),
    ];
    // d is in review with no card yet: a new one, after the ones due.
    expect(dueWords(words, 200).map((w) => w.id)).toEqual(["a", "d"]);
    expect(dueWords(words, 200, 0).map((w) => w.id)).toEqual(["a"]);
  });

  it("put the most overdue first, then new cards oldest first, up to the allowance", () => {
    const fresh = (due: number) => ({ ...card(due), state: 0, reps: 0 });
    const words = [
      word("late", { status: "learning", card: card(150) }),
      word("later", { status: "learning", card: card(50) }),
      word("n2", { status: "learning", card: fresh(20) }),
      word("n1", { status: "learning", card: fresh(10) }),
      word("n3", { status: "learning", card: fresh(30) }),
      word("known", { status: "known", card: fresh(1) }),
    ];
    expect(dueWords(words, 200, 2).map((w) => w.id)).toEqual(["later", "late", "n1", "n2"]);
    // New cards don't wait for their due time: they're due from the start.
    expect(dueWords(words, 0, 5).map((w) => w.id)).toEqual(["n1", "n2", "n3"]);
  });
});

describe("names", () => {
  const story = text(
    [{ t: "李文", w: "李文" }, { t: "喜欢", w: "喜欢" }, { t: "胡同", w: "胡同" }],
    { 李文: { pinyin: "Lǐ Wén", defs: ["Li Wen"], name: true }, 喜欢: { pinyin: "xǐhuan", defs: ["to like"], band: 1 }, 胡同: { pinyin: "hútòng", defs: ["alley"], band: 5 } },
  );

  it("count as known with no record", () => {
    expect(statusOf("李文", wordBook([]), bandOf, 3, namesIn(story))).toBe("known");
    expect(statusOf("李文", wordBook([]), bandOf, 3)).toBe("new");
  });

  it("aren't new words in coverage", () => {
    const cover = coverage(story, wordBook([]), bandOf);
    expect(cover.unknown).toEqual(["胡同"]);
    expect(cover.known).toBe(2);
  });

  it("follow their record once there is one", () => {
    expect(statusOf("李文", wordBook([word("李文", { status: "learning" })]), bandOf, 3, namesIn(story))).toBe("learning");
    expect(coverage(story, wordBook([word("李文", { status: "ignored" })]), bandOf).total).toBe(2);
  });
});
