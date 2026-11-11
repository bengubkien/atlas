// Turns a sample written in its short authoring form (source/*.ts) into a
// `Text`: tokens with pinyin and headwords, a glossary with bands, and the
// pinyin of the title and of each note's example.
//
// scripts/build-samples.mjs runs this with the dictionary and the HSK list
// loaded and writes texts.json, which the app imports. The app never runs it,
// so the 9 MB dictionary stays out of the bundle. Node runs this file with
// its type stripping, so it imports nothing at run time and uses no syntax
// Node can't strip.
//
// How a sentence is written: words split by spaces, punctuation as its own
// word: "我 今天 想 去 图书馆 。". A word can carry two marks:
//   长{zhǎng}          its reading here, as spoken (tone changes included)
//   一点儿<一点>       the headword to look up, when it isn't the word itself
// Both can go together: 看看<看>{kànkan}.
//
// Readings:
//   - A word with one everyday reading in CC-CEDICT gets it. Readings with a
//     capital (surnames, places) are left out when there are others.
//   - A word with more than one needs a choice: a mark on the word, the
//     text's own `readings`, or USUAL_READINGS below for the few function
//     words whose other readings are rare. Anything else stops the build.
//   - 一 and 不 are written with their tone changes as spoken (yí gè, yìqǐ,
//     bú shì, búcuò): 一 before a fourth tone is yí, before the others yì;
//     不 before a fourth tone is bú. A numeral 一 (第一, 十一, at the end of a
//     word or before a mark) keeps yī. The third-tone change (nǐ hǎo said
//     ní hǎo) is never written, as in every dictionary and textbook.
//   - Neutral tones are CC-CEDICT's (māma, dōngxi, juéde). A mark adds one
//     where standard speech has it and the dictionary doesn't.
//   - A word's syllables are joined ("túshūguǎn"), with an apostrophe before
//     a syllable that starts with a, o or e ("kě'ài"), as pinyin is spelled.
//     The glossary keeps the dictionary's tones, without the 一/不 changes.
//
// Segmentation, so every sample splits the same way: a word on the HSK list
// is one token (图书馆, 吃饭, 打电话 if listed); a phrase that isn't listed is
// split into its words (看 书). 了, 的, 吗 and other particles are their own
// tokens, and so are a number and its measure word (一 个, 两 杯).

import type { Note, Question, Text, TextKind } from "../model";

/** One sentence: [Chinese, English] or, in a dialogue, [speaker, Chinese, English]. */
export type SourceSentence = readonly [string, string] | readonly [string, string, string];

export interface SampleSource {
  /** The ID is "sample-<name>". */
  name: string;
  /** Place in the library's sample shelf, from 1. */
  order: number;
  kind: TextKind;
  band: number;
  topic: string;
  /** YYYY-MM-DD. */
  createdAt: string;
  /** zh is written split, like a sentence. */
  title: { zh: string; en: string };
  /** People and places in the text that aren't dictionary words: pinyin and what to show. */
  names?: Record<string, { pinyin: string; en: string }>;
  /** This text's choice of reading for words with more than one (spaced, as CC-CEDICT writes it). */
  readings?: Record<string, string>;
  sentences: readonly SourceSentence[];
  /** What each word means here. Words used in their plain sense can come from the shared GLOSSES. */
  gloss: Record<string, string | readonly string[]>;
  /** The band-4-and-up words the text teaches. */
  targetWords: readonly string[];
  /** example.zh is written split, like a sentence; its pinyin is filled in. */
  notes: readonly { title: string; explanation: string; example: { zh: string; en: string } }[];
  questions: readonly { lang: Question["lang"]; question: string; options: readonly string[]; answer: number }[];
}

/** What the builder needs from the dictionary and the HSK list. */
export interface Lookup {
  /** CC-CEDICT's readings for a headword, tone-marked and spaced ("nǐ hǎo"), or undefined. */
  readings(word: string): readonly string[] | undefined;
  band(word: string): number | undefined;
}

