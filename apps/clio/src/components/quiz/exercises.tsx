"use client";

import { Check, Volume2, X } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";

import { Button } from "@atlas/ui/components/button";
import { cn } from "@atlas/ui/cn";

import type { Comprehension, Exercise, Gap, Listen, Match, Meaning, Reorder, Response } from "@/lib/quiz";
import type { Speech } from "../reader/use-speech";

// One component for each exercise type. Each keeps its own taps, calls
// `onAnswer` once with what you did, and then shows the right answer in
// place (the quiz shell adds the feedback below). Colour is never the only
// sign: a right option has a tick, a wrong one a cross.

type Props<T extends Exercise> = { exercise: T; onAnswer: (response: Response) => void };

const zh = "font-zh text-[20px]";

type OptionState = "idle" | "right" | "wrong" | "dim";

function optionClass(state: OptionState) {
  return cn(
    "flex min-h-14 w-full items-center gap-3 rounded-control border px-4 py-3 text-left text-[16px] leading-snug motion-safe:transition-colors",
    state === "idle" && "border-line-control bg-input shadow-control hover:border-line-strong hover:bg-hover",
    state === "right" && "border-success bg-success/10",
    state === "wrong" && "border-danger-control bg-danger-surface",
    state === "dim" && "border-line-field bg-input opacity-60",
  );
}

function Mark({ state }: { state: OptionState }) {
  if (state === "right") return <Check size={18} aria-hidden="true" className="quiz-tick shrink-0 text-success" />;
  if (state === "wrong") return <X size={18} aria-hidden="true" className="quiz-tick shrink-0 text-error" />;
  return <span aria-hidden="true" className="size-[18px] shrink-0 rounded-full border border-line-strong" />;
}

/** Options to tap, one answer. After the answer the right one is marked, and a wrong pick too. */
function Choices({
  count,
  answer,
  onPick,
  children,
  grid = false,
}: {
  count: number;
  answer: number;
  onPick: (choice: number) => void;
  children: (index: number) => ReactNode;
  grid?: boolean;
}) {
  const [picked, setPicked] = useState<number | null>(null);
  const stateOf = (i: number): OptionState => (picked === null ? "idle" : i === answer ? "right" : i === picked ? "wrong" : "dim");
  return (
    <div role="group" aria-label="Choose one" className={cn("flex flex-col gap-2.5", grid && "sm:grid sm:grid-cols-2")}>
      {Array.from({ length: count }, (_, i) => (
        <button
          key={i}
          type="button"
          aria-disabled={picked !== null}
          onClick={() => {
            if (picked !== null) return;
            setPicked(i);
            onPick(i);
          }}
          className={optionClass(stateOf(i))}
        >
          <Mark state={stateOf(i)} />
          <span className="min-w-0 flex-1">{children(i)}</span>
          {picked !== null && <span className="sr-only">{i === answer ? "Right answer" : i === picked ? "Your answer, not right" : ""}</span>}
        </button>
      ))}
    </div>
  );
}

function Prompt({ children }: { children: ReactNode }) {
  return <p className="text-sm text-muted">{children}</p>;
}

export function ComprehensionView({ exercise, onAnswer }: Props<Comprehension>) {
  const lang = exercise.lang === "zh";
  return (
    <div className="flex flex-col gap-5">
      <Prompt>About the text</Prompt>
      <h2 lang={lang ? "zh-Hans" : undefined} className={cn("text-pretty", lang ? "font-zh text-[22px] leading-snug" : "font-serif text-[24px] leading-snug")}>
        {exercise.question}
      </h2>
      <Choices count={exercise.options.length} answer={exercise.answer} onPick={(choice) => onAnswer({ choice })}>
        {(i) => (
          <span lang={lang ? "zh-Hans" : undefined} className={lang ? "font-zh text-[18px]" : undefined}>
            {exercise.options[i]}
          </span>
        )}
      </Choices>
    </div>
  );
}

