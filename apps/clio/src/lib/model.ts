import { recordBase } from "@atlas/sync/records";
import { z } from "zod";

// Clio's records, the same on the phone and on the server, synced by
// @atlas/sync: each has an ID, the time it last changed and a deleted flag
// (recordBase).
//
// Two kinds of thing live here. Content: the texts you read, written on the
// server (by Claude, from step 7c) or shipped with the app as samples. And
// what's yours: each word's state and its review schedule, the reviews
// themselves, how far you got in each text, each day's activity, and the
// settings.
//
// Chinese is simplified characters. Pinyin is written with tone marks
// ("nǐ hǎo"), never tone numbers. A headword is a word as the dictionary
// lists it ("学习"). Calendar dates are YYYY-MM-DD; moments are
// milliseconds.

const base = recordBase;
const id = z.string().min(1).max(128);
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const moment = z.number().int().nonnegative();
/** A word as the dictionary lists it: "学习", "了". */
const headword = z.string().trim().min(1).max(32);
const pinyin = z.string().max(400);
const zh = z.string().min(1).max(2000);
const en = z.string().max(2000);

/** HSK 3.0's bands. The word lists put 7, 8 and 9 together; a text can still be graded 7, 8 or 9. */
export const BANDS = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const;
const band = z.number().int().min(1).max(9);

// --- Content -----------------------------------------------------------------

export const TEXT_KINDS = ["story", "dialogue", "news", "culture"] as const;
export type TextKind = (typeof TEXT_KINDS)[number];

/** What texts are about, as chosen in Settings: daily life and dialogues, news, culture and history. */
export const TOPICS = ["daily", "news", "culture"] as const;
export type Topic = (typeof TOPICS)[number];

/**
 * One word or mark as it appears in a sentence. `t` is the text itself;
 * `p` its pinyin as read here (a 了 is "le" or "liǎo" by context, a 一
 * changes tone); `w` the headword to look up, which can differ from `t`
 * (a name inside a longer token, a reduplicated verb). Punctuation and
 * spaces have only `t`. Short keys, because a text has hundreds.
 */
export const tokenSchema = z.object({
  t: z.string().min(1).max(32),
  p: z.string().max(120).optional(),
  w: headword.optional(),
});

export const sentenceSchema = z.object({
  /** Unique within the text: "s1", "s2"… Audio timings and reading records point at it. */
  id: z.string().min(1).max(32),
  /** Who says it, in a dialogue: "王老师". */
  speaker: z.string().max(40).nullable().default(null),
  tokens: z.array(tokenSchema).min(1).max(200),
  /** The whole sentence in English. */
  en,
});

/** What a headword means here, so the text can be read without the dictionary loaded. */
export const glossEntrySchema = z.object({
  pinyin: z.string().min(1).max(120),
  defs: z.array(z.string().min(1).max(200)).min(1).max(8),
  /** Its HSK 3.0 band, when it's on the lists. */
  band: band.optional(),
});

/** A grammar point the text uses, with one example. */
export const noteSchema = z.object({
  title: z.string().min(1).max(120),
  explanation: z.string().min(1).max(2000),
  example: z.object({ zh, pinyin, en }).nullable().default(null),
});

/** A comprehension question, multiple choice. */
export const questionSchema = z
  .object({
    /** The question and its options are in Chinese or in English; Chinese ones are drawn in the CJK font. */
    lang: z.enum(["zh", "en"]).default("en"),
    question: z.string().min(1).max(500),
    options: z.array(z.string().min(1).max(300)).min(2).max(6),
    /** The right option, from 0. */
    answer: z.number().int().nonnegative(),
  })
  .refine((question) => question.answer < question.options.length, { message: "The answer must be one of the options." });

/** Times in milliseconds from the start of the file. */
const span = { start: moment, end: moment };

/**
 * The text read aloud (from step 7d, by Azure Speech): one file, where each
 * sentence starts and ends, and each word, for highlighting as it plays.
 * `token` is the word's place in its sentence's `tokens`.
 */
export const audioSchema = z.object({
  /** On Clio's own server, e.g. "/api/audio/<text>.mp3". */
  url: z.string().min(1).max(500),
  sentences: z.array(z.object({ id: z.string().min(1).max(32), ...span })).default([]),
  words: z.array(z.object({ sentence: z.string().min(1).max(32), token: z.number().int().nonnegative(), ...span })).default([]),
});

