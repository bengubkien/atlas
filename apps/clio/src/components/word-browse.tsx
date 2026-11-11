"use client";

import { Check } from "lucide-react";
import { useMemo, useState } from "react";

import { Button } from "@atlas/ui/components/button";
import { SegmentedControl } from "@atlas/ui/components/segmented-control";
import { toast } from "@atlas/ui/components/toast";

import { bandRows, planMark, planMarks, type BandRow, type BrowseFilter } from "@/app/words/lists";
import { forgetWords, saveWord, saveWords } from "@/lib/actions";
import { bandLabel, HSK_BANDS, type HskBand, type HskList } from "@/lib/hsk";
import type { Word, WordStatus } from "@/lib/model";
import { statusOf } from "@/lib/words";

import { RowText, StatusBadge } from "./word-row";
import { WordWindow } from "./word-window";

const ROW = 60;

const BAND_OPTIONS = HSK_BANDS.map((band) => ({ value: String(band), label: band === 7 ? "7–9" : String(band) }));
const FILTER_OPTIONS = [
  { value: "all", label: "All" },
  { value: "todo", label: "To learn" },
  { value: "known", label: "Known" },
] as const;

/**
 * Every word of one band with what you know of it. A check on each row
 * flips it between known and not; "Select" turns the rows into a list to
 * tick, for marking many at once.
 */
