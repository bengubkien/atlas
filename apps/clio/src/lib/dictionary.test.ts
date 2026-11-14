import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { beforeEach, describe, expect, it, vi } from "vitest";

import { Dictionary, fromJson, loadDictionary, resetDictionary, type DictionaryData } from "./dictionary";
import { fromJson as hskFromJson, type HskData } from "./hsk";

const small: DictionaryData = {
  entries: {
    你好: [["nǐ hǎo", "hello", "hi"]],
    好: [["hǎo", "good", "well"], ["hào", "to be fond of"]],
    白: [["bái", "white", "plain"], ["Bái", "surname Bai"]],
    北京: [["Běi jīng", "Beijing, capital of China"]],
    女: [["nǚ", "female", "woman"]],
    绿: [["lǜ", "green"]],
    西安: [["Xī ān", "Xi'an, capital of Shaanxi"]],
    先: [["xiān", "first", "before"]],
    constructor: [["kòng", "a word that looks like a built-in"]],
  },
};
const hskSmall: HskData = { words: [["好", "hǎo", 1], ["你好", "nǐ hǎo", 1], ["女", "nǚ", 2]] };

describe("lookup", () => {
  const dict = fromJson(small, { hsk: hskFromJson(hskSmall) });

  it("returns readings and definitions", () => {
    const e = dict.lookup("好");
    expect(e?.word).toBe("好");
    expect(e?.readings).toEqual([
      { pinyin: "hǎo", definitions: ["good", "well"], proper: false },
      { pinyin: "hào", definitions: ["to be fond of"], proper: false },
    ]);
    expect(e?.hskBand).toBe(1);
  });

  it("marks capitalised readings as proper nouns", () => {
    const e = dict.lookup("白");
    expect(e?.readings.map((r) => r.proper)).toEqual([false, true]);
    expect(dict.lookup("北京")?.readings[0]?.proper).toBe(true);
  });

  it("leaves hskBand off words that aren't on the list", () => {
    expect(dict.lookup("北京")).not.toHaveProperty("hskBand");
  });

  it("returns undefined for unknown words and built-in property names", () => {
    expect(dict.lookup("猫头鹰")).toBeUndefined();
    expect(dict.lookup("toString")).toBeUndefined();
    expect(dict.lookup("__proto__")).toBeUndefined();
    expect(dict.has("constructor")).toBe(true);
    expect(dict.has("hasOwnProperty")).toBe(false);
  });

  it("works without an HSK list", () => {
    expect(fromJson(small).lookup("好")).not.toHaveProperty("hskBand");
  });

  it("knows its longest headword", () => {
    expect(dict.maxWordLength).toBe("constructor".length);
  });
});

describe("search", () => {
  const dict = fromJson(small, { hsk: hskFromJson(hskSmall) });
  const words = (q: string) => dict.search(q).map((r) => r.entry.word);

  it("finds by characters, exact first", () => {
    expect(words("好")).toEqual(["好", "你好"]);
    expect(dict.search("好")[0]?.match).toBe("word");
    expect(words("京")).toEqual(["北京"]);
    expect(words("猫")).toEqual([]);
  });

  it("finds by pinyin however it is typed", () => {
    for (const q of ["nihao", "ni hao", "nǐ hǎo", "ni3 hao3", "Ni Hao", "  NI3HAO3 "]) {
      expect(words(q)[0]).toBe("你好");
    }
    expect(dict.search("nihao")[0]?.match).toBe("pinyin");
  });

  it("handles ü", () => {
    for (const q of ["nü", "nu:3", "nv3", "nǚ", "nu"]) expect(words(q)).toContain("女");
    expect(words("lǜ")).toContain("绿");
  });

  it("puts matching tones first", () => {
    expect(words("hao3")[0]).toBe("好");
    expect(words("hao4")[0]).toBe("好");
    expect(words("xian1")[0]).toBe("先");
    expect(words("xi1an1")[0]).toBe("西安");
    expect(words("xian")).toEqual(expect.arrayContaining(["先", "西安"]));
  });

  it("finds proper nouns by pinyin", () => {
    expect(words("beijing")).toEqual(["北京"]);
  });

  it("finds by English, exact definitions first", () => {
    expect(words("hello")).toEqual(["你好"]);
    expect(words("white")).toEqual(["白"]);
    expect(words("capital")).toEqual(expect.arrayContaining(["北京", "西安"]));
    expect(dict.search("woman")[0]?.match).toBe("english");
    expect(words("Surname")).toEqual(["白"]);
  });

  it("ranks exact before partial, then HSK before the rest", () => {
    // "good" is an exact definition of 好; "fond" only appears inside another.
    expect(words("good")[0]).toBe("好");
    // Both of these hold "capital"; neither is on the list, so the shorter wins.
    expect(words("capital")[0]).toBe("北京");
  });

  it("caps results and ignores empty queries", () => {
    expect(dict.search("a", { limit: 2 }).length).toBeLessThanOrEqual(2);
    expect(dict.search("")).toEqual([]);
    expect(dict.search("   ")).toEqual([]);
    expect(dict.search("hao", { limit: 0 })).toEqual([]);
  });
});

