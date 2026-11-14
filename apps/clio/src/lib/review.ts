import { createEmptyCard, fsrs, generatorParameters, type Card as FsrsCard, type Grade, type ReviewLog } from "ts-fsrs";

import { CARD_STATES, newId, RATINGS, type Card, type Review, type Word } from "./model";
import { dueWords, isNewCard } from "./words";

// Review cards: when each word comes back, and what a session asks.
//
// The schedule is FSRS, through ts-fsrs 5. Version 6 exists, but it needs
// Node 24 (Clio runs on 22) and changes the card's fields (FSRS-7 adds a
// fast stability and drops elapsed days), while the model keeps version
// 5's card. Moving to 6 means replaying each word's reviews into the new
// card: the review log keeps what that needs.
//
// The model's `Card` is ts-fsrs's, camelCase, moments in milliseconds;
// `toFsrs` and `fromFsrs` convert at the edge. Pure: the clock comes in
// as `now`, so tests run on fixed times.

/** The share of cards you should still remember when they come back. Higher means more reviews. */
export const DESIRED_RETENTION = 0.9;

/**
 * A learning step due within this long is shown now if nothing else is
 * left, as Anki does (its "learn ahead limit"), so a session ends with its
 * 10-minute steps done instead of waiting for them.
 */
export const LEARN_AHEAD_MS = 20 * 60_000;

// Learning steps are ts-fsrs's defaults: a new card comes back after 1 and
// 10 minutes, a forgotten one after 10. Fuzz spreads long intervals a
// little, so words saved together don't all come back on one day; it's
// seeded from the card and the time, so the same inputs give the same day.
const scheduler = fsrs(generatorParameters({ request_retention: DESIRED_RETENTION, enable_fuzz: true, enable_short_term: true }));

export type Rating = (typeof RATINGS)[keyof typeof RATINGS];
export const RATING_ORDER: readonly Rating[] = [RATINGS.again, RATINGS.hard, RATINGS.good, RATINGS.easy];
export const RATING_NAMES: Record<Rating, string> = { 1: "Again", 2: "Hard", 3: "Good", 4: "Easy" };

// --- Cards -------------------------------------------------------------------

export function toFsrs(card: Card): FsrsCard {
  return {
    due: new Date(card.due),
    stability: card.stability,
    difficulty: card.difficulty,
    elapsed_days: card.elapsedDays,
    scheduled_days: card.scheduledDays,
    learning_steps: card.learningSteps,
    reps: card.reps,
    lapses: card.lapses,
    state: card.state,
    ...(card.lastReview === null ? {} : { last_review: new Date(card.lastReview) }),
  };
}

export function fromFsrs(card: FsrsCard): Card {
  return {
    due: card.due.getTime(),
    stability: card.stability,
    difficulty: card.difficulty,
    elapsedDays: card.elapsed_days,
    scheduledDays: card.scheduled_days,
    learningSteps: card.learning_steps,
    reps: card.reps,
    lapses: card.lapses,
    state: card.state,
    lastReview: card.last_review ? card.last_review.getTime() : null,
  };
}

/** A card for a word just put in review: due at once, never rated. */
export const newCard = (now: number): Card => fromFsrs(createEmptyCard(new Date(now)));

/**
 * The card rule, applied to every word saved (actions.ts' `saveWord` and
 * `saveWords`): a word that is `learning` has a card, made new if it had
 * none. Known and ignored words keep theirs untouched, history and all,
 * but only `learning` words are asked about (`dueWords`), so setting a
 * word back to learning picks up where its schedule was. Forgetting a word
 * removes its record, card included.
 */
export function withCard<W extends Pick<Word, "status" | "card">>(word: W, now: number): W {
  return word.status === "learning" && word.card === null ? { ...word, card: newCard(now) } : word;
}

