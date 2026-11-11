import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { beforeEach, describe, expect, it, vi } from "vitest";

import { bandLabel, fromJson, loadHsk, resetHsk, type HskData } from "./hsk";

const small: HskData = {
  words: [
    ["爱", "ài", 1, "to love"],
    ["你好", "nǐ hào".replace("hào", "hǎo"), 1, "hello"],
    ["图书馆", "tú shū guǎn", 2, "library"],
    ["北京", "Běi jīng", 1],
    ["稀罕", "xī han", 7],
  ],
};

describe("HskList", () => {
  const hsk = fromJson(small);

  it("looks words up", () => {
    expect(hsk.bandOf("爱")).toBe(1);
    expect(hsk.bandOf("图书馆")).toBe(2);
    expect(hsk.bandOf("稀罕")).toBe(7);
    expect(hsk.bandOf("猫头鹰")).toBeUndefined();
    expect(hsk.has("你好")).toBe(true);
    expect(hsk.has("好你")).toBe(false);
  });

  it("returns entries, with the gloss only when there is one", () => {
    expect(hsk.entry("爱")).toEqual({ word: "爱", pinyin: "ài", band: 1, gloss: "to love" });
    expect(hsk.entry("北京")).toEqual({ word: "北京", pinyin: "Běi jīng", band: 1 });
    expect(hsk.entry("x")).toBeUndefined();
  });

  it("lists words by band", () => {
    expect(hsk.wordsInBand(1).map((e) => e.word)).toEqual(["爱", "你好", "北京"]);
    expect(hsk.wordsInBand(3)).toEqual([]);
    expect(hsk.wordsUpToBand(2).map((e) => e.word)).toEqual(["爱", "你好", "北京", "图书馆"]);
  });

  it("counts per band", () => {
    expect(hsk.counts()).toEqual([3, 1, 0, 0, 0, 0, 1]);
    expect(hsk.cumulativeCounts()).toEqual([3, 4, 4, 4, 4, 4, 5]);
    expect(hsk.size).toBe(5);
    expect(hsk.maxWordLength).toBe(3);
  });

  it("keeps the lower band when a word is listed twice", () => {
    const twice = fromJson({ words: [["了", "le", 3], ["了", "le", 1]] });
    expect(twice.bandOf("了")).toBe(1);
    expect(twice.wordsInBand(3)).toEqual([]);
    expect(twice.size).toBe(1);
  });

  it("rejects bad data", () => {
    expect(() => fromJson({} as HskData)).toThrow();
    expect(() => fromJson({ words: [["x", "x", 9]] })).toThrow(/bad word/);
  });

  it("labels bands", () => {
    expect(bandLabel(3)).toBe("HSK 3");
    expect(bandLabel(7)).toBe("HSK 7–9");
  });
});

describe("loadHsk", () => {
  beforeEach(() => resetHsk());

  it("loads once and shares the result", async () => {
    const load = vi.fn(async () => small);
    const [a, b] = await Promise.all([loadHsk(load), loadHsk(load)]);
    expect(a).toBe(b);
    expect(await loadHsk(load)).toBe(a);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("tries again after a failure", async () => {
    await expect(loadHsk(async () => Promise.reject(new Error("offline")))).rejects.toThrow("offline");
    const hsk = await loadHsk(async () => small);
    expect(hsk.size).toBe(5);
  });
});

// The committed file, against the standard's cumulative totals
// (500 / 1,272 / 2,245 / 3,245 / 4,316 / 5,456 / about 11,000). The source
// merges a few repeated words, so it runs a little under; allow 3%.
describe("data/hsk.json", () => {
  const file = fileURLToPath(new URL("../../public/data/hsk.json", import.meta.url));
  const hsk = fromJson(JSON.parse(readFileSync(file, "utf8")) as HskData);

  it("has the standard's band sizes, near enough", () => {
    const standard = [500, 1272, 2245, 3245, 4316, 5456, 11092];
    hsk.cumulativeCounts().forEach((n, i) => {
      const want = standard[i] as number;
      expect(Math.abs(n - want) / want).toBeLessThan(0.03);
    });
  });

  it("knows ordinary words in their bands", () => {
    expect(hsk.bandOf("爱好")).toBe(1);
    expect(hsk.bandOf("图书馆")).toBeLessThanOrEqual(3);
    expect(hsk.entry("白")?.pinyin).toBe("bái");
    expect(hsk.entry("北京")?.pinyin).toBe("Běi jīng");
    expect(hsk.entry("女儿")?.pinyin).toMatch(/ér/);
  });

  it("has tone-marked pinyin with no digits or colons", () => {
    for (const w of hsk.wordsUpToBand(7)) expect(w.pinyin).not.toMatch(/[0-9:˙]/);
  });
});
