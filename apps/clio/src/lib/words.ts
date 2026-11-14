import { CARD_STATES, DEFAULT_SETTINGS, type Text, type Word, type WordStatus } from "./model";

// Which words you know. Nobody marks 2,200 words by hand, so a word with no
// record is judged by its HSK band: at or below the assumed band (Settings,
// 3 by default) it's known, above it new. Once a word has a record (you
// tapped it, reviewed it or marked it), the record decides.
//
// Bands come in as a function, so this works with any word list: the
// app's HSK lists, a text's own glossary, or both.
//
// Names (李文, 大卫) are on no list, so by band they'd be new. A text's
// glossary marks them (`name: true`), and a name with no record counts as
// known: it's plain in the reader, a tap only looks it up, and it isn't a
// new word in coverage or at Finish. A record still decides, so a name you
// put in review or ignore is treated as you said.

/** A word's HSK 3.0 band, or undefined when it isn't on the lists. */
export type BandOf = (word: string) => number | undefined;

/** Your word records by headword, deleted ones left out (`wordBook`). */
export type WordBook = ReadonlyMap<string, Pick<Word, "status">>;

export const DEFAULT_ASSUMED_BAND = 3;

export function wordBook(words: readonly Word[]): Map<string, Word> {
  return new Map(words.filter((word) => !word.deleted).map((word) => [word.id, word]));
}

/** Whether a word is a name, in the text at hand (`namesIn`). */
export type NameOf = (word: string) => boolean;

const noNames: NameOf = () => false;

/** A text's names, from its glossary. */
export const namesIn =
  (text: Pick<Text, "glossary">): NameOf =>
  (word) =>
    Object.hasOwn(text.glossary, word) && text.glossary[word]!.name === true;

/** A word's status: its record's, or else known if it's a name, or known or new by its band. */
export function statusOf(word: string, book: WordBook, bandOf: BandOf, assumedBand = DEFAULT_ASSUMED_BAND, nameOf: NameOf = noNames): WordStatus {
  const record = book.get(word);
  if (record) return record.status;
  if (nameOf(word)) return "known";
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
 * a word you've set aside doesn't make a text look harder; names count as
 * known (`namesIn`). Bands come from `bandOf`, then the text's glossary.
 */
export function coverage(text: Pick<Text, "sentences" | "glossary">, book: WordBook, bandOf: BandOf, assumedBand = DEFAULT_ASSUMED_BAND): Coverage {
  const band = withGlossary(text, bandOf);
  const names = namesIn(text);
  const unknown = new Set<string>();
  let known = 0;
  let total = 0;
  for (const sentence of text.sentences) {
    for (const token of sentence.tokens) {
      if (!token.w) continue;
      const status = statusOf(token.w, book, band, assumedBand, names);
      if (status === "ignored") continue;
      total++;
      if (status === "known") known++;
      else unknown.add(token.w);
    }
  }
  return { known, total, share: total === 0 ? 1 : known / total, unknown: [...unknown] };
}

/**
 * Whether a word in review hasn't started yet: no card (a word set to
 * learning before cards existed), or a card never rated.
 */
export const isNewCard = (word: Pick<Word, "card">) => word.card === null || word.card.state === CARD_STATES.new;

/**
 * Words to review at `now`: those in review whose card has come due, then
 * up to `newLeft` that haven't started (new cards), oldest first. Only
 * `learning` words are in review: a known or ignored word keeps its card
 * but isn't asked about. `newLeft` defaults to the setting's default; the
 * review screen passes what's left of today's allowance (src/lib/review.ts).
 */
export function dueWords<W extends Pick<Word, "id" | "status" | "card" | "deleted" | "updatedAt">>(
  words: readonly W[],
  now: number,
  newLeft: number = DEFAULT_SETTINGS.newPerDay,
): W[] {
  const learning = words.filter((word) => !word.deleted && word.status === "learning");
  const due = learning.filter((word) => !isNewCard(word) && word.card!.due <= now).sort((a, b) => a.card!.due - b.card!.due || (a.id < b.id ? -1 : 1));
  const fresh = learning
    .filter((word) => isNewCard(word))
    .sort((a, b) => (a.card?.due ?? a.updatedAt) - (b.card?.due ?? b.updatedAt) || (a.id < b.id ? -1 : 1))
    .slice(0, Math.max(0, newLeft));
  return [...due, ...fresh];
}
