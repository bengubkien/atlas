"use client";

import { Check, Clock, EyeOff, Volume2 } from "lucide-react";
import type { ReactNode } from "react";

import { Badge } from "@atlas/ui/components/badge";
import { Button } from "@atlas/ui/components/button";
import { cn } from "@atlas/ui/cn";

import type { GlossEntry, WordStatus } from "@/lib/model";

// What the word sheet says about one word, quickly: the word, its pinyin,
// what it means here (the text's glossary, which is always on the phone),
// its band, and what you want to do with it, one tap each. The word in
// full (every dictionary reading, its characters, other words with it) is
// Words' WordDetail, one tap further ("More about this word").

const STATUS_LINE: Record<WordStatus, string> = {
  new: "New word.",
  learning: "Learning: in your reviews.",
  known: "Known.",
  ignored: "Ignored: not asked about or counted.",
};

const ACTIONS: { status: WordStatus; label: string; icon: ReactNode }[] = [
  { status: "known", label: "I know this", icon: <Check size={16} aria-hidden="true" /> },
  { status: "learning", label: "Learning", icon: <Clock size={16} aria-hidden="true" /> },
  { status: "ignored", label: "Ignore", icon: <EyeOff size={16} aria-hidden="true" /> },
];

export function LookupTitle({ headword, pinyin, onListen }: { headword: string; pinyin?: string; onListen?: () => void }) {
  return (
    <div className="flex flex-wrap items-end gap-x-3 gap-y-1">
      <span lang="zh-Hans" className="font-zh text-[44px] leading-none">
        {headword}
      </span>
      {pinyin && <span className="pb-1 text-lg text-muted">{pinyin}</span>}
      {onListen && (
        <button
          type="button"
          onClick={onListen}
          aria-label={`Listen to ${headword}`}
          className="mb-0.5 grid size-9 place-items-center rounded-full text-muted hover:bg-hover hover:text-ink"
        >
          <Volume2 size={18} aria-hidden="true" />
        </button>
      )}
    </div>
  );
}

export function Lookup({
  headword,
  asWritten,
  gloss,
  band,
  status,
  saved,
  onStatus,
  onMore,
}: {
  headword: string;
  /** The word as it is in the text, when that differs from the headword (看看 for 看). */
  asWritten?: string;
  gloss?: GlossEntry;
  band?: number;
  status: WordStatus;
  /** It was just saved for review by this tap. */
  saved: boolean;
  onStatus: (status: WordStatus) => void;
  /** Opens the word in full (Words' WordDetail): every reading, its characters, words with it. */
  onMore: () => void;
}) {
  return (
    <div className="mt-4 flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        {band !== undefined && <Badge>HSK {band}</Badge>}
        <span role="status" className={cn("text-sm", saved ? "font-medium text-ink" : "text-muted")}>
          {saved ? "Saved for review." : gloss?.name && status === "known" ? "A name." : STATUS_LINE[status]}
        </span>
      </div>
      {asWritten && asWritten !== headword && (
        <p className="text-meta text-muted">
          In the text as{" "}
          <span lang="zh-Hans" className="font-zh text-ink">
            {asWritten}
          </span>
          .
        </p>
      )}

      {gloss ? (
        <ol className="flex list-decimal flex-col gap-1 pl-5 text-[15px] leading-snug marker:text-faint">
          {gloss.defs.map((definition) => (
            <li key={definition}>{definition}</li>
          ))}
        </ol>
      ) : (
        <p className="text-sm text-muted">This text doesn&apos;t explain it.</p>
      )}

      <button type="button" onClick={onMore} className="self-start text-meta text-muted underline underline-offset-2 hover:text-ink">
        More about this word: every meaning, its characters
      </button>

      <div role="group" aria-label="This word" className="grid grid-cols-3 gap-2 pt-1">
        {ACTIONS.map((action) => {
          const on = status === action.status;
          return (
            <Button
              key={action.status}
              variant="secondary"
              size="lg"
              aria-pressed={on}
              onClick={() => onStatus(action.status)}
              className={cn("min-h-14 flex-col gap-1 px-1 text-meta [&>svg]:shrink-0", on && "border-primary bg-selected font-semibold")}
            >
              {action.icon}
              {action.label}
            </Button>
          );
        })}
      </div>
    </div>
  );
}
