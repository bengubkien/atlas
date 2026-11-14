"use client";

import { ArrowLeft, Volume2, X } from "lucide-react";
import { Dialog } from "radix-ui";
import { useState, useSyncExternalStore, type ReactNode } from "react";

import { Button } from "@atlas/ui/components/button";
import { ToggleChip } from "@atlas/ui/components/chip";

import { charactersOf, dueLabel, shortGloss, wordsContaining } from "@/app/words/lists";
import { forgetWords, saveWord } from "@/lib/actions";
import { useDictionary, useDictionaryOnPhone, useHsk } from "@/lib/local/data";
import { useSettings, useWordBook } from "@/lib/local/hooks";
import type { WordStatus } from "@/lib/model";
import { statusOf } from "@/lib/words";
import { useNow } from "@atlas/ui/use-now";

import { DictionaryStatus } from "./dictionary-status";
import { bandName, STATUS_NAMES } from "./word-row";

// A Chinese voice, if the device has one. Voices arrive a moment after the
// page opens, so this listens for them.
function subscribeVoices(onChange: () => void) {
  if (typeof speechSynthesis === "undefined") return () => undefined;
  speechSynthesis.addEventListener("voiceschanged", onChange);
  return () => speechSynthesis.removeEventListener("voiceschanged", onChange);
}
const chineseVoice = () => {
  if (typeof speechSynthesis === "undefined") return undefined;
  const voices = speechSynthesis.getVoices();
  return voices.find((voice) => /^zh[-_]CN$/i.test(voice.lang)) ?? voices.find((voice) => /^zh/i.test(voice.lang));
};

/** Says a word aloud: with the device's Chinese voice when it has one, else asks for zh-CN and lets the device try. */
export function useSpeak(): { available: boolean; hasVoice: boolean; speak: (text: string) => void } {
  const voice = useSyncExternalStore(subscribeVoices, chineseVoice, () => undefined);
  const available = useSyncExternalStore(
    () => () => undefined,
    () => typeof speechSynthesis !== "undefined",
    () => false,
  );
  return {
    available,
    hasVoice: voice !== undefined,
    speak: (text) => {
      if (typeof speechSynthesis === "undefined") return;
      speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = "zh-CN";
      if (voice) utterance.voice = voice;
      utterance.rate = 0.85;
      speechSynthesis.speak(utterance);
    },
  };
}

const CHOICES: { status: Exclude<WordStatus, "new">; label: string }[] = [
  { status: "known", label: "I know this" },
  { status: "learning", label: "Learning" },
  { status: "ignored", label: "Ignore" },
];

/**
 * One word in full: every reading and its meanings, its HSK band, what you
 * know of it and how to change that, the characters it's made of and a few
 * words that contain it. A sheet from the bottom on a phone, a dialog on a
 * wide screen. Tapping a character or another word opens it here, with a
 * way back. `onClose` runs when it's dismissed.
 */
