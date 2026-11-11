import type { Sentence, Text, Word } from "./model";
import { statusOf, type BandOf } from "./words";

// The quiz after a text: a handful of exercises made from the text itself,
// and the rules for marking them. Pure: the random function is passed in, so
// a fixed seed gives the same quiz (the tests rely on it), and nothing here
// touches the device or the screen.
//
// Every exercise is a plain object of one `type`, in the `Exercise` union.
// To add a type (typing pinyin and stroke writing are planned for 7e):
//   1. add its shape to the union below (a `type` and what the screen needs);
//   2. write a maker and call it from `makeQuiz`;
//   3. teach `judge` and `describe` about it (the compiler points at both,
//      their switches have no default);
//   4. draw it in src/components/quiz/exercises.tsx (same).

/** A random number from 0 up to, never reaching, 1. */
export type Rng = () => number;

/** A small seeded generator (mulberry32): the same seed always gives the same run. */
export function seeded(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// --- The exercises -------------------------------------------------------------

type Base = {
  /** Unique in the quiz: "match-1". */
  id: string;
  /** The sentence of the text it came from, shown when you miss it. Null when it's about the whole text. */
  sentence: string | null;
};

export type Choice = { text: string; pinyin?: string };

/** The text's own question. */
export type Comprehension = Base & {
  type: "comprehension";
  lang: "zh" | "en";
  question: string;
  options: string[];
  answer: number;
};

/** Tap a Chinese word, then its English: every pair. */
export type Match = Base & {
  type: "match";
  /** In the order they come in the text. */
  words: { word: string; pinyin: string }[];
  /** The meanings, shuffled; `word` says which one it belongs to. */
  meanings: { word: string; text: string }[];
};

/** What a word means, out of four. */
export type Meaning = Base & {
  type: "meaning";
  word: string;
  pinyin: string;
  options: string[];
  answer: number;
};

/** A sentence's tiles in a shuffled order, to put back. */
export type Reorder = Base & {
  type: "reorder";
  en: string;
  /** Shuffled; never already in order. */
  tiles: string[];
  /** The tiles in the order of the text. */
  order: string[];
};

/** A sentence with one word left out. */
export type Gap = Base & {
  type: "gap";
  before: string;
  after: string;
  en: string;
  word: string;
  options: Choice[];
  answer: number;
};

/** Hear a sentence, pick its English. Only made where there's a Chinese voice. */
export type Listen = Base & {
  type: "listen";
  /** What is read aloud. */
  zh: string;
  options: string[];
  answer: number;
};

export type Exercise = Comprehension | Match | Meaning | Reorder | Gap | Listen;
export type ExerciseType = Exercise["type"];

// --- Marking -------------------------------------------------------------------

/** What you did: a choice (by place in `options`), the tiles in the order you put them, or the words you paired wrongly. */
export type Response = { choice: number } | { order: string[] } | { wrong: string[] } | { skipped: true };

export type Outcome = {
  id: string;
  result: "right" | "wrong" | "skipped";
  /** Words you missed, to save for review. */
  missed: string[];
};

export function judge(exercise: Exercise, response: Response): Outcome {
  const outcome = (right: boolean, missed: string[] = []): Outcome => ({ id: exercise.id, result: right ? "right" : "wrong", missed: right ? [] : missed });
  if ("skipped" in response) return { id: exercise.id, result: "skipped", missed: [] };
  switch (exercise.type) {
    case "comprehension":
    case "listen":
      return outcome("choice" in response && response.choice === exercise.answer);
    case "meaning":
      return outcome("choice" in response && response.choice === exercise.answer, [exercise.word]);
    case "gap":
      return outcome("choice" in response && response.choice === exercise.answer, [exercise.word]);
    case "reorder":
      return outcome("order" in response && response.order.join("") === exercise.order.join(""));
    case "match": {
      const wrong = "wrong" in response ? [...new Set(response.wrong)] : [];
      return outcome(wrong.length === 0, wrong);
    }
  }
}

export type Score = { right: number; of: number; missed: Exercise[] };

/** Right answers out of every exercise; skipped ones count as missed. */
export function score(exercises: readonly Exercise[], outcomes: ReadonlyMap<string, Outcome>): Score {
  const missed = exercises.filter((exercise) => outcomes.get(exercise.id)?.result !== "right");
  return { right: exercises.length - missed.length, of: exercises.length, missed };
}

const NUMBERS = ["No", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten"];

/** "7 of 8." and, when there are misses, "Two to look at again:". */
export function resultLines(result: Score): { headline: string; again: string | null } {
  const count = result.missed.length;
  return {
    headline: `${result.right} of ${result.of}.`,
    again: count === 0 ? null : `${NUMBERS[count] ?? count} to look at again:`,
  };
}

/** What to show for an exercise in the list of misses and in the feedback: a prompt and the right answer. */
export function describe(exercise: Exercise): { prompt: string; answer: string; lang: "zh" | "en" } {
  switch (exercise.type) {
    case "comprehension":
      return { prompt: exercise.question, answer: exercise.options[exercise.answer]!, lang: exercise.lang };
    case "meaning":
      return { prompt: exercise.word, answer: exercise.options[exercise.answer]!, lang: "zh" };
    case "gap":
      return { prompt: exercise.en, answer: `${exercise.before}${exercise.word}${exercise.after}`, lang: "zh" };
    case "reorder":
      return { prompt: exercise.en, answer: exercise.order.join(""), lang: "zh" };
    case "listen":
      return { prompt: exercise.zh, answer: exercise.options[exercise.answer]!, lang: "zh" };
    case "match":
      return { prompt: "Match the words", answer: exercise.words.map(({ word }) => `${word} ${exercise.meanings.find((m) => m.word === word)!.text}`).join("; "), lang: "en" };
  }
}

// --- Making a quiz -------------------------------------------------------------

/** Your word records by headword (`wordBook`). */
export type QuizBook = ReadonlyMap<string, Pick<Word, "status" | "source">>;

export type QuizInput = {
  text: Text;
  /** Your word records: words you tapped, or that are new to you, come first. */
  book: QuizBook;
  bandOf: BandOf;
  assumedBand: number;
  rng: Rng;
  /** Whether there's a Chinese voice, for the listening exercise. */
  listening: boolean;
};

const shuffled = <T,>(items: readonly T[], rng: Rng): T[] => {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j]!, copy[i]!];
  }
  return copy;
};

