"use client";

import { BookText, ChevronLeft, Minus, Play, Plus, Square, Type, Volume2 } from "lucide-react";
import Link from "next/link";
import { Popover } from "radix-ui";
import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent, type PointerEvent, type ReactNode } from "react";

import { Button } from "@atlas/ui/components/button";
import { SegmentedControl } from "@atlas/ui/components/segmented-control";
import { toast } from "@atlas/ui/components/toast";
import { Toggle } from "@atlas/ui/components/toggle";
import { cn } from "@atlas/ui/cn";

import { addActivity, finishReading, openReading, saveFurthest, saveSettings, setWordStatus, tapWord, unmarkKnown } from "@/lib/actions";
import { useHsk } from "@/lib/local/data";
import { useSettings } from "@/lib/local/hooks";
import { TEXT_SIZES, useTextSize } from "@/lib/local/prefs";
import { useFormat } from "@/lib/locale";
import type { PinyinMode, Reading, Sentence, Text, Word, WordStatus } from "@/lib/model";
import { characterCount, wordsToMarkKnown, wordTokenCount } from "@/lib/reading";
import { coverage, statusOf, withGlossary } from "@/lib/words";

import { KIND_NAMES } from "../text-card";

import { AfterReading, GrammarNote } from "./after-reading";
import { Lookup, LookupTitle } from "./lookup";
import { MARK, pinyinOf, SentenceView } from "./sentence-view";
import { Sheet } from "./sheet";
import { useReadingClock } from "./use-reading-clock";
import { useSpeech, type SpeechItem } from "./use-speech";

// The reader: a text as flowing sentences, each word a button that opens
// its sheet. Taps are handled once, on the text, and each sentence is
// memoised (sentence-view.tsx), so tapping a word re-draws only the
// sentences it's in.

const LONG_PRESS_MS = 500;

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;
const sentenceText = (sentence: Sentence) => sentence.tokens.map((token) => token.t).join("");

type Open = { s: number; k: number; anchor: HTMLElement | null; saved: boolean };

