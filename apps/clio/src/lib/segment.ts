// Splits Chinese text into words by forward maximum matching: at each
// position, take the longest run of characters that is a word in the
// dictionary or the HSK list.
//
// Why this and not something smarter: it is predictable. The same text always
// splits the same way, and a wrong split is easy to see and to explain. It
// will be used to check that a written text stays within a level, and to make
// pasted text readable, so dependable matters more than clever.
//
// A note on ties: forward matching takes the longest match, and two different
// words can't have the same length at the same spot, so there is nothing to
// break a tie on. HSK words get their say another way: each token says whether
// it is an HSK word and which band, and `maxWordLength` (default 8) keeps long
// dictionary phrases from swallowing several words.

import type { HskBand } from "./hsk";

/** Anything with a `has`. The Dictionary and HskList both fit. */
export interface WordSource {
  has(word: string): boolean;
}

export interface Vocabulary {
  dictionary?: WordSource;
  hsk?: WordSource & { bandOf(word: string): HskBand | undefined };
}

export type TokenKind =
  /** A word found in the dictionary or the HSK list. */
  | "word"
  /** A Chinese character found in neither. It is on its own. */
  | "unknown"
  /** A run of Latin letters and digits, like "iPhone", "2026" or "3.5". */
  | "latin"
  /** One punctuation mark or symbol. */
  | "punct"
  /** A run of spaces, tabs or line breaks. */
  | "space"
  /** Anything else (other scripts, emoji parts). One character each. */
  | "other";

export interface Token {
  text: string;
  kind: TokenKind;
  /** For words on the HSK list. */
  band?: HskBand;
}

export interface SegmentOptions {
  /** The longest word to look for, in characters. Default 8. */
  maxWordLength?: number;
}

const HAN = /^\p{Script=Han}$/u;
const SPACE = /^\s$/u;
const PUNCT = /^[\p{P}\p{S}]$/u;
// Latin letters and digits, joined by one ".", "'", "-", "," or "_" between
// them so "3.5", "don't" and "e-mail" stay whole. The fullwidth forms (ＡＢＣ１２３) count too.
const LATIN_RUN = /^[A-Za-z0-9Ａ-Ｚａ-ｚ０-９À-ɏ]+(?:[.'’,_-][A-Za-z0-9Ａ-Ｚａ-ｚ０-９À-ɏ]+)*/;

/** Splits `text` into tokens. Joining the tokens' text gives `text` back exactly. */
export function segment(text: string, vocab: Vocabulary, options: SegmentOptions = {}): Token[] {
  const { dictionary, hsk } = vocab;
  const maxLen = Math.max(1, options.maxWordLength ?? 8);
  const known = (w: string) => Boolean(hsk?.has(w) || dictionary?.has(w));
  const chars = Array.from(text);
  const tokens: Token[] = [];

  let i = 0;
  while (i < chars.length) {
    const ch = chars[i] as string;

    if (HAN.test(ch)) {
      // Longest first. A single character that nothing knows is "unknown".
      // Only Han characters can be inside a word, so stop at the first that isn't.
      let reach = 1;
      while (reach < maxLen && i + reach < chars.length && HAN.test(chars[i + reach] as string)) reach++;
      let found = 0;
      for (let len = reach; len >= 1; len--) {
        if (known(chars.slice(i, i + len).join(""))) {
          found = len;
          break;
        }
      }
      const len = found || 1;
      const word = chars.slice(i, i + len).join("");
      const band = hsk?.bandOf(word);
      const token: Token = { text: word, kind: found ? "word" : "unknown" };
      if (band) token.band = band;
      tokens.push(token);
      i += len;
      continue;
    }

    if (SPACE.test(ch)) {
      let j = i + 1;
      while (j < chars.length && SPACE.test(chars[j] as string)) j++;
      tokens.push({ text: chars.slice(i, j).join(""), kind: "space" });
      i = j;
      continue;
    }

    const run = LATIN_RUN.exec(chars.slice(i, i + 64).join(""));
    if (run) {
      tokens.push({ text: run[0], kind: "latin" });
      i += Array.from(run[0]).length;
      continue;
    }

    tokens.push({ text: ch, kind: PUNCT.test(ch) ? "punct" : "other" });
    i++;
  }
  return tokens;
}

/** Just the words: tokens that are in the dictionary or HSK list, in order. */
export function wordsOf(tokens: readonly Token[]): Token[] {
  return tokens.filter((t) => t.kind === "word");
}