export function WordDetail({ word, onClose }: { word: string; onClose: () => void }) {
  const [trail, setTrail] = useState([word]);
  const current = trail[trail.length - 1]!;

  const hsk = useHsk();
  const where = useDictionaryOnPhone();
  // A dictionary that's on the phone loads by itself; a missing one waits to be asked for.
  const dictionary = useDictionary(where.cached === true);
  const book = useWordBook();
  const { assumedBand } = useSettings();
  const now = useNow(60_000);
  const speech = useSpeak();

  const entry = dictionary?.lookup(current);
  const listed = hsk?.entry(current);
  const record = book?.get(current);
  const status = book ? statusOf(current, book, (w) => hsk?.bandOf(w), assumedBand) : "new";
  const band = listed?.band;
  const parts = charactersOf(current);
  const more = hsk ? wordsContaining(hsk, current) : [];

  const open = (next: string) => setTrail((were) => [...were, next]);
  const pinyinOf = (w: string) => hsk?.entry(w)?.pinyin ?? dictionary?.lookup(w)?.readings.find((r) => !r.proper)?.pinyin ?? "";
  const glossOf = (w: string) => hsk?.entry(w)?.gloss ?? shortGloss(dictionary?.lookup(w)?.readings.find((r) => !r.proper)?.definitions ?? []);

  const choose = (next: Exclude<WordStatus, "new">) => {
    // Learning is also saved for review; the others leave that as it was.
    void saveWord(current, { status: next, source: "marked", ...(next === "learning" ? { saved: true } : {}) });
  };

  const readings = entry?.readings ?? (listed ? [{ pinyin: listed.pinyin, definitions: listed.gloss ? [listed.gloss] : [], proper: false }] : []);
  const due = dueLabel(record?.card ?? null, now);

  return (
    <Dialog.Root open onOpenChange={(next) => !next && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/40" />
        <Dialog.Content className="fixed inset-x-0 bottom-0 z-50 flex max-h-[92dvh] flex-col overflow-y-auto rounded-t-dialog border border-line-popover bg-card px-5 pt-5 pb-[calc(20px+env(safe-area-inset-bottom))] shadow-menu focus:outline-none sm:inset-x-auto sm:top-1/2 sm:bottom-auto sm:left-1/2 sm:w-[min(560px,calc(100vw-32px))] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-dialog sm:p-6">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div className="flex min-w-0 flex-col gap-1">
              {trail.length > 1 && (
                <button type="button" onClick={() => setTrail((were) => were.slice(0, -1))} className="-ml-1 flex w-fit items-center gap-1 rounded-control px-1 text-meta text-muted hover:text-ink">
                  <ArrowLeft size={14} aria-hidden="true" />
                  Back to <span lang="zh-Hans" className="font-zh">{trail[trail.length - 2]}</span>
                </button>
              )}
              <Dialog.Title lang="zh-Hans" className="font-zh-serif text-[56px] leading-[1.1] break-words">
                {current}
              </Dialog.Title>
              <Dialog.Description className="text-sm text-muted">
                {bandName(band)}
                {listed && ` · ${listed.pinyin}`}
              </Dialog.Description>
            </div>
            <Dialog.Close aria-label="Close" className="-mt-1 -mr-2 grid size-9 shrink-0 place-items-center rounded-control text-muted hover:bg-hover hover:text-ink">
              <X size={18} aria-hidden="true" />
            </Dialog.Close>
          </div>

          <div className="mb-5">
            <Button variant="secondary" size="sm" onClick={() => speech.speak(current)} disabled={!speech.available} aria-describedby="listen-note">
              <Volume2 size={14} aria-hidden="true" />
              Listen
            </Button>
            {speech.available && !speech.hasVoice && (
              <span id="listen-note" className="ml-3 text-meta text-muted">
                No Chinese voice found here. It may not sound right.
              </span>
            )}
            {!speech.available && (
              <span id="listen-note" className="ml-3 text-meta text-muted">
                This browser can&apos;t speak.
              </span>
            )}
          </div>

          <Section title="Meaning">
            {readings.length === 0 ? (
              <p className="text-sm text-muted">{dictionary ? "Not in the dictionary." : "Not on the HSK lists. The dictionary may have it."}</p>
            ) : (
              <ol className="flex flex-col gap-3">
                {readings.map((reading, i) => (
                  <li key={i} className="flex flex-col gap-0.5">
                    <span className="text-sm font-medium">
                      {reading.pinyin}
                      {reading.proper && <span className="ml-2 text-meta font-normal text-muted">name</span>}
                    </span>
                    {reading.definitions.length > 0 ? (
                      <span className="text-sm text-pretty">{reading.definitions.join("; ")}</span>
                    ) : (
                      <span className="text-sm text-muted">No meaning in the short list.</span>
                    )}
                  </li>
                ))}
              </ol>
            )}
            {!dictionary && (
              <div className="mt-3 rounded-control border border-line px-3 py-2.5">
                <DictionaryStatus />
              </div>
            )}
          </Section>

          <Section title="Your word">
            <p className="mb-3 text-sm" role="status">
              {STATUS_NAMES[status]}
              {!record && status === "known" && <span className="text-muted"> · counts as known: HSK {band === 7 ? "7–9" : band} is at or below your assumed band{assumedBand ? `, ${assumedBand}` : ""}</span>}
              {record && due && <span className="text-muted"> · {due}</span>}
            </p>
            <div className="flex flex-wrap gap-2" role="group" aria-label="Change what you know of this word">
              {CHOICES.map(({ status: choice, label }) => (
                <ToggleChip key={choice} selected={status === choice} onClick={() => choose(choice)} className="min-h-9 px-4">
                  {label}
                </ToggleChip>
              ))}
              {record && (
                <Button variant="text" size="sm" className="ml-1" onClick={() => void forgetWords([current])}>
                  Forget
                </Button>
              )}
            </div>
            {record && <p className="mt-2 text-label text-muted">Forget removes what Clio kept for this word, its review schedule too, and goes back to the band&apos;s default.</p>}
          </Section>

          {parts.length > 0 && (
            <Section title="Made of">
              <ul className="flex flex-wrap gap-2">
                {parts.map((char) => (
                  <li key={char}>
                    <button
                      type="button"
                      onClick={() => open(char)}
                      aria-label={`${char}${pinyinOf(char) ? `, ${pinyinOf(char)}` : ""}`}
                      className="flex min-w-16 flex-col items-center rounded-control border border-line-field bg-input px-3 py-1.5 hover:bg-hover"
                    >
                      <span lang="zh-Hans" className="font-zh text-2xl leading-tight">
                        {char}
                      </span>
                      <span className="text-label text-muted">{pinyinOf(char) || "·"}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {more.length > 0 && (
            <Section title="Other words with it">
              <ul className="-mx-2 flex flex-col">
                {more.map((other) => (
                  <li key={other.word}>
                    <button type="button" onClick={() => open(other.word)} className="flex w-full items-baseline gap-3 rounded-control px-2 py-2 text-left hover:bg-hover">
                      <span lang="zh-Hans" className="font-zh shrink-0 text-lg">
                        {other.word}
                      </span>
                      <span className="shrink-0 text-meta text-muted">{other.pinyin}</span>
                      <span className="truncate text-meta text-muted">{glossOf(other.word)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </Section>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mb-5 last:mb-0">
      <h3 className="mb-2 text-meta font-medium tracking-wide text-muted uppercase">{title}</h3>
      {children}
    </section>
  );
}
