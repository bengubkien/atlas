"use client";

import { Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Panel } from "@atlas/ui/components/panel";

import { foundFrom, searchHsk, type Found } from "@/app/words/lists";
import type { Dictionary } from "@/lib/dictionary";
import type { HskList } from "@/lib/hsk";
import type { WordStatus } from "@/lib/model";

import { DictionaryStatus } from "./dictionary-status";
import { bandName, RowText, StatusBadge } from "./word-row";

const DELAY_MS = 200;

/**
 * The search box and its results, for characters, pinyin (with tones or
 * without) or English. It searches the dictionary when that's loaded and the
 * HSK list until then, and says which. Results are ranked as the dictionary
 * ranks them; tapping one calls `onOpen`.
 */
export function DictionarySearch({
  dictionary,
  hsk,
  statusOf,
  onOpen,
}: {
  dictionary: Dictionary | undefined;
  hsk: HskList;
  statusOf: (word: string) => WordStatus;
  onOpen: (word: string) => void;
}) {
  const [text, setText] = useState("");
  const [query, setQuery] = useState("");

  // Searching the dictionary takes a moment, so it waits for a pause in typing.
  useEffect(() => {
    const timer = setTimeout(() => setQuery(text.trim()), DELAY_MS);
    return () => clearTimeout(timer);
  }, [text]);

  const results: Found[] = useMemo(() => {
    if (!query) return [];
    return dictionary ? dictionary.search(query).map(foundFrom) : searchHsk(hsk, query);
  }, [dictionary, hsk, query]);

  const searching = text.trim() !== query;

  return (
    <div className="flex flex-col gap-3">
      <div className="relative">
        <Search size={16} aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted" />
        <input
          type="search"
          value={text}
          onChange={(event) => setText(event.target.value)}
          aria-label="Search words"
          placeholder="Search by characters, pinyin or English"
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          enterKeyHint="search"
          className="h-11 w-full rounded-control border border-line-field bg-input pr-3 pl-9 text-field text-ink shadow-control placeholder:text-muted focus-visible:outline-2 focus-visible:outline-primary"
        />
      </div>

      {query && (
        <Panel title="Results" count={searching ? undefined : results.length}>
          <p className="sr-only" role="status">
            {searching ? "Searching" : results.length === 0 ? "No match" : `${results.length} results`}
          </p>
          {!dictionary && (
            <div className="border-t border-line px-4 py-3 lg:px-6">
              <DictionaryStatus />
            </div>
          )}
          {results.length === 0 ? (
            <p className="border-t border-line px-4 py-5 text-sm text-muted lg:px-6">
              {searching ? "Searching…" : `Nothing matches “${query}”${dictionary ? "" : " in the HSK words"}.`}
            </p>
          ) : (
            <ul className="flex flex-col divide-y divide-line border-t border-line">
              {results.map((found) => (
                <li key={found.word}>
                  <button type="button" onClick={() => onOpen(found.word)} className="flex min-h-14 w-full items-center gap-3 px-4 py-2 text-left hover:bg-hover focus-visible:bg-hover lg:px-6">
                    <RowText word={found.word} pinyin={found.pinyin} gloss={found.gloss} />
                    <span className="flex shrink-0 flex-col items-end gap-1">
                      <span className="text-label text-muted">{found.band ? bandName(found.band) : ""}</span>
                      <StatusBadge status={statusOf(found.word)} />
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      )}
    </div>
  );
}
