import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { beforeAll, describe, expect, it } from "vitest";

import type { DictionaryData } from "../dictionary";
import type { HskData } from "../hsk";
import { textSchema, type Text } from "../model";
import { wordsToMarkKnown } from "../reading";
import { coverage, wordBook } from "../words";
import { buildSample, candidateReadings, matchReading, sampleStats, toneOf, type Lookup, type SampleSource } from "./build";
import { formatTexts } from "./format";
import { GLOSSES } from "./glosses";
import { SAMPLE_TEXTS, SAMPLES_VERSION } from "./index";

// The samples are checked against the real data: the dictionary and the HSK
// list in public/data. Building them again must give the committed
// texts.json, so a changed source that wasn't rebuilt fails here.

const here = (path: string) => fileURLToPath(new URL(path, import.meta.url));
const dict = JSON.parse(readFileSync(here("../../../public/data/dictionary.json"), "utf8")) as DictionaryData;
const hsk = JSON.parse(readFileSync(here("../../../public/data/hsk.json"), "utf8")) as HskData;
const bands = new Map<string, number>();
for (const [word, , band] of hsk.words) if (!bands.has(word) || bands.get(word)! > band) bands.set(word, band);
const lookup: Lookup = {
  readings: (w) => (Object.hasOwn(dict.entries, w) ? dict.entries[w]!.map((r) => r[0]!) : undefined),
  band: (w) => bands.get(w),
};

const sources: SampleSource[] = [];
beforeAll(async () => {
  for (const f of readdirSync(here("./source")).filter((f) => f.endsWith(".ts")).sort()) {
    sources.push(((await import(`./source/${f.replace(/\.ts$/, "")}`)) as { default: SampleSource }).default);
  }
  sources.sort((a, b) => a.order - b.order);
});

const sourceOf = (text: Text) => sources.find((s) => `sample-${s.name}` === text.id)!;
const namesOf = (text: Text) => new Set(Object.keys(sourceOf(text).names ?? {}));
/** A sentence as written in the source, with the split and the marks taken out. */
const plain = (line: string) => line.replace(/\{[^}]*\}|<[^>]*>/g, "").replace(/\s+/g, "");

describe("the sample set", () => {
  it("is ten texts of the planned kinds and levels", () => {
    expect(SAMPLE_TEXTS).toHaveLength(10);
    expect(SAMPLES_VERSION).toBeGreaterThanOrEqual(1);
    const count = (key: (t: Text) => string | number) =>
      SAMPLE_TEXTS.reduce<Record<string, number>>((acc, t) => ({ ...acc, [key(t)]: (acc[key(t)] ?? 0) + 1 }), {});
    expect(count((t) => t.kind)).toEqual({ story: 3, dialogue: 3, culture: 2, news: 2 });
    expect(count((t) => t.band)).toEqual({ 3: 1, 4: 8, 5: 1 });
    expect(new Set(SAMPLE_TEXTS.map((t) => t.id)).size).toBe(10);
  });

  it("is what the build makes from the sources", () => {
    const built = sources.map((s) => buildSample(s, { lookup, glosses: GLOSSES }));
    expect(SAMPLE_TEXTS).toEqual(built);
    expect(readFileSync(here("./texts.json"), "utf8")).toBe(formatTexts(built));
  });

  it("doesn't pull the dictionary into the app", () => {
    for (const file of ["index.ts", "build.ts", "format.ts", "glosses.ts"]) {
      expect(readFileSync(here(`./${file}`), "utf8")).not.toMatch(/dictionary\.json|hsk\.json/);
    }
  });

  it("prints its numbers", () => {
    const rows = SAMPLE_TEXTS.map((t) => {
      const s = sampleStats(t, namesOf(t));
      return {
        id: t.id.replace("sample-", ""),
        kind: t.kind,
        band: t.band,
        chars: s.chars,
        words: s.words,
        "bands 1–3": `${(s.coverage * 100).toFixed(1)}%`,
        new: [...s.newWords.keys()].join(" "),
      };
    });
    console.table(rows);
    expect(rows).toHaveLength(10);
  });
});

