// What the Words screen shows, worked out from your records and the word
// lists. Pure: no browser, no loading, so it's all tested.

import type { SearchResult } from "@/lib/dictionary";
import { HSK_BANDS, type HskBand, type HskEntry, type HskList } from "@/lib/hsk";
import type { Card, Word, WordStatus } from "@/lib/model";
import { searchKey } from "@/lib/pinyin";
import { statusOf, type WordBook } from "@/lib/words";

// --- Progress by band --------------------------------------------------------

export type BandProgress = { band: HskBand; known: number; total: number };

/**
 * How many of each band's words you know. The rule is the foundation's
 * (`statusOf`): no record means known up to the assumed band, and a record
 * decides. Ignored words aren't known.
 */
export function bandProgress(hsk: Pick<HskList, "wordsInBand">, book: WordBook, assumedBand: number): BandProgress[] {
  return HSK_BANDS.map((band) => {
    const entries = hsk.wordsInBand(band);
    let known = 0;
    for (const entry of entries) if (statusOf(entry.word, book, () => band, assumedBand) === "known") known++;
    return { band, known, total: entries.length };
  });
}

// --- Your words --------------------------------------------------------------

export const YOUR_TABS = ["learning", "known", "ignored"] as const;
export type YourTab = (typeof YOUR_TABS)[number];

/**
 * The words with a record that belong under a tab. Learning is what's in
 * review, and also a word you only starred. Known and Ignored are the
 * records with that status: a word known by its band has no record, so
 * it isn't listed. Learning goes soonest due first, then the rest; the other
 * tabs go newest change first.
 */
export function yourWords(words: readonly Word[], tab: YourTab): Word[] {
  const mine = words.filter((word) => !word.deleted);
  if (tab === "known") return mine.filter((word) => word.status === "known").sort(newest);
  if (tab === "ignored") return mine.filter((word) => word.status === "ignored").sort(newest);
  return mine
    .filter((word) => word.status === "learning" || (word.status === "new" && word.saved))
    .sort((a, b) => (a.card && b.card ? a.card.due - b.card.due : a.card ? -1 : b.card ? 1 : newest(a, b)));
}

const newest = (a: Word, b: Word) => b.updatedAt - a.updatedAt || (a.id < b.id ? -1 : 1);

/** How many words each tab holds, for the tab labels. */
export function tabCounts(words: readonly Word[]): Record<YourTab, number> {
  return { learning: yourWords(words, "learning").length, known: yourWords(words, "known").length, ignored: yourWords(words, "ignored").length };
}

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

/** When a word's next review is: "Due now", "Due in 3 days". Null for a word with no card. */
export function dueLabel(card: Pick<Card, "due"> | null, now: number): string | null {
  if (!card) return null;
  const wait = card.due - now;
  if (wait <= 0) return "Due now";
  if (wait < HOUR) return "Due in under an hour";
  // Under a day, but 23.6 hours would round to "24 hours": that's tomorrow.
  if (wait < DAY - HOUR / 2) {
    const hours = Math.round(wait / HOUR);
    return hours === 1 ? "Due in 1 hour" : `Due in ${hours} hours`;
  }
  const days = Math.round(wait / DAY);
  return days === 1 ? "Due tomorrow" : `Due in ${days} days`;
}

// --- Browsing a band ---------------------------------------------------------

export const BROWSE_FILTERS = ["all", "todo", "known"] as const;
/** all; todo: new or learning, what's left to learn; known. */
export type BrowseFilter = (typeof BROWSE_FILTERS)[number];

export type BandRow = { entry: HskEntry; status: WordStatus };

/** A band's words with their status, in the list's order, narrowed by the filter. */
export function bandRows(hsk: Pick<HskList, "wordsInBand">, band: HskBand, book: WordBook, assumedBand: number, filter: BrowseFilter = "all"): BandRow[] {
  const rows: BandRow[] = [];
  for (const entry of hsk.wordsInBand(band)) {
    const status = statusOf(entry.word, book, () => band, assumedBand);
    if (filter === "known" && status !== "known") continue;
    if (filter === "todo" && status !== "new" && status !== "learning") continue;
    rows.push({ entry, status });
  }
  return rows;
}

export type Mark = { set: WordStatus } | "forget";

/**
 * What to do to make a word `target`. Making it "new" removes its record
 * when that gets there (a word above the assumed band, with no schedule or
 * context worth keeping); otherwise the record says "new", which is how a
 * word in bands 1 to 3 is made unknown.
 */