/**
 * Function words whose other readings in CC-CEDICT are rare or literary
 * (的 dí "really", 着 zháo, 吧 bā "bar"). A text that uses one of those
 * readings marks the word.
 */
export const USUAL_READINGS: Record<string, string> = {
  的: "de",
  了: "le",
  着: "zhe",
  吧: "ba",
  呢: "ne",
  这: "zhè",
  那: "nà",
  哪: "nǎ",
  都: "dōu",
  还: "hái",
  喝: "hē",
  东西: "dōng xi",
  和: "hé",
  个: "gè",
  么: "me",
  啊: "a",
  只: "zhǐ",
  要: "yào",
  会: "huì",
  种: "zhǒng",
  便宜: "pián yi",
  看: "kàn",
  教: "jiāo",
  过: "guò",
  没: "méi",
  那么: "nà me",
  这么: "zhè me",
  怎么: "zěn me",
  什么: "shén me",
  多少: "duō shao",
  大夫: "dài fu",
  地方: "dì fang",
  头: "tóu",
  上: "shàng",
  得: "de",
  中: "zhōng",
  下: "xià",
  分: "fēn",
  好: "hǎo",
  少: "shǎo",
  多: "duō",
  正: "zhèng",
  数: "shù",
  当: "dāng",
  行: "xíng",
  为: "wèi",
  长: "cháng",
  觉得: "jué de",
};

const HAN = /\p{Script=Han}/u;
const PUNCT = /^[\p{P}\p{S}]+$/u;
const TONE_MARKS = ["̄", "́", "̌", "̀"];

/** 1 to 4, or 5 for a neutral tone. */
export function toneOf(syllable: string): number {
  for (const ch of syllable.normalize("NFD")) {
    const at = TONE_MARKS.indexOf(ch);
    if (at >= 0) return at + 1;
  }
  return 5;
}

/** Without tone marks, lower case. ü stays ü. */
export function toneless(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̄́̌̀]/g, "")
    .normalize("NFC")
    .toLowerCase();
}

/** Syllables joined as one word, with an apostrophe before a, o or e. */
export function joinSyllables(syllables: readonly string[]): string {
  return syllables.map((s, i) => (i > 0 && /^[aoe]/.test(toneless(s)) ? `'${s}` : s)).join("");
}

