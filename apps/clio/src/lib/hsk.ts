// The HSK 3.0 word list (2021 standard), as a lookup.
//
// The data is public/data/hsk.json, made by scripts/build-hsk.mjs. In the
// browser, loadHsk() fetches it once and keeps it in memory (the service
// worker caches the file itself). In Node and in tests, read the file
// yourself and call fromJson(), so nothing here needs fetch.

/** 1 to 6, and 7 for "7-9" (the standard's top three bands are one group). */
export type HskBand = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export const HSK_BANDS: readonly HskBand[] = [1, 2, 3, 4, 5, 6, 7];

/** "HSK 3", or "HSK 7-9" for band 7. */
export function bandLabel(band: HskBand): string {
  return band === 7 ? "HSK 7–9" : `HSK ${band}`;
}

export interface HskEntry {
  /** Simplified form. */
  word: string;
  /** With tone marks. */
  pinyin: string;
  band: HskBand;
  /** A short English hint, when the source had one. */
  gloss?: string;
}

/** The shape of public/data/hsk.json. Each word is [word, pinyin, band, gloss?]. */
export interface HskData {
  words: [string, string, number, string?][];
}

export const HSK_URL = "/data/hsk.json";

function isBand(n: unknown): n is HskBand {
  return Number.isInteger(n) && (n as number) >= 1 && (n as number) <= 7;
}

export class HskList {
  private readonly byWord = new Map<string, HskEntry>();
  private readonly byBand = new Map<HskBand, HskEntry[]>(HSK_BANDS.map((b) => [b, []]));
  /** Length of the longest word, for the segmenter. */
  readonly maxWordLength: number;

  constructor(entries: readonly HskEntry[]) {
    let longest = 0;
    for (const e of entries) {
      // If a word is listed twice, the lower band wins.
      const have = this.byWord.get(e.word);
      if (have && have.band <= e.band) continue;
      if (have) {
        const list = this.byBand.get(have.band) ?? [];
        list.splice(list.indexOf(have), 1);
      }
      this.byWord.set(e.word, e);
      this.byBand.get(e.band)?.push(e);
      longest = Math.max(longest, [...e.word].length);
    }
    this.maxWordLength = longest;
  }

  /** Builds the list from the parsed hsk.json. Throws if the data is the wrong shape. */
  static fromJson(data: HskData): HskList {
    if (!data || !Array.isArray(data.words)) throw new Error("hsk.json: expected a words list");
    const entries: HskEntry[] = data.words.map((w, i) => {
      const [word, pinyin, band, gloss] = w;
      if (typeof word !== "string" || typeof pinyin !== "string" || !isBand(band)) {
        throw new Error(`hsk.json: bad word at position ${i}`);
      }
      return gloss ? { word, pinyin, band, gloss } : { word, pinyin, band };
    });
    return new HskList(entries);
  }

  get size(): number {
    return this.byWord.size;
  }

  has(word: string): boolean {
    return this.byWord.has(word);
  }

  /** The word's band, or undefined if it isn't on the list. */
  bandOf(word: string): HskBand | undefined {
    return this.byWord.get(word)?.band;
  }

  entry(word: string): HskEntry | undefined {
    return this.byWord.get(word);
  }

  /** Words that first appear in this band, in the source's order. */
  wordsInBand(band: HskBand): readonly HskEntry[] {
    return this.byBand.get(band) ?? [];
  }

  /** Words in this band and every band below it. */
  wordsUpToBand(band: HskBand): HskEntry[] {
    return HSK_BANDS.filter((b) => b <= band).flatMap((b) => this.byBand.get(b) ?? []);
  }

  /** How many words each band adds. Index 0 is band 1. */
  counts(): number[] {
    return HSK_BANDS.map((b) => this.byBand.get(b)?.length ?? 0);
  }

  /** Running totals: how many words you know at the end of each band. */
  cumulativeCounts(): number[] {
    let sum = 0;
    return this.counts().map((n) => (sum += n));
  }
}

export function fromJson(data: HskData): HskList {
  return HskList.fromJson(data);
}

let loaded: Promise<HskList> | undefined;

async function fetchHsk(): Promise<HskData> {
  const res = await fetch(HSK_URL);
  if (!res.ok) throw new Error(`Could not load the HSK list (${res.status}).`);
  return (await res.json()) as HskData;
}

/**
 * Loads the list once and keeps it. Pass `load` to read the data some other
 * way (a test, or the server reading from disk). A failed load is not kept,
 * so the next call tries again.
 */
export function loadHsk(load: () => Promise<HskData> = fetchHsk): Promise<HskList> {
  if (!loaded) {
    loaded = load().then(HskList.fromJson);
    loaded.catch(() => {
      loaded = undefined;
    });
  }
  return loaded;
}

/** Forgets the loaded list. For tests. */
export function resetHsk(): void {
  loaded = undefined;
}
