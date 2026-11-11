"use client";

import { useState } from "react";

import { ToggleChip } from "@atlas/ui/components/chip";
import { PageBody, PageHeader } from "@atlas/ui/components/page-header";
import { SegmentedControl } from "@atlas/ui/components/segmented-control";

import { Loading } from "@/components/loading";
import { TextCard, useCoverages } from "@/components/text-card";
import { useReadings, useTexts, useWordBook } from "@/lib/local/hooks";
import { TEXT_KINDS, type TextKind } from "@/lib/model";
import { readingState, type ReadingState } from "@/lib/reading";

const KIND_FILTERS: Record<TextKind, string> = { story: "Stories", dialogue: "Dialogues", news: "News", culture: "Culture" };
type StateFilter = "all" | ReadingState;

export default function LibraryPage() {
  const texts = useTexts();
  const readings = useReadings();
  const book = useWordBook();
  const [kinds, setKinds] = useState<ReadonlySet<TextKind>>(() => new Set());
  const [state, setState] = useState<StateFilter>("all");
  const covers = useCoverages(texts, book);

  if (!texts || !readings || !book) return <Loading />;

  const shown = texts.filter(
    (text) => (kinds.size === 0 || kinds.has(text.kind)) && (state === "all" || readingState(readings.get(text.id)) === state),
  );
  const toggleKind = (kind: TextKind) =>
    setKinds((now) => {
      const next = new Set(now);
      if (next.has(kind)) next.delete(kind);
      else next.add(kind);
      return next;
    });

  return (
    <>
      <PageHeader title="Library" description="Texts at your level, to read and listen to. Tap one to start." />
      <PageBody className="max-w-[760px]">
        <div className="flex flex-col gap-3">
          <div role="group" aria-label="Kind of text" className="flex flex-wrap gap-2">
            <ToggleChip selected={kinds.size === 0} onClick={() => setKinds(new Set())}>
              All
            </ToggleChip>
            {TEXT_KINDS.map((kind) => (
              <ToggleChip key={kind} selected={kinds.has(kind)} onClick={() => toggleKind(kind)}>
                {KIND_FILTERS[kind]}
              </ToggleChip>
            ))}
          </div>
          <SegmentedControl<StateFilter>
            aria-label="Where you are"
            value={state}
            onValueChange={setState}
            size="sm"
            options={[
              { value: "all", label: "All" },
              { value: "unread", label: "Unread" },
              { value: "started", label: "Started" },
              { value: "finished", label: "Finished" },
            ]}
          />
        </div>

        {texts.length === 0 ? (
          <p className="text-sm text-muted">No texts on this device yet. They arrive when it syncs.</p>
        ) : shown.length === 0 ? (
          <p className="text-sm text-muted">
            No texts like that.{" "}
            <button
              type="button"
              className="underline underline-offset-2 hover:text-ink"
              onClick={() => {
                setKinds(new Set());
                setState("all");
              }}
            >
              Show them all
            </button>
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {shown.map((text) => (
              <li key={text.id}>
                <TextCard text={text} reading={readings.get(text.id)} cover={covers.get(text.id)} />
              </li>
            ))}
          </ul>
        )}
      </PageBody>
    </>
  );
}

