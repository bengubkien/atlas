// The dictionary: CC-CEDICT, trimmed by scripts/build-dictionary.mjs into
// public/data/dictionary.json (CC BY-SA 4.0, (c) MDBG, see the root NOTICE).
//
// Loading works like hsk.ts: loadDictionary() fetches the file once in the
// browser; in Node and tests read the file yourself and call fromJson().
//
// Lookup is a property read on the parsed object. Search scans, with two
// helper arrays (the toneless pinyin of every headword, and its definitions
// in lower case) built on the first search rather than at load: most
// sessions only look words up, and the scan is fast enough to need no index
// of its own. warmUp() builds them early if you want the first search to be
// as quick as the rest.

import type { HskBand, HskList } from "./hsk";
import { marksToNumbered, searchKey } from "./pinyin";

export interface Reading {
  /** With tone marks, e.g. "nǐ hǎo". Capitalised for proper nouns. */
  pinyin: string;
  definitions: string[];
  /** True when the pinyin starts with a capital: a name or place. */
  proper: boolean;
}

export interface DictEntry {
  /** Simplified headword. */
  word: string;
  /** Everyday readings first, proper-noun readings after. */
  readings: Reading[];
  /** The HSK 3.0 band, if the word is on the list and an HSK list was given. */
  hskBand?: HskBand;
}

/** The shape of public/data/dictionary.json. A reading is [pinyin, ...definitions]. */
export interface DictionaryData {
  entries: Record<string, string[][]>;
}

export type MatchKind = "word" | "pinyin" | "english";

export interface SearchResult {
  entry: DictEntry;
  /** How the query matched. */
  match: MatchKind;
}

export interface SearchOptions {
  /** At most this many results. Default 30. */
  limit?: number;
}

export const DICTIONARY_URL = "/data/dictionary.json";

const HAN = /\p{Script=Han}/u;
const hasOwn = (o: object, k: string) => Object.prototype.hasOwnProperty.call(o, k);

function toReading(raw: string[]): Reading {
  const pinyin = raw[0] ?? "";
  return { pinyin, definitions: raw.slice(1), proper: /^\p{Lu}/u.test(pinyin) };
}

// Pinyin without tones, spaces or case, fast: one decompose and one strip.
function fastKey(pinyin: string): string {
  return pinyin.normalize("NFD").replace(/[^A-Za-z]/g, "").toLowerCase();
}

interface Candidate {
  word: string;
  match: MatchKind;
  /** Lower is better. */
  rank: number;
  band: number;
  /** Position of the matching definition, to prefer words whose main meaning it is. */
  at: number;
}

export class Dictionary {
  private readonly entries: Record<string, string[][]>;
  private readonly hsk?: HskList;
  private words?: string[];
  private pinyinKeys?: string[];
  private defsLower?: string[];

  /** Length of the longest headword, for the segmenter. */
  readonly maxWordLength: number;

  constructor(data: DictionaryData, options: { hsk?: HskList } = {}) {
    this.entries = data.entries;
    this.hsk = options.hsk;
    let longest = 0;
    for (const w of Object.keys(data.entries)) {
      if (w.length > longest) longest = w.length;
    }
    // Headwords hold BMP characters almost always; length in UTF-16 units is
    // close enough for a bound, and never too small.
    this.maxWordLength = longest;
  }

  /** Builds the dictionary from the parsed dictionary.json. Throws if the data is the wrong shape. */
  static fromJson(data: DictionaryData, options: { hsk?: HskList } = {}): Dictionary {
    if (!data || typeof data.entries !== "object" || data.entries === null) {
      throw new Error("dictionary.json: expected entries");
    }
    return new Dictionary(data, options);
  }

  private headwords(): string[] {
    return (this.words ??= Object.keys(this.entries));
  }

  get size(): number {
    return this.headwords().length;
  }

  has(word: string): boolean {
    return hasOwn(this.entries, word);
  }

  /** Readings and definitions for a simplified headword, or undefined. O(1). */
  lookup(word: string): DictEntry | undefined {
    if (!hasOwn(this.entries, word)) return undefined;
    const raw = this.entries[word] ?? [];
    const entry: DictEntry = { word, readings: raw.map(toReading) };
    const band = this.hsk?.bandOf(word);
    if (band) entry.hskBand = band;
    return entry;
  }

  /** Builds the helper arrays that search uses. Safe to call more than once. */
  warmUp(): void {
    const words = this.headwords();
    if (!this.pinyinKeys) {
      this.pinyinKeys = words.map((w) => (this.entries[w] ?? []).map((r) => fastKey(r[0] ?? "")).join("|"));
    }
    if (!this.defsLower) {
      this.defsLower = words.map((w) =>
        (this.entries[w] ?? [])
          .map((r) => r.slice(1).join("\n"))
          .join("\n")
          .toLowerCase(),
      );
    }
  }

