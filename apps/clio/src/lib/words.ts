import type { Text, Word, WordStatus } from "./model";

// Which words you know. Nobody marks 2,200 words by hand, so a word with no
// record is judged by its HSK band: at or below the assumed band (Settings,
// 3 by default) it's known, above it new. Once a word has a record (you
// tapped it, reviewed it or marked it), the record decides.
//
// Bands come in as a function, so this works with any word list: the
// app's HSK lists, a text's own glossary, or both.

/** A word's HSK 3.0 band, or undefined when it isn't on the lists. */
export type BandOf = (word: string) => number | undefined;

/** Your word records by headword, deleted ones left out (`wordBook`). */
export type WordBook = ReadonlyMap<string, Pick<Word, "status">>;

export const DEFAULT_ASSUMED_BAND = 3;

export function wordBook(words: readonly Word[]): Map<string, Word> {
  return new Map(words.filter((word) => !word.deleted).map((word) => [word.id, word]));
}

/** A word's status: its record's, or else known or new by its band. */
export function statusOf(word: string, book: WordBook, bandOf: BandOf, assumedBand = DEFAULT_ASSUMED_BAND): WordStatus {
  const record = book.get(word);
  if (record) return record.status;
  const band = bandOf(word);
  return band !== undefined && band <= assumedBand ? "known" : "new";
}

export function isKnown(word: string, book: WordBook, bandOf: BandOf, assumedBand = DEFAULT_ASSUMED_BAND): boolean {
  return statusOf(word, book, bandOf, assumedBand) === "known";
}

/** A band lookup that falls back to the text's own glossary, for words the lists given don't have. */
export const withGlossary =
  (text: Pick<Text, "glossary">, bandOf: BandOf): BandOf =>
  (word) =>
    bandOf(word) ?? (Object.hasOwn(text.glossary, word) ? text.glossary[word]!.band : undefined);

export type Coverage = {
  /** Word tokens you know. */
  known: number;
  /** Word tokens counted: punctuation and ignored words are left out. */
  total: number;
  /** known / total; 1 for a text with nothing to count. */
  share: number;
  /** The headwords you don't know yet, each once, in the order they first appear. */
  unknown: string[];
};

/**
 * How much of a text you know: the share of its word tokens (a word used
 * twice counts twice) that are known. Ignored words count neither way, so
 * a name you've set aside doesn't make a text look harder. Bands come from
 * `bandOf`, then the text's glossary.
 */
export function coverage(text: Pick<Text, "sentences" | "glossary">, book: WordBook, bandOf: BandOf, assumedBand = DEFAULT_ASSUMED_BAND): Coverage {
  const band = withGlossary(text, bandOf);
  const unknown = new Set<string>();
  let known = 0;
  let total = 0;
  for (const sentence of text.sentences) {
    for (const token of sentence.tokens) {
      if (!token.w) continue;
      const status = statusOf(token.w, book, band, assumedBand);
      if (status === "ignored") continue;
      total++;
      if (status === "known") known++;
      else unknown.add(token.w);
    }
  }
  return { known, total, share: total === 0 ? 1 : known / total, unknown: [...unknown] };
}

/** Words due for review at `now`: in review, with a card that's come due. */
export function dueWords<W extends Pick<Word, "status" | "card" | "deleted">>(words: readonly W[], now: number): W[] {
  return words.filter((word) => !word.deleted && word.status === "learning" && word.card !== null && word.card.due <= now);
}