describe.each(SAMPLE_TEXTS.map((t) => [t.id, t] as const))("%s", (_, text) => {
  it("parses as a Text, as a sample", () => {
    expect(() => textSchema.parse(text)).not.toThrow();
    expect(text.id).toMatch(/^sample-[a-z-]+$/);
    expect(text.origin).toBe("sample");
    expect(text.source).toBeNull();
    expect(text.audio).toBeNull();
    expect(text.title.pinyin).not.toBe("");
    expect(text.title.en).not.toBe("");
  });

  it("joins its tokens back into each sentence", () => {
    const source = sourceOf(text);
    text.sentences.forEach((s, i) => {
      const line = source.sentences[i]!;
      const zh = line.length === 3 ? line[1] : line[0];
      expect(s.tokens.map((t) => t.t).join("")).toBe(plain(zh));
      expect(s.id).toBe(`s${i + 1}`);
      expect(s.en.trim()).not.toBe("");
      expect(s.speaker !== null).toBe(text.kind === "dialogue");
    });
  });

  it("gives every word a headword and pinyin, and punctuation neither", () => {
    for (const s of text.sentences) {
      for (const tok of s.tokens) {
        if (/\p{Script=Han}/u.test(tok.t)) {
          expect(tok.w, tok.t).toBeTruthy();
          expect(tok.p, tok.t).toBeTruthy();
        } else {
          expect(tok.t).toMatch(/^[\p{P}\p{S}]+$/u);
          expect(tok.w).toBeUndefined();
          expect(tok.p).toBeUndefined();
        }
      }
    }
  });

  it("has every headword in the glossary and nothing else there", () => {
    const used = new Set(text.sentences.flatMap((s) => s.tokens.flatMap((t) => (t.w ? [t.w] : []))));
    expect(new Set(Object.keys(text.glossary))).toEqual(used);
    for (const [w, entry] of Object.entries(text.glossary)) {
      expect(entry.defs.length, w).toBeGreaterThanOrEqual(1);
      expect(entry.defs.length, w).toBeLessThanOrEqual(3);
      expect(entry.band, w).toBe(namesOf(text).has(w) ? undefined : (bands.get(w) ?? bands.get(`${w}儿`)));
    }
  });

  it("marks its names in the glossary, and nothing else as a name", () => {
    const marked = Object.entries(text.glossary).flatMap(([w, entry]) => (entry.name ? [w] : []));
    // A name only a speaker has (a dialogue's 安娜) isn't in the sentences, so not in the glossary.
    expect(new Set(marked)).toEqual(new Set([...namesOf(text)].filter((w) => Object.hasOwn(text.glossary, w))));
    for (const [, entry] of Object.entries(text.glossary)) if (entry.name !== undefined) expect(entry.name).toBe(true);
  });

  it("counts its names as known, so they aren't new words or marked at Finish", () => {
    const book = wordBook([]);
    const band = (w: string) => bands.get(w);
    const { unknown } = coverage(text, book, band, 3);
    const marks = wordsToMarkKnown(text, book, band, 3);
    for (const name of namesOf(text)) {
      expect(unknown, name).not.toContain(name);
      expect(marks, name).not.toContain(name);
    }
  });

  // Names are the one exception to "every headword is in CC-CEDICT" and to
  // "pinyin has no spaces": they're the text's own people and places, and a
  // full name is spelled surname, space, given name (Lǐ Wén), as pinyin
  // spelling rules have it.
  it("has every headword in CC-CEDICT, names aside", () => {
    const names = namesOf(text);
    for (const w of Object.keys(text.glossary)) {
      if (names.has(w)) continue;
      expect(Object.hasOwn(dict.entries, w), w).toBe(true);
    }
  });

  it("reads every word as one of its dictionary readings", () => {
    const names = namesOf(text);
    for (const s of text.sentences) {
      for (const tok of s.tokens) {
        if (!tok.w || !tok.p) continue;
        if (names.has(tok.w)) {
          expect(tok.p).toBe(sourceOf(text).names![tok.w]!.pinyin);
          continue;
        }
        expect(tok.p, tok.t).not.toMatch(/\s/);
        expect(matchReading(tok.p, tok.t, candidateReadings(tok.t, tok.w, lookup)), `${s.id} ${tok.t} ${tok.p}`).toBeDefined();
      }
    }
  });

  // The convention for 一 and 不, from build.ts: changed as spoken. 一 is yí
  // before a fourth tone and yì before the others, but yī as a numeral
  // (after 第). 不 is bú before a fourth tone, bù otherwise, and a light bu
  // between a word and itself (辣不辣) or before a result (学不会).
  it("writes 一 and 不 with their tone changes", () => {
    for (const s of text.sentences) {
      s.tokens.forEach((tok, i) => {
        if (tok.t !== "一" && tok.t !== "不") return;
        const next = s.tokens[i + 1];
        const tone = next?.p ? toneOf(next.p.replace(/^(\p{L}*?[aeiouüāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ]+(?:ng|n|r)?).*$/u, "$1")) : undefined;
        if (tok.t === "一") {
          if (s.tokens[i - 1]?.t === "第") expect(tok.p).toBe("yī");
          else expect(tok.p, `${s.id} 一${next?.t}`).toBe(tone === 4 ? "yí" : "yì");
        } else if (tok.p === "bu") {
          const prev = s.tokens[i - 1];
          const doubled = prev?.t === next?.t;
          expect(doubled || ["会", "到", "上", "去"].includes(next!.t), `${s.id} ${prev?.t}不${next?.t}`).toBe(true);
        } else {
          expect(tok.p, `${s.id} 不${next?.t}`).toBe(tone === 4 ? "bú" : "bù");
        }
      });
    }
  });

  it("stays mostly within bands 1–3, with 5 to 8 new words", () => {
    const stats = sampleStats(text, namesOf(text));
    expect(stats.coverage).toBeGreaterThanOrEqual(0.92);
    expect(stats.coverage).toBeLessThanOrEqual(0.97);
    expect(stats.newWords.size).toBeGreaterThanOrEqual(5);
    expect(stats.newWords.size).toBeLessThanOrEqual(8);
    expect(stats.chars).toBeGreaterThanOrEqual(150);
    expect(stats.chars).toBeLessThanOrEqual(400);
    // The words it sets out to teach: new, from band 4 up (or off the
    // lists, like 单车), at least five.
    expect(text.targetWords.length).toBeGreaterThanOrEqual(5);
    for (const w of text.targetWords) {
      expect(stats.newWords.has(w), w).toBe(true);
      expect(text.glossary[w]!.band ?? 9, w).toBeGreaterThanOrEqual(4);
    }
  });

  it("has notes with examples and questions with one answer each", () => {
    expect(text.notes.length).toBeGreaterThanOrEqual(1);
    expect(text.notes.length).toBeLessThanOrEqual(2);
    for (const n of text.notes) {
      expect(n.example).not.toBeNull();
      expect(n.example!.pinyin).not.toBe("");
      expect(n.example!.en).not.toBe("");
    }
    expect(text.questions.length).toBeGreaterThanOrEqual(3);
    expect(text.questions.length).toBeLessThanOrEqual(4);
    expect(new Set(text.questions.map((q) => q.lang))).toEqual(new Set(["zh", "en"]));
    for (const q of text.questions) {
      expect(q.options).toHaveLength(4);
      expect(new Set(q.options).size).toBe(4);
      expect(q.answer).toBeGreaterThanOrEqual(0);
      expect(q.answer).toBeLessThan(q.options.length);
    }
  });
});