/**
 * A graded text, a synced kind like the rest.
 *
 * How texts reach the phone (decided in 7a, for 7c): by sync. The server
 * can write records itself (`applyChanges` in @atlas/sync/server, as
 * Tyche's exchange rates and Hygeia's attachments do), so the generation job
 * saves each new text as a `text` record and every device gets it on its
 * next sync, offline afterwards like everything else. No second channel,
 * no download step. The server keeps about 15 unread texts ahead of you;
 * a text you remove from the library is marked deleted, which syncs too.
 * Audio stays a file on the server, named by `audio.url`, not inside the
 * record. Sample texts have this same shape: they ship with the app and
 * are put on the device with `Device.seed` (IDs "sample-<name>"), so a
 * generated text and a sample are read by the same code.
 */
export const textSchema = z.object({
  ...base,
  kind: z.enum(TEXT_KINDS),
  /** The band it's written for: most of its words are at or below it. */
  band,
  /** A few words on what it's about: "At the market", "Rain in Beijing". */
  topic: z.string().min(1).max(80),
  title: z.object({ zh: z.string().min(1).max(120), pinyin: z.string().max(400), en: z.string().max(200) }),
  /** Where a news story came from, before it was simplified. */
  source: z.object({ name: z.string().min(1).max(120), url: z.url().max(1000) }).nullable().default(null),
  sentences: z.array(sentenceSchema).min(1).max(300),
  /** Every headword in the text, by headword. */
  glossary: z.record(z.string().min(1).max(32), glossEntrySchema).default({}),
  /** The new words it was written to teach (5–8 above your level), for the reader to point out. */
  targetWords: z.array(headword).max(20).default([]),
  notes: z.array(noteSchema).max(10).default([]),
  questions: z.array(questionSchema).max(10).default([]),
  audio: audioSchema.nullable().default(null),
  /** sample: shipped with the app. generated: written on the server. */
  origin: z.enum(["sample", "generated"]).default("generated"),
  createdAt: moment,
});

// --- Yours -------------------------------------------------------------------

/**
 * new: seen, not learned. learning: in review. known: you know it, so it
 * counts as known in every text. ignored: never asked about or counted (a
 * name, a word you don't care for).
 */
export const WORD_STATUSES = ["new", "learning", "known", "ignored"] as const;
export type WordStatus = (typeof WORD_STATUSES)[number];

/**
 * How a word got its record. band: made from the assumed band (a word you
 * know from the lists, put in review or marked otherwise). tapped: looked up
 * in a text. reviewed: changed by a review. marked: set by hand in Words.
 */
export const WORD_SOURCES = ["band", "tapped", "reviewed", "marked"] as const;
export type WordSource = (typeof WORD_SOURCES)[number];

/** FSRS's card states, numbered as ts-fsrs numbers them. */
export const CARD_STATES = { new: 0, learning: 1, review: 2, relearning: 3 } as const;

/**
 * A word's review schedule, field for field ts-fsrs's `Card` (step 7b), in
 * this suite's style: camelCase, and moments as milliseconds where ts-fsrs
 * has Dates (`due`, `last_review`). Convert at the edge: `new Date(due)`.
 */
export const cardSchema = z.object({
  due: moment,
  stability: z.number().nonnegative(),
  difficulty: z.number().nonnegative(),
  elapsedDays: z.number().nonnegative(),
  scheduledDays: z.number().nonnegative(),
  learningSteps: z.number().int().nonnegative().default(0),
  reps: z.number().int().nonnegative(),
  lapses: z.number().int().nonnegative(),
  state: z.number().int().min(0).max(3),
  lastReview: moment.nullable().default(null),
});

/**
 * Your state for one word. The ID is the headword itself, so two devices
 * that tap the same word make one record. A word with no record is known or
 * new by its band (src/lib/words.ts).
 */
export const wordSchema = z.object({
  ...base,
  status: z.enum(WORD_STATUSES),
  /** Kept in your word list (a star), whatever its status. */
  saved: z.boolean().default(false),
  source: z.enum(WORD_SOURCES),
  /** Where you met it, for the sentence on its review card. */
  context: z.object({ textId: id, sentenceId: z.string().min(1).max(32) }).nullable().default(null),
  /** Its schedule while in review; null before it's ever reviewed. */
  card: cardSchema.nullable().default(null),
});

