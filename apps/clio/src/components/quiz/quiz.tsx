"use client";

import { Check, X } from "lucide-react";
import { Dialog } from "radix-ui";
import { useEffect, useRef, useState, type CSSProperties } from "react";

import { Button } from "@atlas/ui/components/button";
import { Meter } from "@atlas/ui/components/meter";

import { useHsk } from "@/lib/local/data";
import { useReading, useSettings, useWordBook } from "@/lib/local/hooks";
import type { Text } from "@/lib/model";
import { describe, judge, makeQuiz, resultLines, score, seeded, type Exercise, type Outcome, type Response } from "@/lib/quiz";
import { useSpeech } from "../reader/use-speech";
import { ComprehensionView, GapView, ListenView, MatchView, MeaningView, ReorderView } from "./exercises";
import { saveMissedWords, saveQuizScore } from "./save";

// The quiz after a text, in a full-height sheet: one exercise at a time, an
// answer shown at once, then Continue. Time in it counts as reading time,
// because the reader's clock is still running behind it (any tap or key is a
// sign of life), so this adds nothing to the day itself.

/** The summary's place for the quiz: what you scored last, and a button to take it. */
export function QuizSlot({ text }: { text: Text }) {
  const reading = useReading(text.id);
  const [open, setOpen] = useState(false);
  const quiz = reading?.quiz;
  return (
    <div data-slot="quiz" className="flex flex-col items-start gap-2 border-t border-line pt-5">
      <h3 className="text-[15px] font-semibold">Quiz</h3>
      <p className="text-sm text-muted">
        {quiz ? `Your last score: ${quiz.right} of ${quiz.of}. ` : ""}A few questions and exercises on this text, with a few words from it.
      </p>
      <Button size="lg" variant={quiz ? "secondary" : "primary"} className="min-h-11" onClick={() => setOpen(true)}>
        {quiz ? "Take the quiz again" : "Take the quiz"}
      </Button>
      <Dialog.Root open={open} onOpenChange={setOpen}>
        <Dialog.Portal>
          <Dialog.Content
            aria-describedby={undefined}
            className="fixed inset-0 z-50 flex flex-col bg-surface text-ink focus:outline-none"
            // The sheet is outside the shell, which is what gives the progress bar its colour.
            style={{ "--color-chart": "var(--color-chart-clio)" } as CSSProperties}
            // Back to the button that opened it.
            onCloseAutoFocus={(event) => {
              event.preventDefault();
              document.querySelector<HTMLElement>("[data-slot=quiz] button")?.focus({ preventScroll: true });
            }}
          >
            <Dialog.Title className="sr-only">Quiz on {text.title.en}</Dialog.Title>
            <QuizRun text={text} onClose={() => setOpen(false)} />
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}

/** Waits for the word list, then runs a quiz; "Try again" starts a new one. */
function QuizRun({ text, onClose }: { text: Text; onClose: () => void }) {
  const book = useWordBook();
  const hsk = useHsk();
  const settings = useSettings();
  const speech = useSpeech(settings.audioSpeed);
  // A new seed for each round, so "Try again" asks different things.
  const [seed, setSeed] = useState(() => Math.floor(Math.random() * 2 ** 32));
  if (!book) return null;
  return (
    <Quiz
      key={seed}
      text={text}
      make={() => makeQuiz({ text, book, bandOf: (word) => hsk?.bandOf(word), assumedBand: settings.assumedBand, rng: seeded(seed), listening: speech.available })}
      speech={speech}
      onClose={onClose}
      onAgain={() => setSeed(Math.floor(Math.random() * 2 ** 32))}
    />
  );
}

function ExerciseView({ exercise, onAnswer, speech }: { exercise: Exercise; onAnswer: (response: Response) => void; speech: ReturnType<typeof useSpeech> }) {
  switch (exercise.type) {
    case "comprehension":
      return <ComprehensionView exercise={exercise} onAnswer={onAnswer} />;
    case "meaning":
      return <MeaningView exercise={exercise} onAnswer={onAnswer} />;
    case "gap":
      return <GapView exercise={exercise} onAnswer={onAnswer} />;
    case "reorder":
      return <ReorderView exercise={exercise} onAnswer={onAnswer} />;
    case "match":
      return <MatchView exercise={exercise} onAnswer={onAnswer} />;
    case "listen":
      return <ListenView exercise={exercise} onAnswer={onAnswer} speech={speech} />;
  }
}

function Quiz({
  text,
  make,
  speech,
  onClose,
  onAgain,
}: {
  text: Text;
  make: () => Exercise[];
  speech: ReturnType<typeof useSpeech>;
  onClose: () => void;
  onAgain: () => void;
}) {
  // Made once for the round: a word saved on the way (so no longer "new") must not change the quiz under you.
  const [exercises] = useState(make);
  const [index, setIndex] = useState(0);
  const [outcomes, setOutcomes] = useState<Map<string, Outcome>>(new Map());
  const [saved, setSaved] = useState<string[]>([]);
  const [allSaved, setAllSaved] = useState<string[]>([]);
  const heading = useRef<HTMLDivElement>(null);
  const feedback = useRef<HTMLDivElement>(null);
  const next = useRef<HTMLButtonElement>(null);

  const exercise = exercises[index];
  const answered = exercise ? outcomes.get(exercise.id) : undefined;
  const finished = index >= exercises.length;

  // A new exercise takes focus; an answer sends it to Continue, so Enter goes on.
  useEffect(() => heading.current?.focus({ preventScroll: true }), [index]);
  useEffect(() => {
    if (!answered) return;
    next.current?.focus({ preventScroll: true });
    feedback.current?.scrollIntoView({ block: "nearest" });
  }, [answered]);

  const answer = (response: Response) => {
    if (!exercise || answered) return;
    const outcome = judge(exercise, response);
    setOutcomes((now) => new Map(now).set(exercise.id, outcome));
    setSaved([]);
    if (outcome.missed.length > 0) {
      void saveMissedWords(text, outcome.missed, exercise.sentence).then((words) => {
        setSaved(words);
        setAllSaved((now) => [...new Set([...now, ...words])]);
      });
    }
    // Skipping goes straight on: there's nothing to look at.
    if (outcome.result === "skipped") setIndex((n) => n + 1);
  };

  const go = () => {
    speech.stop();
    setSaved([]);
    setIndex((n) => n + 1);
  };

  if (finished) {
    return <Result text={text} exercises={exercises} outcomes={outcomes} saved={allSaved} onClose={onClose} onAgain={onAgain} />;
  }

  return (
    <>
      <div className="mx-auto flex w-full max-w-[560px] items-center gap-3 px-4 pt-[calc(12px+env(safe-area-inset-top))] pb-3">
        <Dialog.Close aria-label="Leave the quiz" className="-ml-2 grid size-11 shrink-0 place-items-center rounded-control text-muted hover:bg-hover hover:text-ink">
          <X size={20} aria-hidden="true" />
        </Dialog.Close>
        <div className="flex-1">
          <Meter value={index + (answered ? 1 : 0)} max={exercises.length} size="md" tone="chart" label={`Exercise ${index + 1} of ${exercises.length}`} />
        </div>
        <span className="w-10 shrink-0 text-right text-meta text-muted tabular-nums">
          {index + 1}/{exercises.length}
        </span>
        <Button variant="text" size="lg" className="min-h-11 shrink-0" aria-disabled={Boolean(answered)} onClick={() => !answered && answer({ skipped: true })}>
          Skip
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-[560px] flex-col gap-6 px-4 pt-4 pb-8">
          <div ref={heading} tabIndex={-1} className="sr-only focus:outline-none">
            Exercise {index + 1} of {exercises.length}
          </div>
          <ExerciseView key={exercise!.id} exercise={exercise!} onAnswer={answer} speech={speech} />
          {answered && answered.result !== "skipped" && (
            <div ref={feedback}>
              <Feedback text={text} exercise={exercise!} outcome={answered} saved={saved} />
            </div>
          )}
        </div>
      </div>

      {answered && answered.result !== "skipped" && (
        <div className="border-t border-line bg-card px-4 pt-3 pb-[calc(12px+env(safe-area-inset-bottom))]">
          <div className="mx-auto max-w-[560px]">
            <Button ref={next} size="lg" className="min-h-12 w-full text-base" onClick={go}>
              {index + 1 >= exercises.length ? "See the result" : "Continue"}
            </Button>
          </div>
        </div>
      )}
    </>
  );
}

/** Right or not, the answer, and for a word you missed the sentence it came from. */
function Feedback({ text, exercise, outcome, saved }: { text: Text; exercise: Exercise; outcome: Outcome; saved: string[] }) {
  const right = outcome.result === "right";
  const sentence = exercise.sentence ? text.sentences.find((s) => s.id === exercise.sentence) : undefined;
  const shown = describe(exercise);
  const lang = shown.lang === "zh" || exercise.type === "reorder" || exercise.type === "gap" ? "zh" : "en";
  return (
    <div role="status" className={`flex flex-col gap-2 rounded-panel border px-4 py-3 ${right ? "border-success/40 bg-success/10" : "border-danger-line bg-danger-surface"}`}>
      <p className="flex items-center gap-2 font-semibold">
        {right ? <Check size={18} aria-hidden="true" className="quiz-tick text-success" /> : <X size={18} aria-hidden="true" className="quiz-tick text-error" />}
        {right ? "Right." : exercise.type === "match" ? "Matched, after some wrong tries." : "Not quite."}
      </p>
      {!right && (
        <p className="text-sm">
          {exercise.type === "reorder" || exercise.type === "gap" ? "It reads " : exercise.type === "match" ? "The pairs are " : "The answer is "}
          <span lang={lang === "zh" ? "zh-Hans" : "en"} className={lang === "zh" ? "font-zh text-[17px]" : "font-medium"}>
            {shown.answer}
          </span>
          {lang === "zh" || /[.?!]$/.test(shown.answer) ? "" : "."}
        </p>
      )}
      {!right && sentence && exercise.type !== "reorder" && exercise.type !== "gap" && (
        <div className="flex flex-col gap-0.5 border-l-2 border-word-new pl-3">
          <span lang="zh-Hans" className="font-zh text-[17px]">
            {sentence.tokens.map((token) => token.t).join("")}
          </span>
          <span className="text-meta text-muted">{sentence.en}</span>
        </div>
      )}
      {!right && exercise.type === "listen" && <p className="text-meta text-muted">You heard: {exercise.zh}</p>}
      {saved.length > 0 && (
        <p className="text-meta text-muted">
          Saved for review:{" "}
          <span lang="zh-Hans" className="font-zh">
            {saved.join("、")}
          </span>
          .
        </p>
      )}
    </div>
  );
}

function Result({
  text,
  exercises,
  outcomes,
  saved,
  onClose,
  onAgain,
}: {
  text: Text;
  exercises: Exercise[];
  outcomes: ReadonlyMap<string, Outcome>;
  saved: string[];
  onClose: () => void;
  onAgain: () => void;
}) {
  const result = score(exercises, outcomes);
  const { headline, again } = resultLines(result);
  const title = useRef<HTMLHeadingElement>(null);
  const wrote = useRef(false);
  useEffect(() => title.current?.focus({ preventScroll: true }), []);
  useEffect(() => {
    // Written once, when the result shows: the quiz can end by Continue or by skipping the last exercise.
    if (wrote.current) return;
    wrote.current = true;
    void saveQuizScore(text.id, result.right, result.of);
  }, [text.id, result.right, result.of]);
  return (
    <>
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-[560px] flex-col gap-6 px-4 pt-[calc(48px+env(safe-area-inset-top))] pb-8">
          <div className="flex flex-col gap-1">
            <p className="text-sm text-muted">Quiz done</p>
            <h2 ref={title} tabIndex={-1} className="font-serif text-[44px] leading-none focus:outline-none">
              {headline}
            </h2>
            {result.missed.length === 0 && <p className="text-sm text-muted">Every one right.</p>}
          </div>
          {again && (
            <section aria-label="To look at again" className="flex flex-col gap-3">
              <h3 className="text-[15px] font-semibold">{again}</h3>
              <ul className="flex flex-col divide-y divide-line rounded-panel border border-line-card bg-card">
                {result.missed.map((exercise) => {
                  const shown = describe(exercise);
                  const zhPrompt = exercise.type === "meaning" || exercise.type === "listen" || (exercise.type === "comprehension" && exercise.lang === "zh");
                  return (
                    <li key={exercise.id} className="flex flex-col gap-0.5 px-4 py-3">
                      <span lang={zhPrompt ? "zh-Hans" : undefined} className={zhPrompt ? "font-zh text-[17px]" : "text-sm text-muted"}>
                        {shown.prompt}
                      </span>
                      <span lang={shown.lang === "zh" ? "zh-Hans" : undefined} className={shown.lang === "zh" ? "font-zh text-[17px]" : "text-sm font-medium"}>
                        {shown.answer}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}
          {saved.length > 0 && (
            <p className="text-sm text-muted">
              Saved for review:{" "}
              <span lang="zh-Hans" className="font-zh">
                {saved.join("、")}
              </span>
              .
            </p>
          )}
        </div>
      </div>
      <div className="border-t border-line bg-card px-4 pt-3 pb-[calc(12px+env(safe-area-inset-bottom))]">
        <div className="mx-auto flex max-w-[560px] gap-2">
          <Button size="lg" variant="secondary" className="min-h-12 flex-1 text-base" onClick={onAgain}>
            Try again
          </Button>
          <Button size="lg" className="min-h-12 flex-1 text-base" onClick={onClose}>
            Done
          </Button>
        </div>
      </div>
    </>
  );
}
