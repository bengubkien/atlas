import { describe, expect, it } from "vitest";

import { CARD_STATES, RATINGS, cardSchema, reviewSchema, type Card, type Word } from "./model";
import {
  afterRating,
  cardKind,
  fromFsrs,
  intervalLabel,
  intervalWords,
  LEARN_AHEAD_MS,
  newCard,
  newLeftToday,
  newStartedSince,
  nextWord,
  preview,
  queueCounts,
  rate,
  sessionCounts,
  startOfDay,
  startSession,
  toFsrs,
  withCard,
} from "./review";

// Every test runs on fixed clocks: FSRS works from the times it's given.

const T0 = Date.UTC(2026, 10, 11, 9, 0);
const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

const word = (id: string, fields: Partial<Word> = {}): Word => ({
  id,
  updatedAt: 1,
  deleted: false,
  status: "learning",
  saved: false,
  source: "tapped",
  context: null,
  card: null,
  ...fields,
});

/** A card already reviewed, due at `due`. */
const reviewed = (due: number, fields: Partial<Card> = {}): Card => ({
  due,
  stability: 5,
  difficulty: 5,
  elapsedDays: 0,
  scheduledDays: 5,
  learningSteps: 0,
  reps: 3,
  lapses: 0,
  state: CARD_STATES.review,
  lastReview: due - 5 * DAY,
  ...fields,
});

describe("cards", () => {
  it("start new, due at once, and pass the model's schema", () => {
    const card = newCard(T0);
    expect(card).toMatchObject({ due: T0, state: CARD_STATES.new, reps: 0, lapses: 0, lastReview: null });
    expect(() => cardSchema.parse(card)).not.toThrow();
  });

  it("convert to ts-fsrs's card and back unchanged", () => {
    const card = reviewed(T0, { lastReview: T0 - DAY, learningSteps: 1 });
    expect(fromFsrs(toFsrs(card))).toEqual(card);
    expect(toFsrs(card).due).toEqual(new Date(T0));
    expect(fromFsrs(toFsrs(newCard(T0))).lastReview).toBeNull();
  });
});

describe("rating", () => {
  it("takes a new card through its learning steps: 1 and 10 minutes, then days", () => {
    const again = rate("伞", newCard(T0), RATINGS.again, T0, "r1");
    expect(again.card.due - T0).toBe(1 * MIN);
    expect(again.card.state).toBe(CARD_STATES.learning);

    const good = rate("伞", newCard(T0), RATINGS.good, T0, "r2");
    expect(good.card.due - T0).toBe(10 * MIN);
    const second = rate("伞", good.card, RATINGS.good, good.card.due, "r3");
    expect(second.card.state).toBe(CARD_STATES.review);
    expect(second.card.due - good.card.due).toBeGreaterThanOrEqual(1 * DAY);
  });

  it("logs the review with the card as it was before", () => {
    const before = reviewed(T0);
    const { card, review } = rate("伞", before, RATINGS.good, T0 + HOUR, "r1");
    // ts-fsrs logs `due` as the card's last review (when it has one): what its rollback reads.
    expect(review).toMatchObject({ id: "r1", word: "伞", rating: RATINGS.good, state: CARD_STATES.review, due: before.lastReview, stability: 5, review: T0 + HOUR });
    expect(() => reviewSchema.parse(review)).not.toThrow();
    expect(card.reps).toBe(4);
    expect(card.lastReview).toBe(T0 + HOUR);
  });

  it("makes a card first for a word that has none", () => {
    const { card, review } = rate("伞", null, RATINGS.good, T0, "r1");
    expect(review.state).toBe(CARD_STATES.new);
    expect(card.due).toBe(T0 + 10 * MIN);
  });

  it("counts a lapse when a card in review is forgotten, and brings it back in 10 minutes", () => {
    const { card } = rate("伞", reviewed(T0), RATINGS.again, T0, "r1");
    expect(card.lapses).toBe(1);
    expect(card.state).toBe(CARD_STATES.relearning);
    expect(card.due - T0).toBe(10 * MIN);
  });

  it("gives the same answer for the same card and time", () => {
    const a = rate("伞", reviewed(T0, { stability: 40 }), RATINGS.good, T0, "x");
    const b = rate("伞", reviewed(T0, { stability: 40 }), RATINGS.good, T0, "x");
    expect(a).toEqual(b);
  });
});

