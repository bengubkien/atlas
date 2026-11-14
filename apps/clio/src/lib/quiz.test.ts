import { describe, expect, it } from "vitest";

import { describe as describeExercise, judge, makeQuiz, resultLines, score, seeded, shortDef, type Exercise, type Outcome } from "./quiz";
import type { Word } from "./model";
import { SAMPLE_TEXTS } from "./samples";
import { wordBook } from "./words";

const make = (text = SAMPLE_TEXTS[0]!, seed = 1, words: Word[] = [], listening = true) =>
  makeQuiz({ text, book: wordBook(words), bandOf: (word) => text.glossary[word]?.band, assumedBand: 3, rng: seeded(seed), listening });

const learning = (id: string): Word => ({ id, updatedAt: 1, deleted: false, status: "learning", saved: true, source: "tapped", context: null, card: null });

const optionsOf = (exercise: Exercise): string[] => {
  switch (exercise.type) {
    case "comprehension":
    case "meaning":
    case "listen":
      return exercise.options;
    case "gap":
      return exercise.options.map((option) => option.text);
    default:
      return [];
  }
};

describe("making a quiz", () => {
  it("gives the same quiz for the same seed, and another for another", () => {
    expect(make(SAMPLE_TEXTS[0], 7)).toEqual(make(SAMPLE_TEXTS[0], 7));
    expect(make(SAMPLE_TEXTS[0], 7)).not.toEqual(make(SAMPLE_TEXTS[0], 8));
  });

  it("makes at least five exercises from every sample text, with or without a voice", () => {
    for (const text of SAMPLE_TEXTS) {
      for (const listening of [true, false]) {
        for (const seed of [1, 2, 3]) {
          const quiz = make(text, seed, [], listening);
          expect(quiz.length, `${text.id} ${seed}`).toBeGreaterThanOrEqual(5);
          expect(quiz.length).toBeLessThanOrEqual(12);
          expect(new Set(quiz.map((exercise) => exercise.id)).size).toBe(quiz.length);
        }
      }
    }
  });

  it("asks every comprehension question, with the answer still among shuffled options", () => {
    for (const text of SAMPLE_TEXTS) {
      const asked = make(text).filter((exercise) => exercise.type === "comprehension");
      expect(asked).toHaveLength(text.questions.length);
      asked.forEach((exercise, i) => {
        const question = text.questions[i]!;
        expect([...exercise.options].sort()).toEqual([...question.options].sort());
        expect(exercise.options[exercise.answer]).toBe(question.options[question.answer]);
      });
    }
  });

  it("never makes an exercise that can't be answered or has two right answers", () => {
    for (const text of SAMPLE_TEXTS) {
      for (const seed of [1, 2, 3, 4, 5]) {
        for (const exercise of make(text, seed)) {
          const options = optionsOf(exercise);
          if (exercise.type !== "match" && exercise.type !== "reorder") {
            expect(options.length).toBeGreaterThanOrEqual(3);
            expect(new Set(options).size, `${text.id} ${exercise.id}`).toBe(options.length);
            expect("answer" in exercise && exercise.answer).toBeGreaterThanOrEqual(0);
            expect("answer" in exercise && exercise.answer).toBeLessThan(options.length);
          }
          if (exercise.type === "meaning") {
            // Another option holding a word of the answer's meaning would be a second right answer.
            expect(exercise.sentence).not.toBeNull();
            expect(text.glossary[exercise.word]?.defs[0]).toBeTruthy();
            expect(exercise.options[exercise.answer]).toBe(shortDef(text.glossary[exercise.word]!.defs));
          }
          if (exercise.type === "gap") {
            const sentence = text.sentences.find((s) => s.id === exercise.sentence)!;
            expect(exercise.before + exercise.word + exercise.after).toBe(sentence.tokens.map((t) => t.t).join(""));
            expect(exercise.options[exercise.answer]!.text).toBe(exercise.word);
            // No option is already in the sentence.
            for (const option of exercise.options.filter((_, i) => i !== exercise.answer)) expect(sentence.tokens.some((t) => t.t === option.text)).toBe(false);
          }
          if (exercise.type === "match") {
            expect(exercise.words.length).toBeGreaterThanOrEqual(3);
            expect(exercise.words.length).toBeLessThanOrEqual(5);
            expect(new Set(exercise.meanings.map((m) => m.text)).size).toBe(exercise.meanings.length);
            expect(exercise.meanings.map((m) => m.word).sort()).toEqual(exercise.words.map((w) => w.word).sort());
          }
          if (exercise.type === "listen") {
            const sentence = text.sentences.find((s) => s.id === exercise.sentence)!;
            expect(exercise.options[exercise.answer]).toBe(sentence.en);
            expect(exercise.zh).toBe(sentence.tokens.map((t) => t.t).join(""));
          }
        }
      }
    }
  });

  it("leaves out the listening exercise without a voice", () => {
    for (const text of SAMPLE_TEXTS) {
      expect(make(text, 1, [], false).some((exercise) => exercise.type === "listen")).toBe(false);
      expect(make(text, 1, [], true).some((exercise) => exercise.type === "listen")).toBe(true);
    }
  });

  it("reorders short sentences: the tiles join to the sentence, shuffled, never in order", () => {
    let made = 0;
    for (const text of SAMPLE_TEXTS) {
      for (const seed of [1, 2, 3]) {
        const reorder = make(text, seed).find((exercise) => exercise.type === "reorder");
        if (!reorder) continue;
        made++;
        const sentence = text.sentences.find((s) => s.id === reorder.sentence)!;
        expect(reorder.order.join("")).toBe(sentence.tokens.filter((t) => t.w).map((t) => t.t).join(""));
        expect([...reorder.tiles].sort()).toEqual([...reorder.order].sort());
        expect(reorder.tiles.join("")).not.toBe(reorder.order.join(""));
        expect(new Set(reorder.order).size).toBe(reorder.order.length);
        expect(reorder.en).toBe(sentence.en);
      }
    }
    expect(made).toBeGreaterThan(20);
  });

  it("prefers the words you tapped", () => {
    const text = SAMPLE_TEXTS[0]!;
    const tapped = ["湿", "同意", "只好", "原来"];
    for (const seed of [1, 2, 3]) {
      const quiz = make(text, seed, tapped.map(learning));
      const match = quiz.find((exercise) => exercise.type === "match")!;
      if (match.type !== "match") throw new Error();
      const asked = match.words.map((w) => w.word);
      expect(tapped.filter((word) => asked.includes(word)).length).toBeGreaterThanOrEqual(3);
    }
  });

  it("never asks about names or words you set aside", () => {
    const text = SAMPLE_TEXTS[0]!;
    const ignored: Word = { ...learning("湿"), status: "ignored" };
    for (const seed of [1, 2, 3, 4]) {
      const quiz = make(text, seed, [ignored]);
      const asked = JSON.stringify(quiz.filter((exercise) => exercise.type === "match" || exercise.type === "meaning"));
      expect(asked).not.toContain("湿");
      expect(asked).not.toContain("李文");
    }
  });
});