export function MeaningView({ exercise, onAnswer }: Props<Meaning>) {
  return (
    <div className="flex flex-col gap-5">
      <Prompt>What does this word mean?</Prompt>
      <div className="flex flex-col gap-1">
        <h2 lang="zh-Hans" className="font-zh-serif text-[44px] leading-tight font-semibold">
          {exercise.word}
        </h2>
        <p className="text-meta text-muted">{exercise.pinyin}</p>
      </div>
      <Choices count={exercise.options.length} answer={exercise.answer} onPick={(choice) => onAnswer({ choice })}>
        {(i) => exercise.options[i]}
      </Choices>
    </div>
  );
}

export function GapView({ exercise, onAnswer }: Props<Gap>) {
  const [picked, setPicked] = useState<number | null>(null);
  return (
    <div className="flex flex-col gap-5">
      <Prompt>Which word fits?</Prompt>
      <p lang="zh-Hans" className="font-zh text-[26px] leading-relaxed">
        {exercise.before}
        <span
          className={cn(
            "mx-0.5 inline-block min-w-[2.2em] border-b-2 text-center",
            picked === null ? "border-line-strong text-transparent select-none" : picked === exercise.answer ? "border-success text-success" : "border-danger-control text-error",
          )}
        >
          {picked === null ? "＿＿" : exercise.options[exercise.answer]!.text}
        </span>
        {exercise.after}
      </p>
      <p lang="en" className="text-sm text-muted">
        {exercise.en}
      </p>
      <Choices
        count={exercise.options.length}
        answer={exercise.answer}
        grid
        onPick={(choice) => {
          setPicked(choice);
          onAnswer({ choice });
        }}
      >
        {(i) => (
          <span className="flex flex-col">
            <span lang="zh-Hans" className={zh}>
              {exercise.options[i]!.text}
            </span>
            <span className="text-meta text-muted">{exercise.options[i]!.pinyin}</span>
          </span>
        )}
      </Choices>
    </div>
  );
}

export function ListenView({ exercise, onAnswer, speech }: Props<Listen> & { speech: Speech }) {
  const { play } = speech;
  const item = { id: exercise.id, text: exercise.zh };
  // Try to start it at once; a browser that wants a tap first just stays quiet, and the button is there.
  useEffect(() => {
    play([{ id: exercise.id, text: exercise.zh }]);
  }, [play, exercise.id, exercise.zh]);
  return (
    <div className="flex flex-col gap-5">
      <Prompt>Listen, then pick what it says</Prompt>
      <Button size="lg" variant="secondary" className="min-h-16 w-full text-base" onClick={() => play([item])}>
        <Volume2 size={22} aria-hidden="true" />
        {speech.speaking === exercise.id ? "Playing…" : "Play the sentence"}
      </Button>
      <Choices count={exercise.options.length} answer={exercise.answer} onPick={(choice) => onAnswer({ choice })}>
        {(i) => exercise.options[i]}
      </Choices>
    </div>
  );
}

export function ReorderView({ exercise, onAnswer }: Props<Reorder>) {
  // Tiles by their place in `exercise.tiles`, so two tiles that read the same stay apart.
  const [placed, setPlaced] = useState<number[]>([]);
  const [checked, setChecked] = useState(false);
  const order = placed.map((i) => exercise.tiles[i]!);
  const right = order.join("") === exercise.order.join("");
  const full = placed.length === exercise.tiles.length;

  const tile = (i: number, inRow: boolean) => (
    <button
      key={i}
      type="button"
      lang="zh-Hans"
      aria-disabled={checked}
      onClick={() => {
        if (checked) return;
        setPlaced((now) => (inRow ? now.filter((n) => n !== i) : [...now, i]));
      }}
      aria-label={inRow ? `${exercise.tiles[i]}, put back` : exercise.tiles[i]}
      className={cn(
        "min-h-12 rounded-control border px-4 py-2 font-zh text-[22px] leading-tight motion-safe:transition-colors",
        checked ? (right ? "border-success bg-success/10" : "border-danger-control bg-danger-surface") : "border-line-control bg-input shadow-control hover:border-line-strong hover:bg-hover",
      )}
    >
      {exercise.tiles[i]}
    </button>
  );

  return (
    <div className="flex flex-col gap-5">
      <Prompt>Put the words in order</Prompt>
      <p lang="en" className="font-serif text-[22px] leading-snug text-pretty">
        {exercise.en}
      </p>
      <div aria-label="Your sentence" className={cn("flex min-h-[72px] flex-wrap content-start gap-2 rounded-control border border-dashed p-3", checked ? (right ? "border-success" : "border-danger-control") : "border-line-strong")}>
        {placed.length === 0 && <span className="self-center text-sm text-muted">Tap the words below.</span>}
        {placed.map((i) => tile(i, true))}
      </div>
      <div aria-label="Words to place" className="flex flex-wrap gap-2">
        {exercise.tiles.map((_, i) => (placed.includes(i) ? <span key={i} className="min-h-12 min-w-14 rounded-control border border-dashed border-line-field" aria-hidden="true" /> : tile(i, false)))}
      </div>
      {!checked && (
        <Button
          size="lg"
          className="min-h-12 w-full text-base"
          aria-disabled={!full}
          onClick={() => {
            if (!full) return;
            setChecked(true);
            onAnswer({ order });
          }}
        >
          Check
        </Button>
      )}
    </div>
  );
}