describe("previews", () => {
  it("show each button's wait, longer from Again to Easy", () => {
    const options = preview(newCard(T0), T0);
    expect(options.map((o) => o.rating)).toEqual([1, 2, 3, 4]);
    expect(options.map((o) => o.label)).toEqual(["1 min", "6 min", "10 min", expect.stringMatching(/ d$/)]);
    const waits = options.map((o) => o.wait);
    expect([...waits].sort((a, b) => a - b)).toEqual(waits);
  });

  it("agree with what rating does at the same moment", () => {
    const card = reviewed(T0, { stability: 12 });
    for (const option of preview(card, T0 + DAY)) expect(rate("伞", card, option.rating, T0 + DAY, "r").card).toEqual(option.card);
  });

  it("say waits briefly, and in words for screen readers", () => {
    expect(intervalLabel(0)).toBe("1 min");
    expect(intervalLabel(10 * MIN)).toBe("10 min");
    expect(intervalLabel(3 * HOUR)).toBe("3 h");
    expect(intervalLabel(4 * DAY)).toBe("4 d");
    expect(intervalLabel(60 * DAY)).toBe("2 mo");
    expect(intervalLabel(548 * DAY)).toBe("1.5 y");
    expect(intervalWords(MIN)).toBe("in 1 minute");
    expect(intervalWords(4 * DAY)).toBe("in 4 days");
  });
});

describe("the card rule", () => {
  it("gives a learning word a card, and leaves one it has", () => {
    expect(withCard(word("伞"), T0).card).toEqual(newCard(T0));
    const card = reviewed(T0);
    expect(withCard(word("伞", { card }), T0 + DAY).card).toBe(card);
  });

  it("gives known, ignored and new words none, and keeps theirs", () => {
    for (const status of ["known", "ignored", "new"] as const) {
      expect(withCard(word("伞", { status }), T0).card).toBeNull();
      const card = reviewed(T0);
      expect(withCard(word("伞", { status, card }), T0).card).toBe(card);
    }
  });

  it("asks only about learning words, and picks a kept card up again", () => {
    const card = reviewed(T0 - DAY);
    expect(queueCounts([word("伞", { status: "known", card })], T0, 10)).toEqual({ due: 0, fresh: 0 });
    expect(queueCounts([word("伞", { status: "learning", card })], T0, 10)).toEqual({ due: 1, fresh: 0 });
  });
});

describe("today's new cards", () => {
  const log = (word: string, state: number, at: number) => ({ word, state, review: at, deleted: false });

  it("counts the words started since midnight, each once", () => {
    const midnight = T0 - 9 * HOUR;
    const reviews = [log("a", 0, T0), log("a", 1, T0 + MIN), log("b", 0, T0), log("c", 0, midnight - 1), log("d", 2, T0)];
    expect(newStartedSince(reviews, midnight)).toBe(2);
    expect(newLeftToday(10, 2)).toBe(8);
    expect(newLeftToday(1, 2)).toBe(0);
  });

  it("start at the device's own midnight", () => {
    const start = startOfDay(T0);
    expect(new Date(start).getHours()).toBe(0);
    expect(T0 - start).toBeLessThan(DAY);
    expect(T0).toBeGreaterThanOrEqual(start);
  });
});