  /**
   * Finds entries by characters, by pinyin (with tone marks, with numbers or
   * with none, spaces or not: "nihao", "ni hao", "nǐ hǎo", "ni3 hao3"), or by
   * an English word or phrase in the definitions. Best first: exact matches,
   * then HSK words (lower bands first), then shorter headwords.
   */
  search(query: string, options: SearchOptions = {}): SearchResult[] {
    const limit = options.limit ?? 30;
    const q = query.trim();
    if (!q || limit <= 0) return [];

    const found = new Map<string, Candidate>();
    const add = (word: string, match: MatchKind, rank: number, at = 0) => {
      const have = found.get(word);
      if (have && (have.rank < rank || (have.rank === rank && have.at <= at))) return;
      found.set(word, { word, match, rank, band: this.hsk?.bandOf(word) ?? 8, at });
    };

    if (HAN.test(q)) this.searchHan(q.replace(/\s+/g, ""), add);
    else {
      this.searchPinyin(q, add);
      this.searchEnglish(q, add);
    }

    const ranked = [...found.values()].sort(
      (a, b) =>
        a.rank - b.rank || a.band - b.band || a.at - b.at || a.word.length - b.word.length || (a.word < b.word ? -1 : 1),
    );
    const out: SearchResult[] = [];
    for (const c of ranked.slice(0, limit)) {
      const entry = this.lookup(c.word);
      if (entry) out.push({ entry, match: c.match });
    }
    return out;
  }

  private searchHan(q: string, add: (w: string, m: MatchKind, r: number, at?: number) => void): void {
    if (this.has(q)) add(q, "word", 0);
    for (const w of this.headwords()) {
      if (w === q) continue;
      if (w.startsWith(q)) add(w, "word", 2);
      else if (w.includes(q)) add(w, "word", 3);
    }
  }

  private searchPinyin(q: string, add: (w: string, m: MatchKind, r: number, at?: number) => void): void {
    const key = searchKey(q);
    if (!key) return;
    this.warmUp();
    // If tones were typed, a reading with those tones beats one with others.
    const typedDigits = /[1-5]/.test(q);
    const typedTones = typedDigits || /[\u0304\u0301\u030c\u0300]/.test(q.normalize("NFD"));
    // Both sides in one form: tone numbers, no spaces, ü as u, neutral as no number.
    const flat = (s: string) => s.toLowerCase().replace(/u:|[üv]/g, "u").replace(/[\s']/g, "");
    const toneForm = (p: string) => flat(marksToNumbered(p, { neutral: false }));
    const wantTones = !typedTones ? "" : typedDigits ? flat(q).replace(/5/g, "") : toneForm(q);

    const words = this.headwords();
    const keys = this.pinyinKeys ?? [];
    for (let i = 0; i < words.length; i++) {
      const s = keys[i];
      if (!s || !s.includes(key)) continue;
      const word = words[i] as string;
      const parts = s.split("|");
      if (parts.includes(key)) {
        let rank = 1;
        if (typedTones) {
          const raw = this.entries[word] ?? [];
          if (raw.some((r) => toneForm(r[0] ?? "") === wantTones)) rank = 0;
        }
        add(word, "pinyin", rank);
      } else if (parts.some((p) => p.startsWith(key))) add(word, "pinyin", 6);
    }
  }

  private searchEnglish(q: string, add: (w: string, m: MatchKind, r: number, at?: number) => void): void {
    const needle = q.toLowerCase().replace(/\s+/g, " ");
    if (needle.length < 2) return;
    this.warmUp();
    const words = this.headwords();
    const blobs = this.defsLower ?? [];
    const isLetter = (c: string) => /[a-z0-9]/.test(c);
    for (let i = 0; i < words.length; i++) {
      const blob = blobs[i];
      if (!blob || !blob.includes(needle)) continue;
      // Which definition matched, and how well. Exact ("hello", or "to
      // hello") ties with an exact pinyin match; a whole word inside a
      // definition comes next, then a fragment of a longer word.
      let rank = 8;
      let at = 0;
      const defs = blob.split("\n");
      for (let d = 0; d < defs.length; d++) {
        const def = defs[d] as string;
        const idx = def.indexOf(needle);
        if (idx < 0) continue;
        let r = 7;
        if (def === needle || def === `to ${needle}` || def === `a ${needle}`) r = 1;
        else if (!isLetter(def.charAt(idx - 1)) && !isLetter(def.charAt(idx + needle.length))) r = 5;
        if (r < rank) {
          rank = r;
          at = d;
        }
        if (r === 1) break;
      }
      add(words[i] as string, "english", rank, at);
    }
  }
}

export function fromJson(data: DictionaryData, options: { hsk?: HskList } = {}): Dictionary {
  return Dictionary.fromJson(data, options);
}

let loaded: Promise<Dictionary> | undefined;

async function fetchDictionary(): Promise<DictionaryData> {
  const res = await fetch(DICTIONARY_URL);
  if (!res.ok) throw new Error(`Could not load the dictionary (${res.status}).`);
  return (await res.json()) as DictionaryData;
}

/**
 * Loads the dictionary once and keeps it. Pass `load` to read the data some
 * other way (a test, or the server reading from disk), and `hsk` to rank
 * HSK words first. A failed load is not kept, so the next call tries again.
 */
export function loadDictionary(
  options: { load?: () => Promise<DictionaryData>; hsk?: HskList } = {},
): Promise<Dictionary> {
  if (!loaded) {
    loaded = (options.load ?? fetchDictionary)().then((d) => Dictionary.fromJson(d, { hsk: options.hsk }));
    loaded.catch(() => {
      loaded = undefined;
    });
  }
  return loaded;
}

/** Forgets the loaded dictionary. For tests. */
export function resetDictionary(): void {
  loaded = undefined;
}