/** A reading with the dictionary's capitalised (proper-noun) readings dropped, when there are others. */
function everydayReadings(readings: readonly string[]): string[] {
  const lower = readings.filter((r) => !/^\p{Lu}/u.test(r));
  const pool = lower.length > 0 ? lower : [...readings];
  const seen = new Set<string>();
  return pool.filter((r) => {
    const key = r.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * The forms a token's reading may take: the word's own readings, or ones
 * made from its headword when the token is an erhua or a doubled form of it.
 * Each is a list of syllables.
 */
export function candidateReadings(t: string, w: string, lookup: Lookup): string[][] {
  const own = t === w ? [] : (lookup.readings(t) ?? []);
  const base = lookup.readings(w) ?? [];
  const out = [...own, ...base].map((r) => r.split(" "));
  if (t !== w) {
    for (const r of base) {
      const syl = r.split(" ");
      if (t === `${w}儿`) out.push([...syl, "r"]);
      if (t === w + w) out.push([...syl, ...syl]);
      const chars = [...w];
      if (chars.length === 2 && t === `${chars[0]}${chars[0]}${chars[1]}${chars[1]}` && syl.length === 2) {
        out.push([syl[0]!, syl[0]!, syl[1]!, syl[1]!]);
      }
    }
  }
  return out;
}

/**
 * Whether a token's pinyin is one of the readings, allowing for what speech
 * changes: 一 and 不's tone changes, and a neutral tone where the dictionary
 * has a full one. Case and apostrophes don't count. Returns the reading it
 * matched, as syllables, or undefined.
 */
export function matchReading(p: string, t: string, candidates: readonly string[][]): string[] | undefined {
  const plain = p.replace(/['’ ]/g, "");
  const chars = [...t];
  for (const syllables of candidates) {
    if (toneless(syllables.join("")) !== toneless(plain)) continue;
    // Cut p where the reading's syllables end. Tone marks are part of the
    // composed letter, so lengths line up.
    const letters = [...plain.normalize("NFC")];
    const pieces: string[] = [];
    let at = 0;
    for (const s of syllables) {
      const n = [...s.normalize("NFC")].length;
      pieces.push(letters.slice(at, at + n).join(""));
      at += n;
    }
    const ok = syllables.every((s, i) => {
      const got = toneOf(pieces[i]!);
      const want = toneOf(s);
      if (got === want || got === 5) return true;
      const ch = syllables.length === chars.length ? chars[i] : undefined;
      return ch === "一" || ch === "不";
    });
    if (ok) return syllables;
  }
  return undefined;
}

/** Splits "长{zhǎng}" and "一点儿<一点>" into the word, its headword and its reading. */
function parseWord(raw: string): { t: string; w?: string; p?: string } {
  const m = /^([^<{]+)(?:<([^>]+)>)?(?:\{([^}]+)\})?$/u.exec(raw);
  if (!m) throw new Error(`Can't read "${raw}"`);
  return { t: m[1]!, w: m[2], p: m[3] };
}

/** A word on its way to a token. `fixed` is a reading given by hand, used as it is. */
type Draft = { t: string; w?: string; syllables?: string[]; fixed?: string[]; name?: boolean };

const YI: Record<number, string> = { 1: "yì", 2: "yì", 3: "yì", 4: "yí" };
const BU: Record<number, string> = { 4: "bú" };

/** Applies 一 and 不's tone changes to a sentence's words. */
function sandhi(drafts: Draft[]): void {
  const firstTone = (d: Draft | undefined): number | undefined => {
    if (!d || !d.w) return undefined;
    const first = (d.fixed ?? d.syllables)?.[0];
    return first === undefined ? undefined : toneOf(first);
  };
  drafts.forEach((d, i) => {
    if (!d.syllables || d.fixed || d.name) return;
    const chars = [...d.t];
    if (chars.length !== d.syllables.length) return;
    d.syllables = d.syllables.map((s, j) => {
      const ch = chars[j];
      if (ch !== "一" && ch !== "不") return s;
      // Only the plain yī and bù change; a neutral 不 (对不起) stays.
      if ((ch === "一" && s !== "yī") || (ch === "不" && s !== "bù")) return s;
      let next: number | undefined;
      if (j + 1 < chars.length) next = toneOf(d.syllables![j + 1]!);
      else if (chars.length === 1) next = firstTone(drafts[i + 1]);
      // At the end of a longer word (第一, 十一) it is a numeral: no change.
      if (next === undefined || next === 5) return s;
      return (ch === "一" ? YI[next] : BU[next]) ?? s;
    });
  });
}

export interface BuildContext {
  lookup: Lookup;
  /** Shared definitions for words used in their plain sense. */
  glosses: Record<string, readonly string[]>;
  /** While writing: a missing definition is shown as "?" instead of stopping the build. */
  draft?: boolean;
}

const asList = (d: string | readonly string[]) => (typeof d === "string" ? [d] : [...d]);

/** Dates are fixed so a rebuild gives the same file. */
const dayMs = (date: string) => Date.parse(`${date}T00:00:00Z`);

/**
 * Builds one sample. Collects every problem it finds (a word missing from
 * the dictionary, a reading to choose, a missing definition) and throws them
 * together, so one run shows all there is to fix.
 */
export function buildSample(source: SampleSource, ctx: BuildContext): Text {
  const problems: string[] = [];
  const names = source.names ?? {};
  // The reading of each headword the first time it's used: the glossary's.
  const glossReading = new Map<string, string>();

  const words = (line: string, where: string): Draft[] => {
    const drafts = line
      .trim()
      .split(/\s+/u)
      .map((raw): Draft => {
        const { t, w: head, p } = parseWord(raw);
        if (!HAN.test(t)) {
          if (!PUNCT.test(t)) problems.push(`${where}: "${t}" is neither a word nor punctuation`);
          return { t };
        }
        if (Object.hasOwn(names, t)) {
          const pinyin = p ?? names[t]!.pinyin;
          if (!glossReading.has(t)) glossReading.set(t, names[t]!.pinyin);
          return { t, w: t, fixed: [pinyin.replace(/ /g, "")], name: true };
        }
        const w = head ?? t;
        const all = ctx.lookup.readings(w);
        if (!all) {
          problems.push(`${where}: "${w}" isn't in CC-CEDICT (a name? add it to names)`);
          return { t, w, fixed: ["?"] };
        }
        const candidates = candidateReadings(t, w, ctx.lookup);
        if (p !== undefined) {
          const matched = matchReading(p, t, candidates);
          if (!matched) problems.push(`${where}: "${p}" isn't a reading of ${t} (${all.join(" / ")})`);
          else if (!glossReading.has(w)) glossReading.set(w, glossForm(t, w, matched));
          return { t, w, fixed: p.split(" ") };
        }
        const everyday = everydayReadings(all);
        let chosen: string | undefined;
        if (everyday.length === 1) chosen = everyday[0];
        else chosen = source.readings?.[w] ?? USUAL_READINGS[w];
        if (chosen === undefined) {
          problems.push(`${where}: ${t} has more than one reading (${everyday.join(" / ")}); mark it`);
          return { t, w, fixed: ["?"] };
        }
        if (!all.includes(chosen)) problems.push(`${where}: "${chosen}" isn't a reading of ${w} (${all.join(" / ")})`);
        let syllables = chosen.split(" ");
        if (t !== w) {
          if (t === `${w}儿`) syllables = [...syllables, "r"];
          else if (t === w + w && syllables.length === 1) syllables = [syllables[0]!, toneless(syllables[0]!)];
          else {
            problems.push(`${where}: ${t}<${w}> needs its reading marked`);
            return { t, w, fixed: ["?"] };
          }
        }
        if (!glossReading.has(w)) glossReading.set(w, glossForm(t, w, chosen.split(" ")));
        return { t, w, syllables };
      });
    sandhi(drafts);
    return drafts;
  };

  const pinyinOf = (d: Draft) => joinSyllables(d.fixed ?? d.syllables ?? []);

  const sentences = source.sentences.map((line, i) => {
    const [speaker, zh, en] = line.length === 3 ? line : [null, line[0], line[1]];
    const tokens = words(zh, `s${i + 1}`).map((d) => (d.w ? { t: d.t, p: pinyinOf(d), w: d.w } : { t: d.t }));
    return { id: `s${i + 1}`, speaker, tokens, en };
  });

  // Titles and examples are read the same way, but their words needn't be
  // in the glossary, so the readings they add are dropped afterwards.
  const keep = new Map(glossReading);
  const spoken = (line: string, where: string) => {
    const drafts = words(line, where);
    let out = "";
    for (const d of drafts) {
      if (!d.w) out += d.t === "，" ? ", " : d.t === "。" ? ". " : d.t === "？" ? "? " : d.t === "！" ? "! " : "";
      else out += (out && !out.endsWith(" ") ? " " : "") + pinyinOf(d);
    }
    return {
      zh: drafts.map((d) => d.t).join(""),
      pinyin: out.trim().replace(/ ([,.?!])/g, "$1"),
    };
  };
  const title = spoken(source.title.zh, "title");
  const notes: Note[] = source.notes.map((n, i) => {
    const ex = spoken(n.example.zh, `note ${i + 1}`);
    return { title: n.title, explanation: n.explanation, example: { zh: ex.zh, pinyin: ex.pinyin, en: n.example.en } };
  });
  glossReading.clear();
  for (const [k, v] of keep) glossReading.set(k, v);

  const glossary: Text["glossary"] = {};
  for (const s of sentences) {
    for (const tok of s.tokens) {
      if (!tok.w || Object.hasOwn(glossary, tok.w)) continue;
      const w = tok.w;
      const name = Object.hasOwn(names, w) ? names[w] : undefined;
      const defs = name ? [name.en] : Object.hasOwn(source.gloss, w) ? asList(source.gloss[w]!) : ctx.glosses[w];
      if (!defs && !ctx.draft) {
        problems.push(`gloss: no definition for ${w}`);
        continue;
      }
      // The HSK list has some words only with their 儿 (有点儿, 一点儿), the
      // dictionary only without: the band comes from either.
      const band = name ? undefined : (ctx.lookup.band(w) ?? ctx.lookup.band(tok.t) ?? ctx.lookup.band(`${w}儿`));
      glossary[w] = band === undefined ? { pinyin: glossReading.get(w) ?? tok.p!, defs: [...(defs ?? ["?"])] } : { pinyin: glossReading.get(w) ?? tok.p!, defs: [...(defs ?? ["?"])], band };
    }
  }
  for (const w of Object.keys(source.gloss)) {
    if (!Object.hasOwn(glossary, w)) problems.push(`gloss: ${w} is defined but not used`);
  }
  for (const w of source.targetWords) {
    if (!Object.hasOwn(glossary, w)) problems.push(`targetWords: ${w} isn't in the text`);
  }

  if (problems.length > 0) throw new Error(`sample-${source.name}:\n  ${problems.join("\n  ")}`);

  const createdAt = dayMs(source.createdAt);
  return {
    id: `sample-${source.name}`,
    updatedAt: createdAt,
    deleted: false,
    kind: source.kind,
    band: source.band,
    topic: source.topic,
    title: { zh: title.zh, pinyin: title.pinyin, en: source.title.en },
    source: null,
    sentences,
    glossary,
    targetWords: [...source.targetWords],
    notes,
    questions: source.questions.map((q) => ({ ...q, options: [...q.options] })),
    audio: null,
    origin: "sample",
    createdAt,
  };
}

/** The glossary's pinyin: the headword's dictionary reading, joined. */
function glossForm(t: string, w: string, syllables: readonly string[]): string {
  let syl = [...syllables];
  if (t === `${w}儿` && syl.at(-1) === "r") syl = syl.slice(0, -1);
  else if (t !== w && syl.length === 2 * [...w].length) syl = syl.slice(0, [...w].length);
  return joinSyllables(syl);
}

export interface SampleStats {
  /** Han characters in the sentences. */
  chars: number;
  /** Word tokens (punctuation left out). */
  words: number;
  /** Share of word tokens in bands 1–3, names counted in. */
  coverage: number;
  /** Headwords above band 3 or off the lists (names left out), with how often each is used. */
  newWords: Map<string, number>;
}

/** The numbers the tests check and the build prints. `names` are the text's names, counted as known. */
export function sampleStats(text: Pick<Text, "sentences" | "glossary">, names: ReadonlySet<string>): SampleStats {
  let chars = 0;
  let words = 0;
  let known = 0;
  const newWords = new Map<string, number>();
  for (const s of text.sentences) {
    for (const tok of s.tokens) {
      chars += [...tok.t].filter((c) => HAN.test(c)).length;
      if (!tok.w) continue;
      words++;
      const band = text.glossary[tok.w]?.band;
      if (names.has(tok.w) || (band !== undefined && band <= 3)) known++;
      else newWords.set(tok.w, (newWords.get(tok.w) ?? 0) + 1);
    }
  }
  return { chars, words, coverage: words === 0 ? 1 : known / words, newWords };
}
