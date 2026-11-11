"use client";

import { Undo2 } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Button, buttonClassName } from "@atlas/ui/components/button";
import { Meter } from "@atlas/ui/components/meter";
import { PageBar } from "@atlas/ui/components/page-header";
import { cn } from "@atlas/ui/cn";

import { useSpeech } from "@/components/reader/use-speech";
import { saveReview, undoReview } from "@/lib/actions";
import type { Card, Text, Word } from "@/lib/model";
import {
  afterRating,
  cardKind,
  intervalWords,
  nextWord,
  preview,
  rate,
  RATING_NAMES,
  RATING_ORDER,
  sessionCounts,
  startSession,
  type CardKind,
  type Preview,
  type Rating,
  type Session as Queue,
} from "@/lib/review";
import { isNewCard } from "@/lib/words";

import { dueLabel } from "../words/lists";
import { Answer, KIND_ASKS, Prompt } from "./card-face";
import { faceFor, meaningLine, type Lookup } from "./face";

// One sitting of reviews: one card at a time, reveal, rate, next. The
// order is fixed when it starts (src/lib/review.ts, startSession); cards
// rated here are tracked in `cards`, so the next one never waits for the
// device's copy to catch up.

/** At most this much of one card counts towards the session's time: a phone left on the table isn't study. */
const CARD_CAP_MS = 60_000;

type Shown = { word: string; kind: CardKind; at: number };

type Stats = { reviewed: number; again: number; ms: number };

type Snapshot = { queue: Queue; shown: Shown | null; stats: Stats; cards: ReadonlyMap<string, Card> };

type Props = {
  words: readonly Word[];
  texts: readonly Text[];
  newLeft: number;
  startedAt: number;
  audioSpeed: number;
  lookups: { dictionary?: Lookup; list?: Lookup };
  /** Words in review whose new card waits for another day (today's allowance used). */
  waiting: number;
};

