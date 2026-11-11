import { describe, expect, it } from "vitest";

import { DEFAULT_SETTINGS, SCHEMAS, textSchema } from "./model";

// A text as the server or a sample would write it.
const sample = {
  id: "sample-noodles",
  updatedAt: 1,
  kind: "story",
  band: 3,
  topic: "Food",
  title: { zh: "一碗面条", pinyin: "yì wǎn miàntiáo", en: "A bowl of noodles" },
  sentences: [
    {
      id: "s1",
      en: "I like noodles.",
      tokens: [{ t: "我", p: "wǒ", w: "我" }, { t: "喜欢", p: "xǐhuan", w: "喜欢" }, { t: "面条", p: "miàntiáo", w: "面条" }, { t: "。" }],
    },
  ],
  glossary: { 面条: { pinyin: "miàntiáo", defs: ["noodles"], band: 2 } },
  questions: [{ question: "What does the writer like?", options: ["Rice", "Noodles"], answer: 1 }],
  origin: "sample",
  createdAt: 1_700_000_000_000,
};

describe("a text", () => {
  it("parses with its defaults filled in", () => {
    const text = textSchema.parse(sample);
    expect(text.deleted).toBe(false);
    expect(text.sentences[0]!.speaker).toBeNull();
    expect(text.source).toBeNull();
    expect(text.audio).toBeNull();
    expect(text.notes).toEqual([]);
    expect(text.questions[0]!.lang).toBe("en");
    // Punctuation keeps only its text.
    expect(text.sentences[0]!.tokens[3]).toEqual({ t: "。" });
  });

  it("refuses an answer that isn't one of the options", () => {
    expect(textSchema.safeParse({ ...sample, questions: [{ question: "?", options: ["a", "b"], answer: 2 }] }).success).toBe(false);
  });

  it("is a synced kind", () => {
    expect(Object.keys(SCHEMAS)).toContain("text");
  });
});

describe("the settings", () => {
  it("start where the user is: bands 1 to 3 known, pinyin over new words", () => {
    expect(DEFAULT_SETTINGS).toMatchObject({ pinyin: "unknown", assumedBand: 3, dailyGoal: 10, topics: ["daily", "news", "culture"], showTranslation: false });
  });
});
