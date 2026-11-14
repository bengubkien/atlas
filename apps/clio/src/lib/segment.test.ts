import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { fromJson as dictFromJson, type DictionaryData } from "./dictionary";
import { fromJson as hskFromJson, type HskData } from "./hsk";
import { segment, wordsOf } from "./segment";

// Small word lists for exact, readable cases.
const tiny = {
  dictionary: { has: (w: string) => ["我", "今天", "想", "去", "图书馆", "看书", "看", "书", "中文", "北京大学", "北京", "大学", "学习", "他们", "在"].includes(w) },
};
const texts = (s: string) => segment(s, tiny).map((t) => t.text);

describe("segment (small list)", () => {
  it("takes the longest word", () => {
    expect(texts("我今天想去图书馆看书。")).toEqual(["我", "今天", "想", "去", "图书馆", "看书", "。"]);
    expect(texts("北京大学")).toEqual(["北京大学"]);
  });

  it("falls back to shorter words", () => {
    expect(texts("北京大")).toEqual(["北京", "大"]);
  });

  it("marks characters nobody knows", () => {
    const t = segment("我鬱", tiny);
    expect(t.map((x) => [x.text, x.kind])).toEqual([["我", "word"], ["鬱", "unknown"]]);
  });

  it("keeps Latin runs, numbers and punctuation as their own tokens", () => {
    const t = segment("我用iPhone15花了3.5万, don't 去！", tiny);
    expect(t.map((x) => [x.text, x.kind])).toEqual([
      ["我", "word"],
      ["用", "unknown"],
      ["iPhone15", "latin"],
      ["花", "unknown"],
      ["了", "unknown"],
      ["3.5", "latin"],
      ["万", "unknown"],
      [",", "punct"],
      [" ", "space"],
      ["don't", "latin"],
      [" ", "space"],
      ["去", "word"],
      ["！", "punct"],
    ]);
  });

  it("keeps runs of spaces and line breaks together", () => {
    expect(segment("我 \n\n去", tiny).map((x) => x.kind)).toEqual(["word", "space", "word"]);
  });

  it("handles fullwidth letters, quotes and symbols", () => {
    const t = segment("「我」ＡＢＣ１２３ ¥5 😀", tiny);
    expect(t.map((x) => [x.text, x.kind])).toEqual([
      ["「", "punct"],
      ["我", "word"],
      ["」", "punct"],
      ["ＡＢＣ１２３", "latin"],
      [" ", "space"],
      ["¥", "punct"],
      ["5", "latin"],
      [" ", "space"],
      ["😀", "punct"],
    ]);
  });

  it("puts other scripts one character each", () => {
    expect(segment("日本のひらがな", tiny).map((x) => x.kind)).toContain("other");
  });

  it("joins back to the input exactly", () => {
    for (const s of ["", "我今天想去图书馆看书。", "a b  c\n我\t去 , 😀 x-y 3.5.", "他们在北京大学学习中文"]) {
      expect(segment(s, tiny).map((t) => t.text).join("")).toBe(s);
    }
  });

  it("returns nothing for empty text", () => {
    expect(segment("", tiny)).toEqual([]);
  });

  it("limits word length", () => {
    const long = { dictionary: { has: (w: string) => w === "一二三四五" || w === "一二" || w === "三四五" } };
    expect(segment("一二三四五", long, { maxWordLength: 4 }).map((t) => t.text)).toEqual(["一二", "三四五"]);
    expect(segment("一二三四五", long).map((t) => t.text)).toEqual(["一二三四五"]);
  });

  it("works with only an HSK list, and reports bands", () => {
    const hsk = hskFromJson({ words: [["学习", "xué xí", 1], ["中文", "zhōng wén", 2]] });
    const t = segment("学习中文", { hsk });
    expect(t).toEqual([
      { text: "学习", kind: "word", band: 1 },
      { text: "中文", kind: "word", band: 2 },
    ]);
  });

  it("treats a word that is in either list as known", () => {
    const hsk = hskFromJson({ words: [["稀罕", "xī han", 7]] });
    const t = segment("稀罕图书馆", { hsk, dictionary: tiny.dictionary });
    expect(t.map((x) => x.text)).toEqual(["稀罕", "图书馆"]);
    expect(t[0]?.band).toBe(7);
    expect(t[1]).not.toHaveProperty("band");
  });

  it("wordsOf keeps only words", () => {
    expect(wordsOf(segment("我，去", tiny)).map((t) => t.text)).toEqual(["我", "去"]);
  });
});

describe("segment (real data)", () => {
  const dir = fileURLToPath(new URL("../../public/data/", import.meta.url));
  const hsk = hskFromJson(JSON.parse(readFileSync(dir + "hsk.json", "utf8")) as HskData);
  const dictionary = dictFromJson(JSON.parse(readFileSync(dir + "dictionary.json", "utf8")) as DictionaryData, { hsk });
  const split = (s: string) => segment(s, { dictionary, hsk }).map((t) => t.text);

  it("splits ordinary sentences", () => {
    expect(split("我今天想去图书馆看书。")).toEqual(["我", "今天", "想", "去", "图书馆", "看书", "。"]);
    expect(split("他们在北京大学学习中文")).toEqual(["他们", "在", "北京大学", "学习", "中文"]);
  });

  it("splits more everyday text", () => {
    expect(split("你好，我是学生。")).toEqual(["你好", "，", "我", "是", "学生", "。"]);
    expect(split("明天天气很好。")).toEqual(["明天", "天气", "很", "好", "。"]);
    expect(split("我喜欢喝咖啡，不喜欢喝茶。")).toEqual(["我", "喜欢", "喝", "咖啡", "，", "不", "喜欢", "喝茶", "。"]);
  });

  it("mixes Chinese, Latin and numbers", () => {
    expect(split("我有3个iPhone。")).toEqual(["我", "有", "3", "个", "iPhone", "。"]);
    expect(split("今天是2026年11月11日")).toEqual(["今天", "是", "2026", "年", "11", "月", "11", "日"]);
  });

  it("gives HSK bands to HSK words", () => {
    const t = segment("我喜欢学习", { dictionary, hsk });
    expect(t.map((x) => x.band)).toEqual([1, 1, 1]);
  });

  it("finds no unknown characters in common text", () => {
    const t = segment("我今天想去图书馆看书。他们在北京大学学习中文。", { dictionary, hsk });
    expect(t.filter((x) => x.kind === "unknown")).toEqual([]);
  });

  it("is quick on a long text", () => {
    const text = "我今天想去图书馆看书。".repeat(2000);
    const start = performance.now();
    segment(text, { dictionary, hsk });
    expect(performance.now() - start).toBeLessThan(500);
  });
});
