import { describe, expect, it } from "vitest";

import type { Text } from "@/lib/model";

import { faceFor, meaningLine } from "./face";

const text = (id: string, glossary: Text["glossary"], sentences: Text["sentences"]): Text => ({
  id,
  updatedAt: 1,
  deleted: false,
  kind: "story",
  band: 4,
  topic: "Rain",
  title: { zh: `标题${id}`, pinyin: "", en: "" },
  source: null,
  sentences,
  glossary,
  targetWords: [],
  notes: [],
  questions: [],
  audio: null,
  origin: "sample",
  createdAt: 1,
});

const rain = text("t1", { 伞: { pinyin: "sǎn", defs: ["umbrella"], band: 4 }, 带: { pinyin: "dài", defs: ["to bring"], band: 2 } }, [
  { id: "s1", speaker: null, en: "It rained.", tokens: [{ t: "下雨", w: "下雨" }, { t: "。" }] },
  { id: "s2", speaker: null, en: "She didn't bring an umbrella.", tokens: [{ t: "没", w: "没" }, { t: "带", w: "带" }, { t: "伞", w: "伞" }, { t: "。" }] },
]);
const shop = text("t2", { 伞: { pinyin: "sǎn", defs: ["umbrella (for sale)"], band: 4 } }, [
  { id: "s1", speaker: null, en: "Umbrellas here.", tokens: [{ t: "伞", w: "伞" }, { t: "在这儿", w: "在这儿" }] },
]);

const dictionary = (word: string) => (word === "地道" ? { pinyin: "dìdao", defs: ["authentic", "CL:个"] } : undefined);
const list = (word: string) => (word === "地道" || word === "胡同" ? { pinyin: word === "地道" ? "dìdao" : "hútòng", defs: word === "胡同" ? ["alley"] : ["genuine"] } : undefined);

describe("a card's face", () => {
  it("takes the meaning and sentence from the text it was met in", () => {
    const face = faceFor({ id: "伞", context: { textId: "t1", sentenceId: "s2" } }, [shop, rain]);
    expect(face).toMatchObject({ pinyin: "sǎn", defs: ["umbrella"], from: "context" });
    expect(face.sentence).toMatchObject({ en: "She didn't bring an umbrella.", at: [2], title: "标题t1" });
  });

  it("finds another text that has the word when it has no context", () => {
    const face = faceFor({ id: "伞", context: null }, [shop, rain]);
    expect(face).toMatchObject({ defs: ["umbrella (for sale)"], from: "text" });
    expect(face.sentence?.at).toEqual([0]);
  });

  it("falls back to the dictionary, then the HSK list", () => {
    expect(faceFor({ id: "地道", context: null }, [rain], { dictionary, list })).toMatchObject({ pinyin: "dìdao", from: "dictionary", sentence: null });
    expect(faceFor({ id: "地道", context: null }, [rain], { list })).toMatchObject({ defs: ["genuine"], from: "list" });
    expect(faceFor({ id: "胡同", context: null }, [], { dictionary, list })).toMatchObject({ defs: ["alley"], from: "list" });
  });

  it("says so when nothing has it", () => {
    expect(faceFor({ id: "龘", context: null }, [rain], { dictionary, list })).toMatchObject({ defs: [], from: "none", sentence: null });
  });

  it("finds the word's sentence when the one saved no longer has it", () => {
    const face = faceFor({ id: "伞", context: { textId: "t1", sentenceId: "s1" } }, [rain]);
    expect(face.sentence).toMatchObject({ en: "She didn't bring an umbrella.", at: [2] });
  });

  it("puts the meaning in one line, without measure words", () => {
    expect(meaningLine({ defs: ["authentic", "CL:个", "genuine", "real"] })).toBe("authentic; genuine");
  });
});
