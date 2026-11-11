"use client";

import type { ReactNode } from "react";

import { Badge, type BadgeTone } from "@atlas/ui/components/badge";

import { shortGloss } from "@/app/words/lists";
import { bandLabel, type HskBand } from "@/lib/hsk";
import { useDictionary, useHsk } from "@/lib/local/data";
import type { WordStatus } from "@/lib/model";

export const STATUS_NAMES: Record<WordStatus, string> = { new: "New", learning: "Learning", known: "Known", ignored: "Ignored" };
const TONES: Record<WordStatus, BadgeTone> = { new: "neutral", learning: "info", known: "success", ignored: "neutral" };

/** A word's status in words. New is the usual case, so it's left out unless asked for. */
export function StatusBadge({ status, showNew = false }: { status: WordStatus; showNew?: boolean }) {
  if (status === "new" && !showNew) return null;
  return <Badge tone={TONES[status]}>{STATUS_NAMES[status]}</Badge>;
}

export type Gloss = { pinyin: string; gloss: string; band?: HskBand };

/**
 * Looks a word up for a row: the HSK list's short gloss first, then the
 * dictionary if it's loaded. It doesn't start the dictionary loading.
 */
export function useGlosser(): (word: string) => Gloss {
  const hsk = useHsk();
  const dictionary = useDictionary(false);
  return (word) => {
    const entry = hsk?.entry(word);
    if (entry?.gloss) return { pinyin: entry.pinyin, gloss: entry.gloss, band: entry.band };
    const found = dictionary?.lookup(word);
    const reading = found?.readings.find((r) => !r.proper) ?? found?.readings[0];
    return { pinyin: entry?.pinyin ?? reading?.pinyin ?? "", gloss: shortGloss(reading?.definitions ?? [], 2), band: entry?.band };
  };
}

export const bandName = (band: HskBand | undefined) => (band ? bandLabel(band) : "Off the lists");

/** A word as a row you can press: the word, its pinyin and a short gloss, with what to show on the right. */
export function WordRowButton({
  word,
  pinyin,
  gloss,
  aside,
  onClick,
  label,
}: {
  word: string;
  pinyin: string;
  gloss: string;
  aside?: ReactNode;
  onClick: () => void;
  /** What a screen reader says for the button; the visible text is read otherwise. */
  label?: string;
}) {
  return (
    <button type="button" onClick={onClick} aria-label={label} className="flex h-full min-h-14 w-full items-center gap-3 px-4 py-2 text-left hover:bg-hover focus-visible:bg-hover lg:px-6">
      <RowText word={word} pinyin={pinyin} gloss={gloss} />
      {aside && <span className="flex shrink-0 flex-col items-end gap-1">{aside}</span>}
    </button>
  );
}

/** The left side of a row: the word with its pinyin, and the gloss under it. */
export function RowText({ word, pinyin, gloss }: { word: string; pinyin: string; gloss: string }) {
  return (
    <span className="flex min-w-0 flex-1 flex-col">
      <span className="flex items-baseline gap-2">
        <span lang="zh-Hans" className="font-zh shrink-0 text-xl leading-snug">
          {word}
        </span>
        <span className="truncate text-meta text-muted">{pinyin}</span>
      </span>
      <span className="truncate text-meta text-muted">{gloss || "No short meaning yet"}</span>
    </span>
  );
}