describe("the builder", () => {
  const ctx = { lookup, glosses: GLOSSES };
  const base: SampleSource = {
    name: "t",
    order: 0,
    kind: "story",
    band: 3,
    topic: "Test",
    createdAt: "2026-01-01",
    title: { zh: "测试", en: "Test" },
    sentences: [],
    gloss: {},
    targetWords: [],
    notes: [],
    questions: [],
  };
  const tokens = (line: string, gloss: Record<string, string> = {}) =>
    buildSample({ ...base, sentences: [[line, "x"]], gloss }, ctx).sentences[0]!.tokens.map((t) => t.p ?? t.t).join(" ");

  it("changes 一 and 不 as spoken, and keeps a numeral 一", () => {
    expect(tokens("一 个 人 一起 不 是 不错 。 第 一 。", { 人: "person", 不错: "pretty good", 第: "-th" })).toBe("yí gè rén yìqǐ bú shì búcuò 。 dì yī 。");
  });

  it("asks for a reading where a word has two", () => {
    expect(() => tokens("长 大")).toThrow(/长 has more than one reading/);
    expect(tokens("长{zhǎng} 大", { 长: "to grow", 大: "big" })).toBe("zhǎng dà");
  });

  it("refuses a reading the dictionary doesn't have", () => {
    expect(() => tokens("长{chàng}", { 长: "long" })).toThrow(/isn't a reading/);
  });

  it("joins syllables with an apostrophe before a, o and e", () => {
    expect(tokens("可爱 。", { 可爱: "cute" })).toBe("kě'ài 。");
  });
});
