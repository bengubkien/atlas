"use client";

import { Play, Volume2 } from "lucide-react";
import { createElement, type ReactNode } from "react";

import { cn } from "@atlas/ui/cn";

import { pinyinOf } from "@/components/reader/sentence-view";
import type { CardKind } from "@/lib/review";

import { meaningLine, type Face, type FaceSentence } from "./face";

// How a card looks, one renderer per kind (src/lib/review.ts, CARD_KINDS).
// Each kind draws its prompt, what you see before revealing; the answer
// is the same for all of them (`Answer`). Step 7e's typing and
// handwriting add a prompt here, with their own input.

type PromptProps = { face: Face; onListen?: () => void };

const PROMPTS: Record<CardKind, (props: PromptProps) => ReactNode> = {
  recognition: RecognitionPrompt,
  recall: RecallPrompt,
  listening: ListeningPrompt,
};

/** What the card asks, by kind. */
export function Prompt({ kind, ...props }: PromptProps & { kind: CardKind }) {
  // createElement, not a component picked in render (the React lint's static-components rule).
  return createElement(PROMPTS[kind], props);
}

/** What the card asks you to do, said once above it. */
export const KIND_ASKS: Record<CardKind, string> = {
  recognition: "What does it mean?",
  recall: "Say it in Chinese.",
  listening: "What did you hear?",
};

/** The word inside its sentence, the word marked. Pinyin over the word only when `pinyin`. */
function SentenceLine({ sentence, pinyin, className }: { sentence: FaceSentence; pinyin: boolean; className?: string }) {
  return (
    <p lang="zh-Hans" className={cn("font-zh text-pretty [&_rt]:font-sans [&_rt]:text-[0.45em] [&_rt]:text-muted", className)}>
      {sentence.tokens.map((token, index) => {
        if (!sentence.at.includes(index)) return <span key={index}>{token.t}</span>;
        const reading = pinyin ? pinyinOf(token, sentence.glossary) : undefined;
        return (
          <mark key={index} className="rounded-[5px] bg-word-learning px-0.5 text-ink underline decoration-word-new decoration-2 underline-offset-[0.3em]">
            {reading ? (
              <ruby>
                {token.t}
                <rt>{reading}</rt>
              </ruby>
            ) : (
              token.t
            )}
          </mark>
        );
      })}
    </p>
  );
}

function RecognitionPrompt({ face }: PromptProps) {
  return (
    <div className="flex flex-col items-center gap-6 text-center">
      <p lang="zh-Hans" className="font-zh-serif text-[64px] leading-none">
        {face.word}
      </p>
      {face.sentence && <SentenceLine sentence={face.sentence} pinyin={false} className="text-[24px] leading-[1.9]" />}
    </div>
  );
}

function RecallPrompt({ face }: PromptProps) {
  return (
    <div className="flex flex-col items-center gap-5 text-center">
      <p className="font-serif text-[30px] leading-tight text-pretty">{meaningLine(face) || "No meaning saved"}</p>
      {face.sentence && face.sentence.en && <p className="max-w-[34ch] text-[15px] leading-snug text-pretty text-muted">“{face.sentence.en}”</p>}
    </div>
  );
}

function ListeningPrompt({ onListen }: PromptProps) {
  return (
    <div className="flex flex-col items-center gap-3">
      <button
        type="button"
        onClick={onListen}
        aria-label="Play it again"
        className="grid size-24 place-items-center rounded-full border border-line-control bg-input text-ink shadow-control hover:bg-hover focus-visible:outline-2 focus-visible:outline-word-new"
      >
        <Play size={36} aria-hidden="true" className="translate-x-0.5" />
      </button>
      <p className="text-sm text-muted">Play it again</p>
    </div>
  );
}

/** The answer, whatever the kind: the word, its pinyin and meaning, the sentence with its English. */
export function Answer({ face, onListen }: PromptProps) {
  return (
    <div className="flex flex-col items-center gap-4 text-center">
      <div className="flex flex-col items-center gap-1">
        <p lang="zh-Hans" className="font-zh-serif text-[56px] leading-none">
          {face.word}
        </p>
        <p className="flex items-center gap-1 text-xl text-muted">
          {face.pinyin}
          {onListen && (
            <button type="button" onClick={onListen} aria-label={`Listen to ${face.word}`} className="grid size-10 place-items-center rounded-full hover:bg-hover hover:text-ink">
              <Volume2 size={18} aria-hidden="true" />
            </button>
          )}
        </p>
      </div>
      {face.defs.length > 0 ? (
        <p className="max-w-[36ch] text-[17px] leading-snug text-pretty">{face.defs.filter((d) => !d.startsWith("CL:")).slice(0, 4).join("; ")}</p>
      ) : (
        <p className="text-sm text-muted">No meaning on this phone yet. The dictionary, once downloaded in Words, has more.</p>
      )}
      {face.sentence && (
        <div className="flex w-full flex-col gap-1 border-t border-line pt-4">
          <SentenceLine sentence={face.sentence} pinyin className="text-[20px] leading-[2.2]" />
          <p className="text-[15px] leading-snug text-pretty text-muted">{face.sentence.en}</p>
          <p lang="zh-Hans" className="font-zh text-label text-faint">
            {face.sentence.title}
          </p>
        </div>
      )}
    </div>
  );
}