describe("marking", () => {
  const quiz = make(SAMPLE_TEXTS[3]!, 2);
  const of = <T extends Exercise["type"]>(type: T) => quiz.find((exercise) => exercise.type === type) as Extract<Exercise, { type: T }>;

  it("marks a choice, and names the word missed, but not for a skip", () => {
    const meaning = of("meaning");
    expect(judge(meaning, { choice: meaning.answer })).toEqual({ id: meaning.id, result: "right", missed: [] });
    const wrong = judge(meaning, { choice: (meaning.answer + 1) % meaning.options.length });
    expect(wrong).toEqual({ id: meaning.id, result: "wrong", missed: [meaning.word] });
    expect(judge(meaning, { skipped: true })).toEqual({ id: meaning.id, result: "skipped", missed: [] });
  });

  it("marks a reorder by the order of the tiles", () => {
    const reorder = of("reorder");
    expect(judge(reorder, { order: reorder.order }).result).toBe("right");
    expect(judge(reorder, { order: reorder.tiles }).result).toBe("wrong");
  });

  it("marks a match right only with no wrong pairing, naming the words tried wrongly", () => {
    const match = of("match");
    expect(judge(match, { wrong: [] }).result).toBe("right");
    const word = match.words[0]!.word;
    expect(judge(match, { wrong: [word, word] })).toEqual({ id: match.id, result: "wrong", missed: [word] });
  });

  it("scores, counting skips as missed, and says it plainly", () => {
    const outcomes = new Map<string, Outcome>(quiz.map((exercise, i) => [exercise.id, { id: exercise.id, result: i < 2 ? "wrong" : "right", missed: [] }]));
    const result = score(quiz, outcomes);
    expect(result).toMatchObject({ right: quiz.length - 2, of: quiz.length });
    expect(result.missed.map((exercise) => exercise.id)).toEqual(quiz.slice(0, 2).map((exercise) => exercise.id));
    expect(resultLines(result)).toEqual({ headline: `${quiz.length - 2} of ${quiz.length}.`, again: "Two to look at again:" });
    expect(resultLines({ right: 8, of: 8, missed: [] }).again).toBeNull();
    // Nothing answered is nothing right.
    expect(score(quiz, new Map()).right).toBe(0);
  });

  it("describes every exercise for the list of misses", () => {
    for (const exercise of quiz) {
      const { prompt, answer } = describeExercise(exercise);
      expect(prompt.length).toBeGreaterThan(0);
      expect(answer.length).toBeGreaterThan(0);
    }
  });
});
