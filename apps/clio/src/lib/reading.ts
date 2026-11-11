import type { Reading, Text } from "./model";
import { namesIn, statusOf, withGlossary, type BandOf, type WordBook } from "./words";

// The reader's rules, kept apart from the screens so they can be tested:
// what finishing a text marks as known, which text to read next, and how
// reading time is counted.

const HAN = /\p{Script=Han}/gu;

/** How long a text is, in Chinese characters (punctuation and Latin letters left out): the library's "320 characters". */
export function characterCount(text: Pick<Text, "sentences">): number {
  let count = 0;
  for (const sentence of text.sentences) for (const token of sentence.tokens) count += token.t.match(HAN)?.length ?? 0;
  return count;
}

/** Word tokens in a text (a word used twice counts twice): what reading it adds to "words read". */
export function wordTokenCount(text: Pick<Text, "sentences">): number {
  let count = 0;
  for (const sentence of text.sentences) for (const token of sentence.tokens) if (token.w) count++;
  return count;
}

/**
 * The finish rule (Du Chinese's and LingQ's): what you didn't tap, you
 * knew. Finishing marks as known each word of the text that has no record
 * and would otherwise count as new. A word with a record keeps it, whatever
 * it says: you tapped it (and it went into review), marked it, or set it
 * aside, and finishing shouldn't undo that. Words known by their band, and
 * names, need nothing. Each headword once, in the order it first appears.
 */
export function wordsToMarkKnown(text: Pick<Text, "sentences" | "glossary">, book: WordBook, bandOf: BandOf, assumedBand: number): string[] {
  const band = withGlossary(text, bandOf);
  const names = namesIn(text);
  const marks = new Set<string>();
  for (const sentence of text.sentences) {
    for (const token of sentence.tokens) {
      const word = token.w;
      if (!word || marks.has(word) || book.has(word)) continue;
      if (statusOf(word, book, band, assumedBand, names) === "new") marks.add(word);
    }
  }
  return [...marks];
}

export type ReadingState = "unread" | "started" | "finished";

/** Where you are with a text. Finished stays finished, even when you open it again. */
export function readingState(reading: Pick<Reading, "finishedAt" | "deleted"> | undefined): ReadingState {
  if (!reading || reading.deleted) return "unread";
  return reading.finishedAt !== null ? "finished" : "started";
}

/**
 * The comfortable range for a text's coverage (the share of its words you
 * know). Studies of reading in a second language (Hu and Nation, 2000;
 * Schmitt and others, 2011) put easy, unassisted reading at about 98% of
 * words known, and graded readers aim for 95–98%. With a tap to look a
 * word up, a little lower still reads well, so 90% is the floor; above 98%
 * there's little left to learn. The middle is the target.
 */
export const COMFORTABLE = { low: 0.9, high: 0.98, target: 0.95 } as const;

/** How far a coverage is from the comfortable range: 0 inside it. */
const outside = (share: number) => (share < COMFORTABLE.low ? COMFORTABLE.low - share : share > COMFORTABLE.high ? share - COMFORTABLE.high : 0);

export type NextText<T> = { text: T; reason: "continue" | "next" };

/**
 * What to read next, for Today: the text you're in the middle of (the one
 * you had open last), or else the best unread text. Best means in the
 * comfortable range, nearest its middle; if none is, the one nearest the
 * range. Ties go to the newest. Null when there's nothing left to read.
 */
export function nextText<T extends Pick<Text, "id" | "createdAt">>(
  texts: readonly T[],
  readings: ReadonlyMap<string, Pick<Reading, "lastReadAt" | "finishedAt" | "deleted">>,
  shareOf: (text: T) => number,
): NextText<T> | null {
  let current: { text: T; at: number } | null = null;
  for (const text of texts) {
    const reading = readings.get(text.id);
    if (readingState(reading) !== "started") continue;
    if (!current || reading!.lastReadAt > current.at) current = { text, at: reading!.lastReadAt };
  }
  if (current) return { text: current.text, reason: "continue" };

  let best: { text: T; score: [number, number, number] } | null = null;
  for (const text of texts) {
    if (readingState(readings.get(text.id)) !== "unread") continue;
    const share = shareOf(text);
    const score: [number, number, number] = [outside(share), Math.abs(share - COMFORTABLE.target), -text.createdAt];
    if (!best || less(score, best.score)) best = { text, score };
  }
  return best ? { text: best.text, reason: "next" } : null;
}

const less = (a: readonly number[], b: readonly number[]) => {
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i]! < b[i]!;
  return false;
};

// --- Reading time ------------------------------------------------------------
//
// Time counts while you're active: every tap, scroll or key (and the audio
// playing) is a sign of life, and the time since the last one is added, but
// never more than PAUSE_CAP_MS for one gap. So a long look at a hard
// sentence counts, and a phone left open on the table adds at most that
// once. A hidden page pauses the clock.

/** The most one pause between signs of life adds. */
export const PAUSE_CAP_MS = 90_000;

export type Clock = {
  /** The last sign of life; null while paused (hidden, or not started). */
  last: number | null;
  /** Time counted and not yet saved. */
  ms: number;
};

export const STOPPED: Clock = { last: null, ms: 0 };

/** A sign of life at `now`: counts the time since the last one, up to the cap. */
export function tick(clock: Clock, now: number, cap = PAUSE_CAP_MS): Clock {
  const gap = clock.last === null ? 0 : Math.min(Math.max(0, now - clock.last), cap);
  return { last: now, ms: clock.ms + gap };
}

/** The page went away (hidden, closed): counts up to now, within the cap, then waits for the next sign of life. */
export function pause(clock: Clock, now: number, cap = PAUSE_CAP_MS): Clock {
  return { ...tick(clock, now, cap), last: null };
}

/** The whole seconds counted, to save, and the clock with the rest kept. */
export function takeSeconds(clock: Clock): [seconds: number, clock: Clock] {
  const seconds = Math.floor(clock.ms / 1000);
  return [seconds, { ...clock, ms: clock.ms - seconds * 1000 }];
}