describe("a session", () => {
  const words = [
    word("new2", { card: newCard(T0 - 2 * HOUR) }),
    word("due1", { card: reviewed(T0 - 3 * DAY) }),
    word("new1", { card: newCard(T0 - 3 * HOUR) }),
    word("due2", { card: reviewed(T0 - DAY) }),
    word("future", { card: reviewed(T0 + 2 * DAY) }),
    word("step", { card: reviewed(T0 + 5 * MIN, { state: CARD_STATES.learning }) }),
    word("nocard", { updatedAt: T0 - HOUR }),
    word("known", { status: "known", card: reviewed(T0 - DAY) }),
  ];

  it("asks the due first, most overdue first, then new ones up to the allowance", () => {
    const session = startSession(words, T0, 2);
    expect(session.queue).toEqual(["due1", "due2", "new1", "new2"]);
    expect(session.fresh).toEqual(["new1", "new2"]);
    // A learning step coming up in a few minutes is part of it too.
    expect(session.later).toEqual([{ word: "step", due: T0 + 5 * MIN }]);
    expect(sessionCounts(session)).toEqual({ due: 3, fresh: 2 });
    expect(queueCounts(words, T0, 2)).toEqual({ due: 2, fresh: 2 });
  });

  it("counts a word in review with no card as new", () => {
    expect(startSession(words, T0, 5).fresh).toEqual(["new1", "new2", "nocard"]);
  });

  it("brings a learning step back within the session, once it's due or nothing else is left", () => {
    let session = startSession([word("a", { card: newCard(T0) }), word("b", { card: newCard(T0) })], T0, 10);
    expect(nextWord(session, T0)).toBe("a");
    const a = rate("a", null, RATINGS.good, T0, "r1");
    session = afterRating(session, "a", a.card, T0);
    expect(session.later).toEqual([{ word: "a", due: T0 + 10 * MIN }]);
    expect(sessionCounts(session)).toEqual({ due: 1, fresh: 1 });
    expect(nextWord(session, T0 + MIN)).toBe("b");
    // b is forgotten: back in a minute, before a.
    const b = rate("b", null, RATINGS.again, T0 + MIN, "r2");
    session = afterRating(session, "b", b.card, T0 + MIN);
    expect(session.later.map((item) => item.word)).toEqual(["b", "a"]);
    // Nothing left in the queue: the next step is shown early, within LEARN_AHEAD_MS.
    expect(nextWord(session, T0 + MIN + 10_000)).toBe("b");
    // Once a is due, it comes before anything early.
    expect(nextWord(session, T0 + 10 * MIN)).toBe("b");
    const easy = rate("b", b.card, RATINGS.easy, T0 + 10 * MIN, "r3");
    session = afterRating(session, "b", easy.card, T0 + 10 * MIN);
    expect(nextWord(session, T0 + 10 * MIN)).toBe("a");
    const done = rate("a", a.card, RATINGS.good, T0 + 10 * MIN, "r4");
    session = afterRating(session, "a", done.card, T0 + 10 * MIN);
    expect(done.card.due - (T0 + 10 * MIN)).toBeGreaterThan(LEARN_AHEAD_MS);
    expect(nextWord(session, T0 + 10 * MIN)).toBeNull();
    expect(sessionCounts(session)).toEqual({ due: 0, fresh: 0 });
  });

  it("leaves a step beyond the learn-ahead time for later", () => {
    const session = { queue: [], later: [{ word: "a", due: T0 + LEARN_AHEAD_MS + 1 }], fresh: [] };
    expect(nextWord(session, T0)).toBeNull();
    expect(nextWord(session, T0 + 1)).toBe("a");
  });

  it("is empty when only future cards exist", () => {
    const session = startSession([word("future", { card: reviewed(T0 + 2 * DAY) })], T0, 10);
    expect(nextWord(session, T0)).toBeNull();
  });
});

describe("how a card asks", () => {
  const all = { recall: true, listening: true };

  it("starts with recognition", () => {
    expect(cardKind("伞", null, all)).toBe("recognition");
    expect(cardKind("伞", { reps: 0 }, all)).toBe("recognition");
  });

  it("turns through the kinds a word allows, one per review", () => {
    const kinds = [1, 2, 3].map((reps) => cardKind("伞", { reps }, all));
    expect(new Set(kinds)).toEqual(new Set(["recognition", "recall", "listening"]));
    expect([1, 2, 3, 4].map((reps) => cardKind("伞", { reps }, { recall: true, listening: false })).sort()).toEqual(["recall", "recall", "recognition", "recognition"]);
  });

  it("never asks by ear without a voice, or for recall without a meaning", () => {
    for (let reps = 1; reps < 10; reps++) {
      expect(cardKind("伞", { reps }, { recall: true, listening: false })).not.toBe("listening");
      expect(cardKind("伞", { reps }, { recall: false, listening: false })).toBe("recognition");
    }
  });
});