export function ReviewSession({ words, texts, newLeft, startedAt, audioSpeed, lookups, waiting }: Props) {
  const speech = useSpeech(audioSpeed);
  const book = useMemo(() => new Map(words.map((word) => [word.id, word])), [words]);

  const [queue, setQueue] = useState(() => startSession(words, startedAt, newLeft));
  const [cards, setCards] = useState<ReadonlyMap<string, Card>>(() => new Map());
  const [shown, setShown] = useState<Shown | null>(() => {
    const word = nextWord(queue, startedAt);
    return word ? { word, kind: "recognition", at: startedAt } : null;
  });
  const [previews, setPreviews] = useState<Preview[] | null>(null);
  const [stats, setStats] = useState<Stats>({ reviewed: 0, again: 0, ms: 0 });
  const [undo, setUndo] = useState<{ before: Word; reviewId: string; snapshot: Snapshot } | null>(null);
  const [busy, setBusy] = useState(false);

  const revealRef = useRef<HTMLButtonElement>(null);
  const goodRef = useRef<HTMLButtonElement>(null);

  const cardOf = useCallback((word: string) => (cards.has(word) ? cards.get(word)! : (book.get(word)?.card ?? null)), [cards, book]);
  const face = useMemo(() => (shown ? faceFor(book.get(shown.word) ?? { id: shown.word, context: null }, texts, lookups) : null), [shown, book, texts, lookups]);

  const show = (word: string | null, now: number, known: ReadonlyMap<string, Card>) => {
    setPreviews(null);
    if (!word) return setShown(null);
    const card = known.has(word) ? known.get(word)! : (book.get(word)?.card ?? null);
    const meaning = faceFor(book.get(word) ?? { id: word, context: null }, texts, lookups);
    setShown({ word, kind: cardKind(word, card, { recall: meaningLine(meaning) !== "", listening: speech.available }), at: now });
  };

  const reveal = () => {
    if (!shown || previews || busy) return;
    setPreviews(preview(cardOf(shown.word), Date.now()));
  };

  const rateAs = async (rating: Rating) => {
    if (!shown || !previews || busy) return;
    const now = Date.now();
    const word = shown.word;
    const result = rate(word, cardOf(word), rating, now);
    setBusy(true);
    try {
      const before = await saveReview(word, result.card, result.review, now);
      const nextCards = new Map(cards).set(word, result.card);
      const nextQueue = afterRating(queue, word, result.card, now);
      if (before) setUndo({ before, reviewId: result.review.id, snapshot: { queue, shown, stats, cards } });
      setStats({ reviewed: stats.reviewed + 1, again: stats.again + (rating === 1 ? 1 : 0), ms: stats.ms + Math.min(CARD_CAP_MS, now - shown.at) });
      setCards(nextCards);
      setQueue(nextQueue);
      show(nextWord(nextQueue, now, word), now, nextCards);
    } finally {
      setBusy(false);
    }
  };

  const undoLast = async () => {
    if (!undo || busy) return;
    setBusy(true);
    try {
      await undoReview(undo.before, undo.reviewId);
      const { snapshot } = undo;
      setQueue(snapshot.queue);
      setStats(snapshot.stats);
      setCards(snapshot.cards);
      setShown(snapshot.shown && { ...snapshot.shown, at: Date.now() });
      setPreviews(null);
      setUndo(null);
    } finally {
      setBusy(false);
    }
  };

  // A listening card plays as it's shown.
  const { play } = speech;
  useEffect(() => {
    if (shown?.kind === "listening") play([{ id: `review-${shown.word}`, text: shown.word }]);
  }, [shown, play]);

  // Focus follows the controls as they change, so a keyboard stays where the buttons are.
  const revealed = previews !== null;
  useEffect(() => {
    const lost = document.activeElement === document.body || document.activeElement === null;
    if (!lost) return;
    (revealed ? goodRef : revealRef).current?.focus({ preventScroll: true });
  }, [revealed, shown]);

  // The keys: space or Enter to reveal, 1 to 4 to rate, U to undo.
  const keys = useRef({ reveal, rateAs, undoLast, revealed });
  useEffect(() => {
    keys.current = { reveal, rateAs, undoLast, revealed };
  });
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable=true], [role=dialog]")) return;
      const now = keys.current;
      if ((event.key === " " || event.key === "Enter") && !now.revealed) {
        event.preventDefault();
        now.reveal();
      } else if (/^[1-4]$/.test(event.key) && now.revealed) {
        event.preventDefault();
        void now.rateAs(Number(event.key) as Rating);
      } else if (event.key === "u" || event.key === "U") {
        void now.undoLast();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const counts = sessionCounts(queue);
  const left = counts.due + counts.fresh;
  const listen = speech.available && shown ? () => speech.play([{ id: `review-${shown.word}`, text: shown.word }]) : undefined;

  const undoButton = undo && (
    <Button variant="secondary" onClick={() => void undoLast()} disabled={busy} aria-keyshortcuts="U" title="Undo the last rating (U)">
      <Undo2 size={15} aria-hidden="true" /> Undo
    </Button>
  );

  if (!shown || !face) {
    return (
      <>
        <PageBar>
          <h1 className="font-serif text-[32px] leading-[1.1] tracking-[-0.015em] lg:text-title">Review</h1>
          {undoButton}
        </PageBar>
        {stats.reviewed > 0 ? (
          <Summary stats={stats} queue={queue} waiting={waiting} next={nextDue(words, startedAt + stats.ms)} now={startedAt + stats.ms} />
        ) : (
          <NothingToReview words={words} now={startedAt} waiting={waiting} />
        )}
      </>
    );
  }

  const record = book.get(shown.word);
  const isNew = record ? isNewCard({ card: cardOf(shown.word) }) : false;

  return (
    <div className="flex flex-1 flex-col">
      <PageBar>
        <h1 className="font-serif text-[32px] leading-[1.1] tracking-[-0.015em] lg:text-title">Review</h1>
        <div className="flex items-center gap-2">{undoButton}</div>
      </PageBar>

      <div className="mx-auto flex w-full max-w-[640px] flex-1 flex-col px-4 lg:px-10">
        <div className="flex flex-col gap-2 pt-1 pb-4">
          <p className="flex items-baseline justify-between gap-3 text-meta text-muted" aria-live="polite">
            <span>
              {left} left · {counts.due} due · {counts.fresh} new
            </span>
            {isNew && <span className="font-medium text-word-new">New word</span>}
          </p>
          <Meter value={stats.reviewed} max={stats.reviewed + left} label="Done in this session" tone="success" size="sm" />
        </div>

        <section aria-label="The card" className="flex flex-1 flex-col items-center justify-center gap-8 py-6">
          <p className="text-meta font-medium tracking-wide text-muted uppercase">{revealed ? "The answer" : KIND_ASKS[shown.kind]}</p>
          {revealed ? <Answer face={face} onListen={listen} /> : <Prompt kind={shown.kind} face={face} onListen={listen} />}
        </section>

        {/* Within thumb's reach, above the tab bar. */}
        <div className="sticky bottom-[calc(64px+env(safe-area-inset-bottom))] -mx-4 border-t border-line bg-surface/95 px-4 pt-3 pb-4 backdrop-blur-md lg:bottom-0 lg:mx-0 lg:px-0">
          {previews ? (
            <div role="group" aria-label="How well did you know it?" className="grid grid-cols-4 gap-2">
              {RATING_ORDER.map((rating, index) => {
                const option = previews[index]!;
                return (
                  <Button
                    key={rating}
                    ref={rating === 3 ? goodRef : undefined}
                    variant={rating === 3 ? "primary" : "secondary"}
                    size="lg"
                    disabled={busy}
                    aria-keyshortcuts={String(rating)}
                    aria-label={`${RATING_NAMES[rating]}: back ${intervalWords(option.wait)}`}
                    onClick={() => void rateAs(rating)}
                    className="min-h-16 flex-col gap-0.5 px-1"
                  >
                    <span className={cn("text-[15px]", rating === 1 && "text-word-new")}>{RATING_NAMES[rating]}</span>
                    <span className={cn("text-label font-normal", rating === 3 ? "text-on-primary/85" : "text-muted")}>{option.label}</span>
                  </Button>
                );
              })}
            </div>
          ) : (
            <Button ref={revealRef} size="lg" className="min-h-14 w-full text-base" onClick={reveal} aria-keyshortcuts="Space">
              Show the answer
            </Button>
          )}
          <p className="mt-2 hidden text-center text-label text-faint lg:block">{previews ? "1 to 4 to rate · U to undo" : "Space to show the answer"}</p>
        </div>
      </div>
    </div>
  );
}