const wordTokens = (sentence: Sentence) => sentence.tokens.filter((token) => token.w);
const sentenceText = (sentence: Sentence) => sentence.tokens.map((token) => token.t).join("");

// Meanings. Distractors must not mean the same as the answer, or two options
// would both be right, so definitions are compared by their content words.
const STOP = new Set("the and for with from that this one ones into onto out off its his her their your you are was were has have had not but who what which when where how any all can may per via etc".split(" "));
const contentWords = (defs: readonly string[]) => new Set(defs.flatMap((def) => def.toLowerCase().split(/[^a-z]+/)).filter((word) => word.length > 2 && !STOP.has(word)));

/** A short definition for an option: the first one, without a trailing note ("(快…的时候 just before)"). */
export function shortDef(defs: readonly string[]): string {
  const first = defs[0]!;
  const trimmed = first.replace(/\s*\([^)]*\)\s*$/, "").trim();
  return trimmed.length >= 3 ? trimmed : first;
}

// Words that only work as part of a sentence: particles, measure words and
// names make poor questions on their own.
const GRAMMAR = /^\((marks|measure|particle|used|after|sentence|modal|mood|auxiliary|indicates|interjection|grammatical|pronoun)/i;
const NAME = /\bname\b|\bsurname\b/i;

type Entry = { word: string; pinyin: string; defs: string[]; def: string; words: Set<string> };

/** The words a quiz may ask about: in the text, in its glossary, with a meaning that stands alone. */
function vocabulary(text: Text, book: QuizBook): Entry[] {
  const inText = new Set(text.sentences.flatMap((sentence) => wordTokens(sentence).map((token) => token.w!)));
  const entries: Entry[] = [];
  for (const word of inText) {
    const gloss = Object.hasOwn(text.glossary, word) ? text.glossary[word] : undefined;
    if (!gloss || GRAMMAR.test(gloss.defs[0]!) || gloss.defs.some((def) => NAME.test(def))) continue;
    // A meaning that is only a note, "(softens a request)", has nothing to pick.
    if (gloss.defs[0]!.replace(/\([^)]*\)/g, "").trim() === "") continue;
    if (/[0-9a-z]/i.test(word)) continue;
    if (book.get(word)?.status === "ignored") continue;
    entries.push({ word, pinyin: gloss.pinyin, defs: gloss.defs, def: shortDef(gloss.defs), words: contentWords(gloss.defs) });
  }
  return entries;
}