export function Reader({ text, reading, book }: { text: Text; reading: Reading | null; book: ReadonlyMap<string, Word> }) {
  const settings = useSettings();
  const hsk = useHsk();
  const f = useFormat();
  const [size, setSize] = useTextSize();
  const speech = useSpeech(settings.audioSpeed);
  const clock = useReadingClock();

  const bandOf = useCallback((word: string) => hsk?.bandOf(word), [hsk]);
  const band = useMemo(() => withGlossary(text, bandOf), [text, bandOf]);
  const statusFor = useCallback((word: string) => statusOf(word, book, band, settings.assumedBand), [book, band, settings.assumedBand]);

  // Each sentence's tokens as status letters: equal strings for sentences that didn't change, so they aren't re-drawn.
  const marks = useMemo(
    () => text.sentences.map((sentence) => sentence.tokens.map((token) => (token.w ? MARK[statusFor(token.w)] : "-")).join("")),
    [text, statusFor],
  );

  const [open, setOpen] = useState<Open | null>(null);
  const [sentenceSheet, setSentenceSheet] = useState<number | null>(null);
  const [notesOpen, setNotesOpen] = useState(false);
  const [shown, setShown] = useState<ReadonlySet<string>>(() => new Set());
  const [result, setResult] = useState<{ marked: number } | null>(null);
  const [finishing, setFinishing] = useState(false);
  const [current, setCurrent] = useState(0);
  // Where you were when you opened it, to go back there once.
  const [start] = useState(reading);

  const textRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const press = useRef<{ timer: ReturnType<typeof setTimeout>; x: number; y: number; fired: boolean } | null>(null);

  useEffect(() => {
    void openReading(text.id);
  }, [text.id]);

  // Back where you left off, unless you'd finished it.
  useEffect(() => {
    if (!start || start.finishedAt !== null || start.furthest === 0) return;
    const element = textRef.current?.querySelector<HTMLElement>(`[data-sentence="${start.furthest}"]`);
    if (!element) return;
    element.scrollIntoView({ block: "center" });
    toast("Back where you left off.");
  }, [start]);

  // Where you are: the last sentence that has reached the upper part of the screen (or the last, at the end).
  useEffect(() => {
    let frame = 0;
    const measure = () => {
      frame = 0;
      const sentences = textRef.current?.querySelectorAll<HTMLElement>("[data-sentence]");
      if (!sentences || sentences.length === 0) return;
      const room = document.documentElement.scrollHeight - window.innerHeight;
      const atEnd = window.scrollY >= room - 8;
      // The bar follows the scroll itself, without a render: it changes on every frame.
      if (barRef.current) barRef.current.style.width = `${room <= 0 ? 100 : Math.min(100, (window.scrollY / room) * 100)}%`;
      const line = window.innerHeight * 0.3;
      let at = 0;
      for (const [index, element] of sentences.entries()) if (element.getBoundingClientRect().top < line) at = index;
      setCurrent(atEnd ? sentences.length - 1 : at);
    };
    const onScroll = () => {
      frame ||= requestAnimationFrame(measure);
    };
    measure();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  const furthest = Math.max(reading?.furthest ?? 0, current);
  useEffect(() => {
    if (current <= (reading?.furthest ?? 0)) return;
    // Saved a moment after scrolling stops, not on every sentence passed.
    const timer = setTimeout(() => void saveFurthest(text.id, current), 1500);
    return () => clearTimeout(timer);
  }, [current, reading?.furthest, text.id]);

  // The audio playing is a sign of life for the reading clock; and the sentence being read stays in view.
  const { alive } = clock;
  useEffect(() => {
    if (!speech.speaking) return;
    const index = text.sentences.findIndex((sentence) => sentence.id === speech.speaking);
    const element = textRef.current?.querySelector<HTMLElement>(`[data-sentence="${index}"]`);
    const box = element?.getBoundingClientRect();
    if (element && box && (box.top < 120 || box.bottom > window.innerHeight - 100)) element.scrollIntoView({ block: "center", behavior: "smooth" });
    const timer = setInterval(alive, 5000);
    return () => clearInterval(timer);
  }, [speech.speaking, text.sentences, alive]);

  const items: SpeechItem[] = useMemo(() => text.sentences.map((sentence) => ({ id: sentence.id, text: sentenceText(sentence) })), [text]);

  const openWord = (s: number, k: number, anchor: HTMLElement | null) => {
    const sentence = text.sentences[s];
    const word = sentence?.tokens[k]?.w;
    if (!sentence || !word) return;
    setSentenceSheet(null);
    setOpen({ s, k, anchor, saved: false });
    void tapWord(word, statusFor(word), { textId: text.id, sentenceId: sentence.id }).then((saved) => {
      if (saved) setOpen((now) => (now && now.s === s && now.k === k ? { ...now, saved: true } : now));
    });
  };

  const toggleEnglish = (id: string) =>
    setShown((now) => {
      const next = new Set(now);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  // One handler for every word and sentence control in the text.
  const onClick = (event: MouseEvent<HTMLDivElement>) => {
    const target = (event.target as HTMLElement).closest<HTMLElement>("[data-s]");
    if (!target) return;
    if (press.current?.fired) {
      press.current = null;
      return;
    }
    const s = Number(target.dataset.s);
    if (target.dataset.action === "english") return toggleEnglish(text.sentences[s]!.id);
    if (target.dataset.k !== undefined) openWord(s, Number(target.dataset.k), target);
  };

  // A long press on a word selects its whole sentence.
  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    const target = (event.target as HTMLElement).closest<HTMLElement>("[data-k]");
    if (!target) return;
    const s = Number(target.dataset.s);
    if (press.current) clearTimeout(press.current.timer);
    press.current = {
      x: event.clientX,
      y: event.clientY,
      fired: false,
      timer: setTimeout(() => {
        if (!press.current) return;
        press.current.fired = true;
        setOpen(null);
        setSentenceSheet(s);
      }, LONG_PRESS_MS),
    };
  };
  const cancelPress = (event: PointerEvent<HTMLDivElement>) => {
    const now = press.current;
    if (!now || now.fired) return;
    if (event.type === "pointermove" && Math.hypot(event.clientX - now.x, event.clientY - now.y) < 10) return;
    clearTimeout(now.timer);
    press.current = null;
  };

  const known = useMemo(() => wordsToMarkKnown(text, book, bandOf, settings.assumedBand), [text, book, bandOf, settings.assumedBand]);
  const cover = useMemo(() => coverage(text, book, bandOf, settings.assumedBand), [text, book, bandOf, settings.assumedBand]);
  const saved = useMemo(() => {
    const words = new Set<string>();
    for (const sentence of text.sentences) for (const token of sentence.tokens) if (token.w && book.get(token.w)?.status === "learning") words.add(token.w);
    return words.size;
  }, [text, book]);

  const finish = async () => {
    if (finishing) return;
    setFinishing(true);
    speech.stop();
    try {
      const marked = known;
      await finishReading(text.id, text.sentences.length - 1, marked);
      await clock.save();
      await addActivity({ textsFinished: 1, wordsRead: wordTokenCount(text) });
      setResult({ marked: marked.length });
      if (marked.length > 0) {
        toast(`${plural(marked.length, "word", "words")} marked as known.`, {
          action: { label: "Undo", onClick: () => void unmarkKnown(marked).then(() => toast("Those words are new again.")) },
        });
      }
      // The summary takes the Finish button's place: move there, focus included.
      requestAnimationFrame(() => {
        endRef.current?.scrollIntoView({ block: "start", behavior: "smooth" });
        endRef.current?.querySelector<HTMLElement>("#after-reading")?.focus({ preventScroll: true });
      });
    } finally {
      setFinishing(false);
    }
  };

  // Sentences in blocks: a dialogue's turns, and a break wherever a sentence's English is shown under it.
  const showAll = settings.showTranslation;
  const blocks = useMemo(() => {
    const out: { start: number; end: number; speaker: string | null; english: boolean }[] = [];
    text.sentences.forEach((sentence, index) => {
      const english = showAll || shown.has(sentence.id);
      const last = out[out.length - 1];
      const turn = text.kind === "dialogue" ? sentence.speaker : null;
      if (last && !last.english && last.speaker === turn) {
        last.end = index;
        last.english = english;
      } else out.push({ start: index, end: index, speaker: turn, english });
    });
    return out;
  }, [text, shown, showAll]);

  const target = open ? text.sentences[open.s]?.tokens[open.k] : undefined;
  const targetWord = target?.w;
  const lineHeight = settings.pinyin === "off" ? 1.95 : 2.5;
  const n = text.sentences.length;

  return (
    <div className="flex flex-col pb-10">
      {/* The reader's bar: back, the title, and the controls within thumb's reach of the top. */}
      <div className="sticky top-[calc(3.5rem+env(safe-area-inset-top))] z-20 border-b border-line bg-surface/95 backdrop-blur-md lg:top-0 lg:rounded-t-panel">
        <div className="mx-auto flex h-13 max-w-[760px] items-center gap-1 px-2 lg:px-6">
          <Link href="/library" aria-label="Back to the library" className="grid size-11 shrink-0 place-items-center rounded-control text-muted hover:bg-hover hover:text-ink">
            <ChevronLeft size={22} aria-hidden="true" />
          </Link>
          <span lang="zh-Hans" className="min-w-0 flex-1 truncate font-zh text-[15px] font-medium">
            {text.title.zh}
          </span>
          {speech.available && (
            <BarButton
              label={speech.speaking ? "Stop listening" : "Listen to the whole text"}
              onClick={() => (speech.speaking ? speech.stop() : speech.play(items.slice(current)))}
            >
              {speech.speaking ? <Square size={17} aria-hidden="true" /> : <Play size={18} aria-hidden="true" />}
            </BarButton>
          )}
          {text.notes.length > 0 && (
            <BarButton label="Grammar notes" onClick={() => setNotesOpen(true)}>
              <BookText size={19} aria-hidden="true" />
            </BarButton>
          )}
          <DisplayOptions pinyin={settings.pinyin} showAll={showAll} size={size} setSize={setSize} />
        </div>
        <div
          role="progressbar"
          aria-label="Where you are in the text"
          aria-valuemin={1}
          aria-valuemax={n}
          aria-valuenow={current + 1}
          aria-valuetext={`Sentence ${current + 1} of ${n}`}
          className="h-[3px] bg-transparent"
        >
          <div ref={barRef} className="h-full w-0 bg-word-new" />
        </div>
      </div>

      <article className="mx-auto flex w-full max-w-[760px] flex-col gap-8 px-5 pt-6 lg:px-10 lg:pt-10">
        <header className="flex flex-col gap-1.5">
          <h1 lang="zh-Hans" className="font-zh-serif text-[30px] leading-tight font-semibold">
            {text.title.zh}
          </h1>
          {text.title.pinyin && <p className="text-sm text-muted">{text.title.pinyin}</p>}
          <p className="font-serif text-xl leading-snug">{text.title.en}</p>
          <p className="text-meta text-muted">
            {KIND_NAMES[text.kind]} · HSK {text.band} · {f.number(characterCount(text))} characters · {Math.floor(cover.share * 100)}% known
          </p>
          {text.source && (
            <p className="text-meta text-muted">
              Simplified from{" "}
              <a href={text.source.url} target="_blank" rel="noreferrer" className="underline underline-offset-2">
                {text.source.name}
              </a>
              .
            </p>
          )}
        </header>

        <div
          ref={textRef}
          lang="zh-Hans"
          onClick={onClick}
          onPointerDown={onPointerDown}
          onPointerUp={cancelPress}
          onPointerMove={cancelPress}
          onPointerCancel={cancelPress}
          onContextMenu={(event) => {
            if ((event.target as HTMLElement).closest("[data-k]")) event.preventDefault();
          }}
          className="flex flex-col gap-5 font-zh [-webkit-touch-callout:none] [&_rt]:font-sans [&_rt]:text-[0.5em] [&_rt]:leading-none [&_rt]:text-muted"
          style={{ fontSize: size, lineHeight }}
        >
          {blocks.map((block) => {
            const lastSentence = text.sentences[block.end]!;
            return (
              <div key={block.start} className="flex flex-col">
                {block.speaker && <p className="font-zh text-meta leading-normal font-semibold text-muted">{block.speaker}</p>}
                <p>
                  {text.sentences.slice(block.start, block.end + 1).map((sentence, offset) => {
                    const index = block.start + offset;
                    return (
                      <SentenceView
                        key={sentence.id}
                        sentence={sentence}
                        index={index}
                        marks={marks[index]!}
                        glossary={text.glossary}
                        pinyin={settings.pinyin}
                        selected={open?.s === index ? open.k : -1}
                        speaking={speech.speaking === sentence.id}
                        english={showAll || shown.has(sentence.id)}
                      />
                    );
                  })}
                </p>
                {block.english && (
                  <div lang="en" className="mt-0.5 flex items-start gap-2 font-sans text-[15px] leading-snug text-muted">
                    <p className="flex-1 text-pretty">{lastSentence.en}</p>
                    {speech.available && (
                      <BarButton label="Listen to this sentence" onClick={() => speech.play([items[block.end]!])} small>
                        <Volume2 size={16} aria-hidden="true" />
                      </BarButton>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div ref={endRef} className="scroll-mt-32 flex flex-col gap-4">
          {result ? (
            <AfterReading text={text} result={{ marked: result.marked, saved, coverage: cover.share }} />
          ) : (
            <div className="flex flex-col items-stretch gap-3 border-t border-line pt-6 sm:items-start">
              <p className="text-sm text-pretty text-muted">
                {reading?.finishedAt ? `You finished this on ${f.day(reading.finishedAt)}. ` : ""}
                {known.length > 0
                  ? `Finishing marks the ${plural(known.length, "new word", "new words")} you didn't tap as known.`
                  : "Every word here is known, in review or set aside."}
              </p>
              <Button size="lg" className="min-h-12 text-base" onClick={() => void finish()} disabled={finishing}>
                {reading?.finishedAt ? "Finish again" : "Finish"}
              </Button>
            </div>
          )}
        </div>
      </article>

      {open && target && targetWord && (
        <Sheet
          open
          onOpenChange={(next) => !next && setOpen(null)}
          label={`${targetWord}, the word`}
          anchor={open.anchor}
          title={
            <LookupTitle
              headword={targetWord}
              pinyin={pinyinOf(target, text.glossary)}
              onListen={speech.available ? () => speech.play([{ id: `word-${targetWord}`, text: targetWord }]) : undefined}
            />
          }
        >
          <Lookup
            headword={targetWord}
            asWritten={target.t}
            gloss={Object.hasOwn(text.glossary, targetWord) ? text.glossary[targetWord] : undefined}
            band={band(targetWord)}
            status={statusFor(targetWord)}
            saved={open.saved}
            onStatus={(status: WordStatus) => {
              setOpen((now) => (now ? { ...now, saved: false } : now));
              void setWordStatus(targetWord, status, { textId: text.id, sentenceId: text.sentences[open.s]!.id });
            }}
          />
          <button
            type="button"
            onClick={() => {
              setSentenceSheet(open.s);
              setOpen(null);
            }}
            className="mt-4 self-start text-meta text-muted underline underline-offset-2 hover:text-ink"
          >
            The whole sentence
          </button>
        </Sheet>
      )}

      {sentenceSheet !== null && text.sentences[sentenceSheet] && (
        <SentenceSheet
          sentence={text.sentences[sentenceSheet]}
          text={text}
          statusFor={statusFor}
          onClose={() => setSentenceSheet(null)}
          onListen={speech.available ? () => speech.play([items[sentenceSheet]!]) : undefined}
          onWord={(k) => openWord(sentenceSheet, k, null)}
        />
      )}

      <Sheet open={notesOpen} onOpenChange={setNotesOpen} label="Grammar notes" title={<h2 className="font-serif text-[22px] leading-tight">Grammar notes</h2>}>
        <div className="mt-4 flex flex-col gap-6">
          {text.notes.map((note) => (
            <GrammarNote key={note.title} note={note} />
          ))}
        </div>
      </Sheet>

      {/* For screen readers: the furthest point, as the bar shows it. */}
      <span className="sr-only" aria-live="off">
        Furthest: sentence {furthest + 1} of {n}
      </span>
    </div>
  );
}

function BarButton({ label, onClick, small, children }: { label: string; onClick: () => void; small?: boolean; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={cn("grid shrink-0 place-items-center rounded-control text-muted hover:bg-hover hover:text-ink", small ? "-my-1 size-8" : "size-11")}
    >
      {children}
    </button>
  );
}

/** Pinyin, text size and the English, from the reader's bar. Pinyin and the English are settings, shared by your devices; the size is this device's. */
function DisplayOptions({ pinyin, showAll, size, setSize }: { pinyin: PinyinMode; showAll: boolean; size: number; setSize: (size: number) => void }) {
  const at = TEXT_SIZES.indexOf(size as (typeof TEXT_SIZES)[number]);
  return (
    <Popover.Root>
      <Popover.Trigger aria-label="Display: pinyin, text size, English" title="Display" className="grid size-11 shrink-0 place-items-center rounded-control text-muted hover:bg-hover hover:text-ink data-[state=open]:bg-selected data-[state=open]:text-ink">
        <Type size={19} aria-hidden="true" />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={6}
          collisionPadding={12}
          className="z-50 flex w-[min(340px,calc(100vw-24px))] flex-col gap-5 rounded-card border border-line-popover bg-card p-4 shadow-menu focus:outline-none"
        >
          <div className="flex flex-col gap-2">
            <span id="reader-pinyin" className="text-sm font-medium">
              Pinyin
            </span>
            <SegmentedControl<PinyinMode>
              aria-labelledby="reader-pinyin"
              value={pinyin}
              onValueChange={(next) => void saveSettings({ pinyin: next })}
              className="w-full [&>*]:flex-1"
              options={[
                { value: "off", label: "Off" },
                { value: "unknown", label: "New words" },
                { value: "all", label: "All" },
              ]}
            />
          </div>
          <div className="flex items-center justify-between gap-3">
            <span id="reader-size" className="text-sm font-medium">
              Text size
            </span>
            <div role="group" aria-labelledby="reader-size" className="flex items-center gap-1">
              <Button variant="secondary" size="md" aria-label="Smaller" disabled={at <= 0} onClick={() => setSize(TEXT_SIZES[Math.max(0, at - 1)]!)} className="size-10 px-0">
                <Minus size={16} aria-hidden="true" />
              </Button>
              <span className="w-12 text-center text-sm tabular-nums" aria-live="polite">
                {size} px
              </span>
              <Button
                variant="secondary"
                size="md"
                aria-label="Larger"
                disabled={at >= TEXT_SIZES.length - 1}
                onClick={() => setSize(TEXT_SIZES[Math.min(TEXT_SIZES.length - 1, at + 1)]!)}
                className="size-10 px-0"
              >
                <Plus size={16} aria-hidden="true" />
              </Button>
            </div>
          </div>
          <Toggle label="Show all the English" description="Under each sentence. When off, tap 文A at the end of a sentence." checked={showAll} onCheckedChange={(next) => void saveSettings({ showTranslation: next })} />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

/** A whole sentence: every word's pinyin, the English, and its words to look up one by one. */
function SentenceSheet({
  sentence,
  text,
  statusFor,
  onClose,
  onListen,
  onWord,
}: {
  sentence: Sentence;
  text: Text;
  statusFor: (word: string) => WordStatus;
  onClose: () => void;
  onListen?: () => void;
  onWord: (token: number) => void;
}) {
  const seen = new Set<string>();
  const words = sentence.tokens.flatMap((token, at) => (token.w && !seen.has(token.w) && seen.add(token.w) ? [{ token, at }] : []));
  return (
    <Sheet
      open
      onOpenChange={(next) => !next && onClose()}
      label="The whole sentence"
      title={<h2 className="font-serif text-[20px] leading-tight">The whole sentence</h2>}
    >
      <div className="mt-3 flex flex-col gap-4">
        <p lang="zh-Hans" className="font-zh text-[22px] leading-[2.4] [&_rt]:font-sans [&_rt]:text-[0.5em] [&_rt]:text-muted">
          {sentence.tokens.map((token, at) => {
            const reading = token.w ? pinyinOf(token, text.glossary) : undefined;
            return reading ? (
              <ruby key={at}>
                {token.t}
                <rt>{reading}</rt>
              </ruby>
            ) : (
              <span key={at}>{token.t}</span>
            );
          })}
        </p>
        <div className="flex items-start gap-2">
          <p className="flex-1 text-[15px] leading-snug">{sentence.en}</p>
          {onListen && (
            <Button variant="secondary" onClick={onListen}>
              <Volume2 size={16} aria-hidden="true" /> Listen
            </Button>
          )}
        </div>
        <ul className="flex flex-col divide-y divide-line border-t border-line">
          {words.map(({ token, at }) => {
            const gloss = Object.hasOwn(text.glossary, token.w!) ? text.glossary[token.w!] : undefined;
            const status = statusFor(token.w!);
            return (
              <li key={at}>
                <button type="button" onClick={() => onWord(at)} className="flex w-full items-baseline gap-3 py-2.5 text-left hover:bg-hover">
                  <span lang="zh-Hans" className={cn("font-zh text-lg", status === "new" && "underline decoration-word-new decoration-2 underline-offset-4")}>
                    {token.w}
                  </span>
                  <span className="text-meta text-muted">{pinyinOf(token, text.glossary)}</span>
                  <span className="min-w-0 flex-1 truncate text-sm">{gloss?.defs[0]}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </Sheet>
  );
}