export function planMark(target: WordStatus, record: Word | undefined, defaultStatus: WordStatus): Mark {
  if (target !== "new") return { set: target };
  const keeps = record !== undefined && (record.card !== null || record.saved || record.context !== null);
  return defaultStatus === "new" && !keeps ? "forget" : { set: "new" };
}

/** Splits many words into the ones to save with the status and the ones to forget. */
export function planMarks(
  headwords: readonly string[],
  target: WordStatus,
  book: ReadonlyMap<string, Word>,
  bandOf: (word: string) => number | undefined,
  assumedBand: number,
): { set: string[]; forget: string[] } {
  const none: WordBook = new Map();
  const out = { set: [] as string[], forget: [] as string[] };
  for (const word of headwords) {
    const plan = planMark(target, book.get(word), statusOf(word, none, bandOf, assumedBand));
    if (plan === "forget") {
      if (book.has(word)) out.forget.push(word);
    } else out.set.push(word);
  }
  return out;
}

// --- Search ------------------------------------------------------------------

export type Found = {
  word: string;
  pinyin: string;
  gloss: string;
  band?: HskBand;
  match: "word" | "pinyin" | "english";
};

const HAN = /\p{Script=Han}/u;

/** The first meanings, short enough for a row: "to eat; to consume". Measure-word notes ("CL:个[gè]") are left out. */
export function shortGloss(definitions: readonly string[], max = 2): string {
  return definitions.filter((definition) => !definition.startsWith("CL:")).slice(0, max).join("; ");
}

/** A dictionary result as a row. The first everyday reading leads. */
export function foundFrom({ entry, match }: SearchResult): Found {
  const reading = entry.readings.find((r) => !r.proper) ?? entry.readings[0];
  return { word: entry.word, pinyin: reading?.pinyin ?? "", gloss: shortGloss(reading?.definitions ?? []), band: entry.hskBand, match };
}

/**
 * Search with only the HSK list (before the dictionary is on the phone):
 * characters, pinyin with or without tones, or English in the short
 * glosses. Exact first, then lower bands, then shorter words.
 */
export function searchHsk(hsk: Pick<HskList, "wordsUpToBand">, query: string, limit = 30): Found[] {
  const q = query.trim();
  if (!q) return [];
  const han = HAN.test(q);
  const compact = q.replace(/\s+/g, "");
  const key = han ? "" : searchKey(q);
  const needle = q.toLowerCase().replace(/\s+/g, " ");
  const hits: { found: Found; rank: number }[] = [];

  for (const entry of hsk.wordsUpToBand(7)) {
    let rank: number | undefined;
    let match: Found["match"] = "word";
    if (han) {
      if (entry.word === compact) rank = 0;
      else if (entry.word.startsWith(compact)) rank = 2;
      else if (entry.word.includes(compact)) rank = 3;
    } else {
      const have = searchKey(entry.pinyin);
      const gloss = entry.gloss?.toLowerCase() ?? "";
      if (key && have === key) {
        rank = 1;
        match = "pinyin";
      } else if (key && have.startsWith(key)) {
        rank = 6;
        match = "pinyin";
      } else if (needle.length >= 2 && gloss.includes(needle)) {
        rank = gloss === needle ? 1 : 5;
        match = "english";
      }
    }
    if (rank !== undefined) hits.push({ rank, found: { word: entry.word, pinyin: entry.pinyin, gloss: entry.gloss ?? "", band: entry.band, match } });
  }
  hits.sort((a, b) => a.rank - b.rank || (a.found.band ?? 8) - (b.found.band ?? 8) || a.found.word.length - b.found.word.length || (a.found.word < b.found.word ? -1 : 1));
  return hits.slice(0, limit).map((hit) => hit.found);
}

// --- A word's detail ---------------------------------------------------------

/** The distinct characters a word is made of, in order; none for a single character. */
export function charactersOf(word: string): string[] {
  const chars = [...word].filter((c) => HAN.test(c));
  return chars.length > 1 ? [...new Set(chars)] : [];
}

/** A few other HSK words that contain this one, lower bands first, then shorter. */
export function wordsContaining(hsk: Pick<HskList, "wordsUpToBand">, word: string, limit = 6): HskEntry[] {
  return hsk
    .wordsUpToBand(7)
    .filter((entry) => entry.word !== word && entry.word.includes(word))
    .sort((a, b) => a.band - b.band || a.word.length - b.word.length || (a.word < b.word ? -1 : 1))
    .slice(0, limit);
}