function logToReview(word: string, log: ReviewLog, id: string): Review {
  return {
    id,
    updatedAt: 0,
    deleted: false,
    word,
    rating: log.rating,
    state: log.state,
    due: log.due.getTime(),
    stability: log.stability,
    difficulty: log.difficulty,
    elapsedDays: log.elapsed_days,
    lastElapsedDays: log.last_elapsed_days,
    scheduledDays: log.scheduled_days,
    learningSteps: log.learning_steps,
    review: log.review.getTime(),
  };
}

/**
 * Rating a word's card at `now`: the card it becomes, and the review to
 * log (the rating and the card as it was before). A word with no card yet
 * gets one first.
 */
export function rate(word: string, card: Card | null, rating: Rating, now: number, id: string = newId()): { card: Card; review: Review } {
  const next = scheduler.next(toFsrs(card ?? newCard(now)), new Date(now), rating as Grade);
  return { card: fromFsrs(next.card), review: logToReview(word, next.log, id) };
}

export type Preview = { rating: Rating; card: Card; /** Until it comes back, in milliseconds. */ wait: number; label: string };

/** What each of the four buttons would do now, Again to Easy. */
export function preview(card: Card | null, now: number): Preview[] {
  const options = scheduler.repeat(toFsrs(card ?? newCard(now)), new Date(now));
  return RATING_ORDER.map((rating) => {
    const next = fromFsrs(options[rating as Grade].card);
    const wait = Math.max(0, next.due - now);
    return { rating, card: next, wait, label: intervalLabel(wait) };
  });
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** A wait as the buttons say it: "1 min", "10 min", "3 h", "4 d", "2 mo", "1.5 y". */
export function intervalLabel(ms: number): string {
  if (ms < HOUR) return `${Math.max(1, Math.round(ms / MINUTE))} min`;
  if (ms < DAY) return `${Math.round(ms / HOUR)} h`;
  const days = Math.round(ms / DAY);
  if (days < 31) return `${days} d`;
  if (days < 365) return `${Math.round(days / 30)} mo`;
  return `${String(Math.round((days / 365) * 10) / 10)} y`;
}

/** The same wait in words, for screen readers: "in 10 minutes", "in 4 days". */
export function intervalWords(ms: number): string {
  const unit = (count: number, one: string) => `in ${count} ${count === 1 ? one : `${one}s`}`;
  if (ms < HOUR) return unit(Math.max(1, Math.round(ms / MINUTE)), "minute");
  if (ms < DAY) return unit(Math.round(ms / HOUR), "hour");
  const days = Math.round(ms / DAY);
  if (days < 31) return unit(days, "day");
  if (days < 365) return unit(Math.round(days / 30), "month");
  return `in ${String(Math.round((days / 365) * 10) / 10)} years`;
}

// --- What a session asks -------------------------------------------------------

/** The local midnight that starts `now`'s day: today's new cards are counted from it. */
export function startOfDay(now: number): number {
  const day = new Date(now);
  day.setHours(0, 0, 0, 0);
  return day.getTime();
}

/**
 * How many words started their reviews today (on any device: reviews
 * sync): those with a review logged since `dayStart` of a card that was
 * new. Each word once, so its learning steps don't count again.
 */
export function newStartedSince(reviews: readonly Pick<Review, "word" | "state" | "review" | "deleted">[], dayStart: number): number {
  const words = new Set<string>();
  for (const review of reviews) if (!review.deleted && review.state === CARD_STATES.new && review.review >= dayStart) words.add(review.word);
  return words.size;
}

/** Today's allowance of new cards still unused. */
export const newLeftToday = (newPerDay: number, startedToday: number) => Math.max(0, newPerDay - startedToday);

type Queued = Pick<Word, "id" | "status" | "card" | "deleted" | "updatedAt">;

/** What's waiting now: words due, and new ones within today's allowance. The Review tab's badge. */
export function queueCounts(words: readonly Queued[], now: number, newLeft: number): { due: number; fresh: number } {
  let due = 0;
  let fresh = 0;
  for (const word of dueWords(words, now, newLeft)) {
    if (isNewCard(word)) fresh++;
    else due++;
  }
  return { due, fresh };
}

/**
 * One sitting of reviews. `queue` is what's left in order: words due
 * (most overdue first), then new ones. `later` holds words in learning
 * steps, back when they're due (or sooner, once the queue is empty, if
 * within LEARN_AHEAD_MS). `fresh` names the queue's new words, for the
 * header's "due / new".
 */
export type Session = {
  queue: string[];
  later: { word: string; due: number }[];
  fresh: string[];
};

/**
 * Starts a session at `now`: the words due, then up to `newLeft` new
 * ones, and any learning step coming up within LEARN_AHEAD_MS (a session
 * left a few minutes ago).
 */
export function startSession(words: readonly Queued[], now: number, newLeft: number): Session {
  const queued = dueWords(words, now, newLeft);
  const queue = queued.map((word) => word.id);
  const soon = words
    .filter((word) => !word.deleted && word.status === "learning" && !isNewCard(word) && word.card!.due > now && word.card!.due <= now + LEARN_AHEAD_MS)
    .map((word) => ({ word: word.id, due: word.card!.due }))
    .sort((a, b) => a.due - b.due);
  return { queue, later: soon, fresh: queued.filter(isNewCard).map((word) => word.id) };
}

/**
 * The word to show next at `now`, or null when the session is done. A
 * step shown early skips `last`, the word just rated, when another is
 * waiting: the same card twice in a row tests nothing.
 */
export function nextWord(session: Session, now: number, last?: string): string | null {
  const ready = session.later.find((item) => item.due <= now);
  if (ready) return ready.word;
  if (session.queue.length > 0) return session.queue[0]!;
  const early = session.later.filter((item) => item.due <= now + LEARN_AHEAD_MS);
  return (early.find((item) => item.word !== last) ?? early[0])?.word ?? null;
}

/** The session after rating `word` at `now`, its card now `card`: back in `later` if it's due again within the session. */
export function afterRating(session: Session, word: string, card: Card, now: number): Session {
  const later = session.later.filter((item) => item.word !== word);
  if (card.due <= now + LEARN_AHEAD_MS) later.push({ word, due: card.due });
  later.sort((a, b) => a.due - b.due);
  return { queue: session.queue.filter((id) => id !== word), later, fresh: session.fresh.filter((id) => id !== word) };
}

/** What's left: words due (learning steps included) and new ones. */
export function sessionCounts(session: Session): { due: number; fresh: number } {
  const fresh = session.queue.filter((word) => session.fresh.includes(word)).length;
  return { due: session.queue.length - fresh + session.later.length, fresh };
}

// --- How a card asks ---------------------------------------------------------

/**
 * The ways a card can ask for a word. recognition: the Chinese (in its
 * sentence when there is one), you recall the meaning. recall: the
 * English, you say or think the Chinese. listening: you hear it, with no
 * text. Step 7e adds typing and handwriting: add them here, with what they
 * need in `CardAbilities` and a renderer in the review screen
 * (app/review/card-face.tsx).
 */
export const CARD_KINDS = ["recognition", "recall", "listening"] as const;
export type CardKind = (typeof CARD_KINDS)[number];

/** What this word and this device allow. */
export type CardAbilities = {
  /** There's an English meaning to ask from. */
  recall: boolean;
  /** There's a Chinese voice to play it with. */
  listening: boolean;
};

/** A small, stable number from a word, so words don't all turn the same way on the same review. */
function spread(word: string): number {
  let hash = 0;
  for (const char of word) hash = (hash * 31 + char.codePointAt(0)!) >>> 0;
  return hash;
}

/**
 * How to ask for a word this time. The first time it's seen, by
 * recognition: you met it reading. After that it turns through the kinds
 * it allows, one per review, so a word is seen different ways.
 */
export function cardKind(word: string, card: Pick<Card, "reps"> | null, can: CardAbilities): CardKind {
  if (!card || card.reps === 0) return "recognition";
  const kinds = CARD_KINDS.filter((kind) => kind === "recognition" || can[kind]);
  return kinds[(card.reps + spread(word)) % kinds.length]!;
}