const minutes = (ms: number) => (ms < 60_000 ? "< 1 min" : `${Math.round(ms / 60_000)} min`);

/** When the soonest card in review comes back after `now`, or null. */
const nextDue = (words: readonly Word[], now: number) =>
  words.reduce<number | null>((soonest, word) => (word.status === "learning" && word.card && !isNewCard(word) && word.card.due > now && (soonest === null || word.card.due < soonest) ? word.card.due : soonest), null);
const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

function Summary({ stats, queue, waiting, next, now }: { stats: Stats; queue: Queue; waiting: number; next: number | null; now: number }) {
  return (
    <section aria-labelledby="review-done" className="flex max-w-[640px] flex-col gap-4 px-4 pt-2 pb-16 lg:px-10">
      <h2 id="review-done" tabIndex={-1} className="font-serif text-[26px] leading-tight">
        Done for now.
      </h2>
      <dl className="grid grid-cols-3 gap-2">
        <SummaryItem label="Reviewed" value={String(stats.reviewed)} />
        <SummaryItem label="Again" value={String(stats.again)} />
        <SummaryItem label="Time" value={minutes(stats.ms)} />
      </dl>
      {queue.later.length > 0 ? (
        <p className="text-sm text-muted">{plural(queue.later.length, "word comes", "words come")} back later today.</p>
      ) : (
        next !== null && <p className="text-sm text-muted">The next word is {dueLabel({ due: next }, now)!.toLowerCase()}.</p>
      )}
      {waiting > 0 && <p className="text-sm text-muted">{plural(waiting, "new word starts", "new words start")} tomorrow. How many start each day is in Settings.</p>}
      <div className="mt-2 flex flex-wrap gap-3">
        <Link href="/library" className={buttonClassName("primary", "lg")}>
          Read something
        </Link>
        <Link href="/words" className={buttonClassName("secondary", "lg")}>
          Your words
        </Link>
      </div>
    </section>
  );
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-card border border-line-card bg-card px-3 py-3">
      <dt className="text-meta text-muted">{label}</dt>
      <dd className="text-xl font-medium tabular-nums">{value}</dd>
    </div>
  );
}

function NothingToReview({ words, now, waiting }: { words: readonly Word[]; now: number; waiting: number }) {
  const learning = words.filter((word) => word.status === "learning");
  const next = nextDue(words, now);
  return (
    <section className="flex max-w-[640px] flex-col items-start gap-3 px-4 pt-2 pb-16 lg:px-10">
      {learning.length === 0 ? (
        <p className="text-lead text-pretty text-muted">Nothing to review. Read something and tap the words you don&apos;t know.</p>
      ) : (
        <>
          <p className="text-lead text-pretty text-muted">
            Nothing to review now.
            {next !== null && ` The next word is ${dueLabel({ due: next }, now)!.toLowerCase()}.`}
          </p>
          {waiting > 0 && <p className="text-sm text-muted">{plural(waiting, "new word starts", "new words start")} tomorrow. How many start each day is in Settings.</p>}
        </>
      )}
      <div className="mt-3 flex flex-wrap gap-3">
        <Link href="/library" className={buttonClassName("primary", "lg")}>
          Go to the library
        </Link>
        {learning.length > 0 && (
          <Link href="/words" className={buttonClassName("secondary", "lg")}>
            See all your words
          </Link>
        )}
      </div>
    </section>
  );
}