export function WordBrowse({
  hsk,
  book,
  assumedBand,
  onOpen,
}: {
  hsk: HskList;
  book: ReadonlyMap<string, Word>;
  assumedBand: number;
  onOpen: (word: string) => void;
}) {
  // Start on the first band that isn't assumed known: where there's something to mark.
  const [band, setBand] = useState<HskBand>(() => (Math.min(Math.max(assumedBand + 1, 1), 7) as HskBand));
  const [filter, setFilter] = useState<BrowseFilter>("all");
  const [selecting, setSelecting] = useState(false);
  const [picked, setPicked] = useState<ReadonlySet<string>>(new Set());

  const rows = useMemo(() => bandRows(hsk, band, book, assumedBand, filter), [hsk, band, book, assumedBand, filter]);
  const bandOf = (word: string) => hsk.bandOf(word);
  const visible = useMemo(() => new Set(rows.map((row) => row.entry.word)), [rows]);
  // What's ticked but filtered out of view still counts: say so, and act on all of it.
  const chosen = [...picked];

  const change = (next: () => void) => {
    next();
    setPicked(new Set());
  };

  const flip = (row: BandRow) => {
    const word = row.entry.word;
    if (row.status === "known") {
      const plan = planMark("new", book.get(word), statusOf(word, new Map(), bandOf, assumedBand));
      void (plan === "forget" ? forgetWords([word]) : saveWord(word, { status: "new", source: "marked" }));
    } else void saveWord(word, { status: "known", source: "marked" });
  };

  const toggle = (word: string) =>
    setPicked((were) => {
      const next = new Set(were);
      if (!next.delete(word)) next.add(word);
      return next;
    });

  const markPicked = async (target: WordStatus) => {
    const { set, forget } = planMarks(chosen, target, book, bandOf, assumedBand);
    if (set.length) await saveWords(set, { status: target, source: "marked", ...(target === "learning" ? { saved: true } : {}) });
    if (forget.length) await forgetWords(forget);
    const words = chosen.length === 1 ? "1 word" : `${chosen.length} words`;
    toast(target === "known" ? `${words} marked as known.` : target === "learning" ? `${words} put in learning.` : target === "ignored" ? `${words} ignored.` : `${words} marked as not known.`);
    setPicked(new Set());
  };

  return (
    <div className="flex flex-col gap-3 border-t border-line pt-4">
      <div className="flex flex-col gap-3 px-4 lg:px-6">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <span id="band-label" className="text-meta text-muted">
            HSK band
          </span>
          <SegmentedControl aria-labelledby="band-label" size="sm" value={String(band)} onValueChange={(value) => change(() => setBand(Number(value) as HskBand))} options={BAND_OPTIONS} />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <SegmentedControl aria-label="Show" size="sm" value={filter} onValueChange={(value) => change(() => setFilter(value as BrowseFilter))} options={FILTER_OPTIONS} />
          <Button variant={selecting ? "primary" : "secondary"} size="sm" aria-pressed={selecting} onClick={() => change(() => setSelecting(!selecting))}>
            {selecting ? "Done" : "Select"}
          </Button>
        </div>
        <p className="text-meta text-muted" role="status">
          {bandLabel(band)}: {rows.length} {rows.length === 1 ? "word" : "words"}
          {filter === "all" ? "" : filter === "todo" ? " still to learn" : " known"}.
        </p>
      </div>

      {selecting && (
        <div className="flex flex-col gap-2 border-y border-line bg-surface px-4 py-3 lg:px-6" role="group" aria-label="Mark the selected words">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-meta">
            <span className="font-medium" role="status">
              {chosen.length} selected{chosen.length > 0 && ![...picked].every((word) => visible.has(word)) ? " (some are hidden by the filter)" : ""}
            </span>
            <button type="button" className="underline underline-offset-2 hover:text-ink" onClick={() => setPicked(new Set(rows.map((row) => row.entry.word)))} disabled={rows.length === 0}>
              Select all {rows.length}
            </button>
            <button type="button" className="underline underline-offset-2 hover:text-ink disabled:no-underline disabled:opacity-50" onClick={() => setPicked(new Set())} disabled={chosen.length === 0}>
              Clear
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" disabled={chosen.length === 0} onClick={() => void markPicked("known")}>
              Known
            </Button>
            <Button size="sm" variant="secondary" disabled={chosen.length === 0} onClick={() => void markPicked("learning")}>
              Learning
            </Button>
            <Button size="sm" variant="secondary" disabled={chosen.length === 0} onClick={() => void markPicked("new")}>
              Not known
            </Button>
            <Button size="sm" variant="secondary" disabled={chosen.length === 0} onClick={() => void markPicked("ignored")}>
              Ignore
            </Button>
          </div>
        </div>
      )}

      {rows.length === 0 ? (
        <p className="px-4 pb-4 text-sm text-muted lg:px-6">{filter === "known" ? "No known words in this band yet." : "Nothing left to learn in this band."}</p>
      ) : (
        <WordWindow key={`${band}-${filter}`} items={rows} rowHeight={ROW} label={`${bandLabel(band)} words`} itemKey={(row) => row.entry.word} className="max-h-[min(60dvh,560px)] border-t border-line">
          {(row) => {
            const { word, pinyin, gloss } = row.entry;
            const text = <RowText word={word} pinyin={pinyin} gloss={gloss ?? ""} />;
            if (selecting) {
              return (
                <label className="flex w-full cursor-pointer items-center gap-3 px-4 hover:bg-hover has-focus-visible:bg-hover lg:px-6">
                  <input type="checkbox" checked={picked.has(word)} onChange={() => toggle(word)} className="size-4 shrink-0 accent-primary" aria-label={`Select ${word}`} />
                  {text}
                  <StatusBadge status={row.status} />
                </label>
              );
            }
            const known = row.status === "known";
            return (
              <>
                <button type="button" onClick={() => onOpen(word)} className="flex min-w-0 flex-1 items-center gap-3 py-2 pr-1 pl-4 text-left hover:bg-hover focus-visible:bg-hover lg:pl-6">
                  {text}
                  <StatusBadge status={row.status} />
                </button>
                <button
                  type="button"
                  onClick={() => flip(row)}
                  aria-pressed={known}
                  aria-label={`${word} is known`}
                  className="grid w-14 shrink-0 place-items-center hover:bg-hover focus-visible:bg-hover lg:pr-3"
                >
                  <span className={`grid size-7 place-items-center rounded-full border ${known ? "border-success bg-success text-on-primary" : "border-line-strong text-transparent"}`}>
                    <Check size={16} aria-hidden="true" />
                  </span>
                </button>
              </>
            );
          }}
        </WordWindow>
      )}
    </div>
  );
}
