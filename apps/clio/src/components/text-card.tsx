"use client";

import { Check } from "lucide-react";
import Link from "next/link";
import { useCallback, useMemo } from "react";

import { Meter } from "@atlas/ui/components/meter";

import { useHsk } from "@/lib/local/data";
import { useSettings } from "@/lib/local/hooks";
import { useFormat } from "@/lib/locale";
import type { Reading, Text, Word } from "@/lib/model";
import { characterCount, readingState } from "@/lib/reading";
import { coverage, statusOf, withGlossary, type Coverage } from "@/lib/words";

// A text as a card, in the library and on Today: what it is, how long, how
// much of it you know, and where you are in it.

export const KIND_NAMES = { story: "Story", dialogue: "Dialogue", news: "News", culture: "Culture" } as const;

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

/** Coverage plus `fresh`: the unknown words you haven't met yet (the rest are in review). */
export type TextCoverage = Coverage & { fresh: number };

/** Each text's coverage, by ID, worked out again only when the texts, your words or the level change. */
export function useCoverages(texts: readonly Text[] | undefined, book: ReadonlyMap<string, Word> | undefined): Map<string, TextCoverage> {
  const settings = useSettings();
  const hsk = useHsk();
  const bandOf = useCallback((word: string) => hsk?.bandOf(word), [hsk]);
  return useMemo(() => {
    if (!texts || !book) return new Map<string, TextCoverage>();
    return new Map(
      texts.map((text) => {
        const cover = coverage(text, book, bandOf, settings.assumedBand);
        const band = withGlossary(text, bandOf);
        const fresh = cover.unknown.filter((word) => statusOf(word, book, band, settings.assumedBand) === "new").length;
        return [text.id, { ...cover, fresh }];
      }),
    );
  }, [texts, book, bandOf, settings.assumedBand]);
}

/** "94% known · 6 new words": what's left to learn in a text, plainly. */
export function coverageLine(cover: TextCoverage | undefined): string {
  if (!cover) return "";
  const learning = cover.unknown.length - cover.fresh;
  return [
    `${Math.floor(cover.share * 100)}% known`,
    cover.fresh > 0 ? plural(cover.fresh, "new word", "new words") : "no new words",
    ...(learning > 0 ? [`${learning} learning`] : []),
  ].join(" · ");
}

export function TextCard({ text, reading, cover }: { text: Text; reading: Reading | undefined; cover: TextCoverage | undefined }) {
  const f = useFormat();
  const state = readingState(reading);
  const n = text.sentences.length;
  const at = Math.min(n, (reading?.furthest ?? 0) + 1);
  return (
    <Link
      href={`/read?t=${encodeURIComponent(text.id)}`}
      className="flex flex-col gap-1 rounded-panel border border-line-card bg-card px-4 py-4 text-ink hover:border-line-strong hover:text-ink lg:px-6"
    >
      <span className="flex items-center justify-between gap-3 text-meta text-muted">
        <span>
          {KIND_NAMES[text.kind]} · HSK {text.band} · {f.number(characterCount(text))} characters
        </span>
        {state === "finished" && (
          <span className="inline-flex items-center gap-1 font-medium text-success">
            <Check size={14} aria-hidden="true" /> Finished
          </span>
        )}
      </span>
      <span lang="zh-Hans" className="font-zh-serif text-[22px] leading-snug font-semibold">
        {text.title.zh}
      </span>
      <span className="text-sm">{text.title.en}</span>
      <span className="mt-1 text-meta text-muted">{coverageLine(cover)}</span>
      {state === "started" && (
        <span className="mt-2 flex items-center gap-3">
          <span className="flex-1">
            <Meter value={at} max={n} label={`Sentence ${at} of ${n}`} tone="success" />
          </span>
          <span className="text-meta text-muted">
            Sentence {at} of {n}
          </span>
        </span>
      )}
    </Link>
  );
}