describe("loadDictionary", () => {
  beforeEach(() => resetDictionary());

  it("loads once and shares the result", async () => {
    const load = vi.fn(async () => small);
    const [a, b] = await Promise.all([loadDictionary({ load }), loadDictionary({ load })]);
    expect(a).toBe(b);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("tries again after a failure", async () => {
    await expect(loadDictionary({ load: async () => Promise.reject(new Error("offline")) })).rejects.toThrow("offline");
    expect((await loadDictionary({ load: async () => small })).has("好")).toBe(true);
  });

  it("rejects bad data", () => {
    expect(() => Dictionary.fromJson({} as DictionaryData)).toThrow();
  });
});

// The committed file, with the real HSK list.
describe("data/dictionary.json", () => {
  const dir = fileURLToPath(new URL("../../public/data/", import.meta.url));
  const hsk = hskFromJson(JSON.parse(readFileSync(dir + "hsk.json", "utf8")) as HskData);
  const dict = fromJson(JSON.parse(readFileSync(dir + "dictionary.json", "utf8")) as DictionaryData, { hsk });

  it("has a full-size dictionary", () => {
    expect(dict.size).toBeGreaterThan(100_000);
  });

  it("converts pinyin and keeps definitions", () => {
    const e = dict.lookup("你好");
    expect(e?.readings[0]?.pinyin).toBe("nǐ hǎo");
    expect(e?.readings[0]?.definitions).toContain("hello; hi");
    expect(dict.lookup("女")?.readings[0]?.pinyin).toBe("nǚ");
    expect(dict.lookup("一律")?.readings[0]?.pinyin).toBe("yī lǜ");
    expect(dict.lookup("北京")?.readings[0]?.proper).toBe(true);
    expect(dict.lookup("白")?.readings[0]?.pinyin).toBe("bái");
  });

  it("has no numbered pinyin or leftover u: in readings", () => {
    for (const w of ["你好", "花儿", "了", "行", "们", "女朋友"]) {
      for (const r of dict.lookup(w)?.readings ?? []) expect(r.pinyin).not.toMatch(/[0-9:]/);
    }
  });

  it("drops pointer readings when there is a real one", () => {
    const names = dict.lookup("女")?.readings.map((r) => r.pinyin);
    expect(names).toEqual(["nǚ"]);
  });

  // The aim is under 50 ms. The limit here is looser, so a busy machine
  // running other tests at the same time doesn't fail it.
  it("answers searches quickly once warm", () => {
    dict.warmUp();
    for (const q of ["nihao", "nǐ hǎo", "你好", "hello", "the", "ma", "ice cream", "图书"]) {
      const t = performance.now();
      const r = dict.search(q);
      const ms = performance.now() - t;
      expect(r.length).toBeGreaterThan(0);
      expect(ms).toBeLessThan(200);
    }
  });

  it("looks words up in constant time", () => {
    const t = performance.now();
    for (let i = 0; i < 10_000; i++) dict.lookup("你好");
    expect(performance.now() - t).toBeLessThan(100);
  });

  it("ranks sensibly", () => {
    expect(dict.search("nihao")[0]?.entry.word).toBe("你好");
    expect(dict.search("你好")[0]?.entry.word).toBe("你好");
    expect(dict.search("library").map((r) => r.entry.word)).toContain("图书馆");
    expect(dict.search("ice cream").map((r) => r.entry.word)).toContain("冰淇淋");
  });
});