export function MatchView({ exercise, onAnswer }: Props<Match>) {
  const [done, setDone] = useState<string[]>([]);
  const [word, setWord] = useState<string | null>(null);
  const [flash, setFlash] = useState<{ word: string; meaning: string } | null>(null);
  const wrong = useRef<string[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [message, setMessage] = useState("");
  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);

  const finished = done.length === exercise.words.length;
  const pickMeaning = (meaning: { word: string; text: string }) => {
    if (word === null || finished || flash) return;
    if (meaning.word === word) {
      const now = [...done, word];
      setDone(now);
      setWord(null);
      setMessage("Matched.");
      if (now.length === exercise.words.length) onAnswer({ wrong: wrong.current });
    } else {
      wrong.current.push(word);
      setFlash({ word, meaning: meaning.word });
      setMessage("Not a match.");
      timer.current = setTimeout(() => {
        setFlash(null);
        setWord(null);
      }, 700);
    }
  };

  const base = "flex min-h-14 w-full items-center gap-2 rounded-control border px-3 py-2 text-left leading-snug motion-safe:transition-colors";
  const style = (matched: boolean, selected: boolean, bad: boolean) =>
    matched
      ? "border-success bg-success/10"
      : bad
        ? "border-danger-control bg-danger-surface"
        : selected
          ? "border-line-input bg-selected"
          : "border-line-control bg-input shadow-control hover:border-line-strong hover:bg-hover";

  return (
    <div className="flex flex-col gap-5">
      <Prompt>Tap a word, then its meaning</Prompt>
      <div className="grid grid-cols-2 gap-x-3 gap-y-2.5">
        <ul className="flex flex-col gap-2.5" aria-label="Words">
          {exercise.words.map((entry) => {
            const matched = done.includes(entry.word);
            return (
              <li key={entry.word}>
                <button
                  type="button"
                  aria-pressed={word === entry.word}
                  aria-disabled={matched}
                  onClick={() => !matched && !flash && setWord(entry.word)}
                  className={cn(base, style(matched, word === entry.word, flash?.word === entry.word))}
                >
                  {matched && <Check size={16} aria-hidden="true" className="shrink-0 text-success" />}
                  <span className="flex flex-col">
                    <span lang="zh-Hans" className={zh}>
                      {entry.word}
                    </span>
                    <span className="text-meta text-muted">{entry.pinyin}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
        <ul className="flex flex-col gap-2.5" aria-label="Meanings">
          {exercise.meanings.map((meaning) => {
            const matched = done.includes(meaning.word);
            return (
              <li key={meaning.word}>
                <button
                  type="button"
                  aria-disabled={matched || word === null}
                  onClick={() => !matched && pickMeaning(meaning)}
                  className={cn(base, "text-[15px]", style(matched, false, flash?.meaning === meaning.word))}
                >
                  {meaning.text}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
      <p role="status" className="sr-only">
        {message}
      </p>
    </div>
  );
}