/** The two share a meaning word: they could both be the answer. */
const alike = (a: Entry, b: Entry) => a.def === b.def || [...a.words].some((word) => b.words.has(word));

export function makeQuiz(input: QuizInput): Exercise[] {
  const { text, book, bandOf, assumedBand, rng } = input;
  const entries = vocabulary(text, book);

  // Ranked: your words first, shuffled within each tier.
  const points = (entry: Entry) => {
    const record = book.get(entry.word);
    let p = 0;
    if (record?.status === "learning" || record?.source === "tapped") p += 4;
    else if (statusOf(entry.word, book, bandOf, assumedBand) === "new") p += 2;
    if (text.targetWords.includes(entry.word)) p += 1;
    return p;
  };
  const ranked = shuffled(entries, rng)
    .map((entry, i) => ({ entry, i, p: points(entry) }))
    .sort((a, b) => b.p - a.p || a.i - b.i)
    .map(({ entry }) => entry);

  const firstSentence = (word: string) => text.sentences.find((sentence) => sentence.tokens.some((token) => token.w === word))?.id ?? null;
  const used = new Set<string>();
  const counts: Record<string, number> = {};
  const id = (type: ExerciseType) => `${type}-${(counts[type] = (counts[type] ?? 0) + 1)}`;
  const usedSentences = new Set<string>();

  /** `count` words from the ranked list that don't mean the same as each other, unused ones first. */
  const pickWords = (count: number): Entry[] => {
    const chosen: Entry[] = [];
    for (const pool of [ranked.filter((entry) => !used.has(entry.word)), ranked.filter((entry) => used.has(entry.word))]) {
      for (const entry of pool) {
        if (chosen.length === count) break;
        if (chosen.some((other) => other.word === entry.word || alike(entry, other))) continue;
        chosen.push(entry);
      }
    }
    return chosen;
  };

  /** Wrong options for `answer`: other words of the text, none alike to it or each other. */
  const distractors = (answer: Entry, count: number, skip: (entry: Entry) => boolean = () => false): Entry[] => {
    const chosen: Entry[] = [];
    for (const entry of shuffled(entries, rng)) {
      if (chosen.length === count) break;
      if (entry.word === answer.word || skip(entry) || alike(entry, answer) || chosen.some((other) => alike(entry, other))) continue;
      chosen.push(entry);
    }
    return chosen;
  };

  const makeMatch = (): Match | null => {
    const picked = pickWords(5);
    if (picked.length < 3) return null;
    for (const entry of picked) used.add(entry.word);
    const inOrder = [...picked].sort((a, b) => firstIndex(text, a.word) - firstIndex(text, b.word));
    return {
      type: "match",
      id: id("match"),
      sentence: null,
      words: inOrder.map((entry) => ({ word: entry.word, pinyin: entry.pinyin })),
      meanings: shuffled(inOrder, rng).map((entry) => ({ word: entry.word, text: entry.def })),
    };
  };

  const makeMeaning = (): Meaning | null => {
    for (const answer of pickWords(6)) {
      const wrong = distractors(answer, 3, (entry) => entry.def.length > 70);
      if (wrong.length < 2 || answer.def.length > 70) continue;
      used.add(answer.word);
      const options = shuffled([answer, ...wrong], rng);
      return {
        type: "meaning",
        id: id("meaning"),
        sentence: firstSentence(answer.word),
        word: answer.word,
        pinyin: answer.pinyin,
        options: options.map((entry) => entry.def),
        answer: options.indexOf(answer),
      };
    }
    return null;
  };

  const makeGap = (): Gap | null => {
    for (const answer of pickWords(8)) {
      const places = text.sentences.filter((sentence) => {
        const words = wordTokens(sentence);
        return !usedSentences.has(sentence.id) && words.length >= 3 && words.length <= 16 && sentence.tokens.filter((token) => token.t === answer.word).length === 1 && words.some((token) => token.t === answer.word);
      });
      const sentence = shuffled(places, rng)[0];
      if (!sentence) continue;
      const at = sentence.tokens.findIndex((token) => token.t === answer.word);
      // Options can't already be in the sentence, or they'd read as clues or as answers.
      const inSentence = new Set(sentence.tokens.map((token) => token.w ?? token.t));
      const wrong = distractors(answer, 3, (entry) => inSentence.has(entry.word));
      if (wrong.length < 2) continue;
      used.add(answer.word);
      usedSentences.add(sentence.id);
      const options = shuffled([answer, ...wrong], rng);
      return {
        type: "gap",
        id: id("gap"),
        sentence: sentence.id,
        before: sentence.tokens.slice(0, at).map((token) => token.t).join(""),
        after: sentence.tokens.slice(at + 1).map((token) => token.t).join(""),
        en: sentence.en,
        word: answer.word,
        options: options.map((entry) => ({ text: entry.word, pinyin: entry.pinyin })),
        answer: options.indexOf(answer),
      };
    }
    return null;
  };

  const makeReorder = (): Reorder | null => {
    const fits = (min: number, max: number) =>
      text.sentences.filter((sentence) => {
        const tiles = wordTokens(sentence).map((token) => token.t);
        // Two identical tiles could go either way round: leave those sentences out.
        return !usedSentences.has(sentence.id) && tiles.length >= min && tiles.length <= max && new Set(tiles).size === tiles.length;
      });
    // Short sentences first; a text with none that short gets a slightly longer one.
    const candidates = fits(4, 9).length > 0 ? fits(4, 9) : fits(10, 12);
    for (const sentence of shuffled(candidates, rng)) {
      const order = wordTokens(sentence).map((token) => token.t);
      for (let tries = 0; tries < 12; tries++) {
        const tiles = shuffled(order, rng);
        if (tiles.join("") === order.join("")) continue;
        usedSentences.add(sentence.id);
        return { type: "reorder", id: id("reorder"), sentence: sentence.id, en: sentence.en, tiles, order };
      }
    }
    return null;
  };

  const makeListen = (): Listen | null => {
    if (!input.listening) return null;
    const heard = text.sentences.filter((sentence) => !usedSentences.has(sentence.id) && wordTokens(sentence).length >= 3 && wordTokens(sentence).length <= 12 && sentence.en.length <= 110);
    const sentence = shuffled(heard, rng)[0];
    if (!sentence) return null;
    // Wrong options are other sentences of the text, with different English.
    const others = shuffled(
      text.sentences.filter((other) => other.id !== sentence.id && other.en !== sentence.en && other.en.length <= 110),
      rng,
    ).slice(0, 3);
    if (others.length < 2) return null;
    usedSentences.add(sentence.id);
    const options = shuffled([sentence, ...others], rng);
    return { type: "listen", id: id("listen"), sentence: sentence.id, zh: sentenceText(sentence), options: options.map((option) => option.en), answer: options.indexOf(sentence) };
  };

  const questions: Comprehension[] = text.questions.map((question) => {
    const options = shuffled(question.options.map((option, i) => ({ option, right: i === question.answer })), rng);
    return { type: "comprehension", id: id("comprehension"), sentence: null, lang: question.lang, question: question.question, options: options.map(({ option }) => option), answer: options.findIndex(({ right }) => right) };
  });

  const exercises: Exercise[] = [...questions];
  const add = (exercise: Exercise | null) => exercise && exercises.push(exercise);
  add(makeMatch());
  add(makeMeaning());
  add(makeGap());
  add(makeReorder());
  add(makeListen());
  // A short text with few questions still gets a quiz of about seven.
  for (const more of [makeGap, makeMeaning, makeReorder, makeGap, makeMeaning]) {
    if (exercises.length >= 7) break;
    add(more());
  }
  return exercises;
}

/** Where a word first appears among the text's word tokens (for putting a match's words in text order). */
function firstIndex(text: Text, word: string): number {
  let n = 0;
  for (const sentence of text.sentences)
    for (const token of sentence.tokens) {
      if (token.w === word) return n;
      n++;
    }
  return n;
}