/** Again, Hard, Good, Easy, numbered as ts-fsrs's `Rating`. */
export const RATINGS = { again: 1, hard: 2, good: 3, easy: 4 } as const;

/**
 * One review, as ts-fsrs's `ReviewLog`: the rating and the card as it was
 * before it. Never changed once written; a random ID.
 */
export const reviewSchema = z.object({
  ...base,
  word: headword,
  rating: z.number().int().min(1).max(4),
  state: z.number().int().min(0).max(3),
  due: moment,
  stability: z.number().nonnegative(),
  difficulty: z.number().nonnegative(),
  elapsedDays: z.number().nonnegative(),
  lastElapsedDays: z.number().nonnegative(),
  scheduledDays: z.number().nonnegative(),
  learningSteps: z.number().int().nonnegative().default(0),
  /** When you answered. */
  review: moment,
});

/** How far you got in one text. Its ID is the text's ID. */
export const readingSchema = z.object({
  ...base,
  startedAt: moment,
  /** When you last had it open: the library's "Continue". */
  lastReadAt: moment,
  finishedAt: moment.nullable().default(null),
  /** The furthest sentence reached, by its place in the text (from 0). */
  furthest: z.number().int().nonnegative().default(0),
  /** The quiz after it, once taken: right answers out of how many. */
  quiz: z.object({ right: z.number().int().nonnegative(), of: z.number().int().positive(), at: moment }).nullable().default(null),
});

/**
 * One day's activity on one device, for the streak and the daily goal. Its
 * ID is "<date>/<device>" (`dayId`): each device only adds to its own, so
 * two phones used on the same day never overwrite each other's counts. A
 * day's total is the sum over its devices.
 */
export const daySchema = z.object({
  ...base,
  date,
  device: z.string().min(1).max(64),
  /** Time spent reading, reviewing and in quizzes. */
  seconds: z.number().int().nonnegative().default(0),
  reviews: z.number().int().nonnegative().default(0),
  textsFinished: z.number().int().nonnegative().default(0),
  /** Word tokens read (a word read twice counts twice). */
  wordsRead: z.number().int().nonnegative().default(0),
});

export const PINYIN_MODES = ["off", "unknown", "all"] as const;
export type PinyinMode = (typeof PINYIN_MODES)[number];

export const settingsSchema = z.object({
  ...base,
  /** Pinyin over the characters: never, over words you don't know yet, or over every word. */
  pinyin: z.enum(PINYIN_MODES).default("unknown"),
  /** Words at or below this band count as known until you say otherwise; 0 assumes none. */
  assumedBand: z.number().int().min(0).max(9).default(3),
  /** Minutes a day. */
  dailyGoal: z.number().int().min(1).max(120).default(10),
  /** How many new words a generated text brings (step 7c). */
  newWordsPerText: z.number().int().min(0).max(15).default(6),
  topics: z.array(z.enum(TOPICS)).default([...TOPICS]),
  /** Audio playback rate: 1 is as recorded. */
  audioSpeed: z.number().min(0.5).max(1.5).default(1),
  /** The English under each sentence, shown or hidden until tapped. */
  showTranslation: z.boolean().default(false),
});

export const SCHEMAS = {
  text: textSchema,
  word: wordSchema,
  review: reviewSchema,
  reading: readingSchema,
  day: daySchema,
  settings: settingsSchema,
};

export type Token = z.infer<typeof tokenSchema>;
export type Sentence = z.infer<typeof sentenceSchema>;
export type GlossEntry = z.infer<typeof glossEntrySchema>;
export type Note = z.infer<typeof noteSchema>;
export type Question = z.infer<typeof questionSchema>;
export type Audio = z.infer<typeof audioSchema>;
export type Text = z.infer<typeof textSchema>;
export type Card = z.infer<typeof cardSchema>;
export type Word = z.infer<typeof wordSchema>;
export type Review = z.infer<typeof reviewSchema>;
export type Reading = z.infer<typeof readingSchema>;
export type Day = z.infer<typeof daySchema>;
export type Settings = z.infer<typeof settingsSchema>;

export const DEFAULT_SETTINGS: Settings = settingsSchema.parse({ id: "settings", updatedAt: 0 });

export { newId } from "@atlas/sync/records";

/** A day's activity record on one device. */
export const dayId = (date: string, device: string) => `${date}/${device}`;
