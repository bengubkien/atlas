"use client";

import { Languages } from "lucide-react";
import { memo, type ReactNode } from "react";

import { cn } from "@atlas/ui/cn";

import type { GlossEntry, PinyinMode, Sentence, Token } from "@/lib/model";

// One sentence in the reader, drawn inline so sentences flow as a
// paragraph. Each word is a button; taps are handled once, on the text
// (the reader's `data-s`/`data-k` delegation), so a few hundred words
// carry no handlers of their own.
//
// It's memoised: a sentence draws again only when something it shows
// changes. `marks` holds each token's status as one letter, so tapping a
// word re-draws only the sentences that contain it.

/** A token's status as one letter, for `marks`: new, learning, known, ignored, or "-" for punctuation. */
export const MARK = { new: "n", learning: "l", known: "k", ignored: "i" } as const;
export type Mark = (typeof MARK)[keyof typeof MARK] | "-";

const OPENING = /^[“‘《〈「『（(【〔［[]+$/;

const STATUS_WORDS: Record<string, string> = { n: "new word", l: "learning" };

/** The token's pinyin as read here, or the glossary's. */
export const pinyinOf = (token: Token, glossary: Record<string, GlossEntry>) =>
  token.p ?? (token.w && Object.hasOwn(glossary, token.w) ? glossary[token.w]!.pinyin : undefined);

type Props = {
  sentence: Sentence;
  index: number;
  marks: string;
  glossary: Record<string, GlossEntry>;
  pinyin: PinyinMode;
  /** The token whose sheet is open, or -1. */
  selected: number;
  speaking: boolean;
  english: boolean;
};

export const SentenceView = memo(function SentenceView({ sentence, index, marks, glossary, pinyin, selected, speaking, english }: Props) {
  // Punctuation sticks to the word before it (an opening mark to the word
  // after), so a line never starts with "，" or ends with "“".
  const clusters: ReactNode[][] = [];
  let opening: ReactNode[] = [];
  sentence.tokens.forEach((token, at) => {
    const mark = (marks[at] ?? "-") as Mark;
    if (!token.w) {
      const node = (
        <span key={at} className={/^\s+$/.test(token.t) ? undefined : "text-ink"}>
          {token.t}
        </span>
      );
      if (OPENING.test(token.t) || clusters.length === 0) opening.push(node);
      else clusters[clusters.length - 1]!.push(node);
      return;
    }
    const reading = pinyinOf(token, glossary);
    const showPinyin = reading !== undefined && (pinyin === "all" || (pinyin === "unknown" && mark !== "k"));
    const label = [token.t, reading, STATUS_WORDS[mark]].filter(Boolean).join(", ");
    const characters = <span className={cn(mark === "n" && "underline decoration-word-new decoration-2 underline-offset-[0.3em]")}>{token.t}</span>;
    clusters.push([
      ...opening,
      <button
        key={at}
        type="button"
        data-s={index}
        data-k={at}
        aria-label={label}
        aria-haspopup="dialog"
        className={cn(
          "cursor-pointer rounded-[5px] px-[1px] leading-[inherit] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-word-new",
          mark === "l" && "bg-word-learning",
          selected === at && "bg-selected outline-2 outline-word-new",
        )}
      >
        {showPinyin ? (
          <ruby>
            {characters}
            <rt>{reading}</rt>
          </ruby>
        ) : (
          characters
        )}
      </button>,
    ]);
    opening = [];
  });
  if (opening.length > 0) clusters.push(opening);

  const control = (
    <button
      key="english"
      type="button"
      data-s={index}
      data-action="english"
      aria-expanded={english}
      aria-label={english ? "Hide the English" : "Show the English"}
      className={cn(
        "ml-0.5 inline-grid size-7 translate-y-[-0.1em] place-items-center rounded-full align-middle text-faint hover:bg-hover hover:text-ink focus-visible:outline-2 focus-visible:outline-word-new",
        english && "text-muted",
      )}
    >
      <Languages size={15} aria-hidden="true" />
    </button>
  );
  if (clusters.length > 0) clusters[clusters.length - 1]!.push(control);
  else clusters.push([control]);

  return (
    <span
      data-sentence={index}
      className={cn("rounded-[6px] motion-safe:transition-colors", speaking && "bg-word-speaking")}
    >
      {clusters.map((cluster, at) => (
        <span key={at} className="whitespace-nowrap">
          {cluster}
        </span>
      ))}
    </span>
  );
});
