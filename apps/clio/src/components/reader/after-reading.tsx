"use client";

import Link from "next/link";

import { buttonClassName } from "@atlas/ui/components/button";

import type { Note, Text } from "@/lib/model";
import { QuizSlot } from "../quiz/quiz";

// What comes after finishing a text: a short summary, the grammar notes,
// and the quiz (src/components/quiz, which records its score on the reading).

export type ReadingResult = {
  /** Words of this text now in review (tapped or marked "Learning"). */
  saved: number;
  /** Words marked known by finishing. */
  marked: number;
  /** The share of the text's words you know now, 0 to 1. */
  coverage: number;
};

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

export function GrammarNote({ note }: { note: Note }) {
  return (
    <div className="flex flex-col gap-1.5">
      <h3 className="text-[15px] font-semibold">{note.title}</h3>
      <p className="text-sm leading-relaxed text-pretty">{note.explanation}</p>
      {note.example && (
        <div className="mt-1 flex flex-col gap-0.5 border-l-2 border-word-new pl-3">
          <span lang="zh-Hans" className="font-zh text-[17px]">
            {note.example.zh}
          </span>
          {note.example.pinyin && <span className="text-meta text-muted">{note.example.pinyin}</span>}
          <span className="text-meta">{note.example.en}</span>
        </div>
      )}
    </div>
  );
}

export function AfterReading({ text, result }: { text: Text; result?: ReadingResult }) {
  return (
    <section aria-labelledby="after-reading" className="flex flex-col gap-6 rounded-panel border border-line-card bg-card px-4 py-5 lg:px-6">
      <div className="flex flex-col gap-1">
        <h2 id="after-reading" tabIndex={-1} className="font-serif text-[26px] leading-tight focus:outline-none">
          Finished
        </h2>
        {result && (
          <p className="text-sm text-muted">
            {Math.floor(result.coverage * 100)}% of this text known now
            {result.marked > 0 ? `, ${plural(result.marked, "word", "words")} marked as known` : ""}
            {result.saved > 0 ? `, ${plural(result.saved, "word", "words")} saved for review` : ""}.
          </p>
        )}
      </div>

      <QuizSlot text={text} />

      {text.notes.length > 0 && (
        <div className="flex flex-col gap-5 border-t border-line pt-5">
          <h3 className="font-serif text-[22px] leading-tight">Grammar in this text</h3>
          {text.notes.map((note) => (
            <GrammarNote key={note.title} note={note} />
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-2 border-t border-line pt-5">
        <Link href="/library" className={buttonClassName("primary", "lg")}>
          Back to the library
        </Link>
        <Link href="/" className={buttonClassName("secondary", "lg")}>
          Today
        </Link>
      </div>
    </section>
  );
}
