"use client";

import { useMemo, useState } from "react";

import { PageBody, PageHeader } from "@atlas/ui/components/page-header";
import { Panel, PanelEmpty } from "@atlas/ui/components/panel";
import { SegmentedControl } from "@atlas/ui/components/segmented-control";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@atlas/ui/components/tabs";
import { useNow } from "@atlas/ui/use-now";

import { DictionarySearch } from "@/components/dictionary-search";
import { DictionaryStatus } from "@/components/dictionary-status";
import { Loading } from "@/components/loading";
import { WordBrowse } from "@/components/word-browse";
import { WordDetail } from "@/components/word-detail";
import { bandName, StatusBadge, useGlosser, WordRowButton } from "@/components/word-row";
import { WordWindow } from "@/components/word-window";
import { WordProgress } from "@/components/word-progress";
import { useDictionary, useDictionaryOnPhone, useHskState } from "@/lib/local/data";
import { useSettings, useWordBook, useWords } from "@/lib/local/hooks";
import { statusOf } from "@/lib/words";

import { dueLabel, tabCounts, yourWords, type YourTab } from "./lists";

const EMPTY: Record<YourTab, string> = {
  learning: "Nothing in learning yet. Open a word and choose Learning, and it shows up here.",
  known: "No words marked known yet. Words in the bands you assume known aren't listed: they count as known without a record. Mark the ones you know above them in Browse.",
  ignored: "No ignored words. Ignore names or words you don't want asked about.",
};

export default function WordsPage() {
  const hsk = useHskState();
  const words = useWords();
  const book = useWordBook();
  const { assumedBand } = useSettings();
  const [open, setOpen] = useState<string | null>(null);

  // A dictionary that's already on the phone loads by itself; otherwise it waits for the button.
  const onPhone = useDictionaryOnPhone();
  const dictionary = useDictionary(onPhone.cached === true);

  if (hsk.error && !hsk.data) {
    return (
      <>
        <PageHeader title="Words" />
        <PageBody className="max-w-[720px]">
          <p role="alert" className="text-sm text-error">
            The word list didn&apos;t load: {hsk.error}{" "}
            <button type="button" onClick={hsk.retry} className="underline underline-offset-2">
              Try again
            </button>
          </p>
        </PageBody>
      </>
    );
  }
  if (!hsk.data || !words || !book) return <Loading />;

  const list = hsk.data;
  const status = (word: string) => statusOf(word, book, (w) => list.bandOf(w), assumedBand);

  return (
    <>
      <PageHeader title="Words" description="Look a word up, see how much you know, and mark what you already do." />
      <PageBody className="max-w-[720px]">
        <DictionarySearch dictionary={dictionary} hsk={list} statusOf={status} onOpen={setOpen} />
        <WordProgress hsk={list} book={book} assumedBand={assumedBand} />

        <Panel title="Words">
          <Tabs defaultValue="mine">
            <div className="px-4 lg:px-6">
              <TabsList>
                <TabsTrigger value="mine">Your words</TabsTrigger>
                <TabsTrigger value="browse">Browse a band</TabsTrigger>
              </TabsList>
            </div>
            <TabsContent value="mine" className="pt-3">
              <YourWords words={words} onOpen={setOpen} />
            </TabsContent>
            <TabsContent value="browse" className="pt-3">
              <WordBrowse hsk={list} book={book} assumedBand={assumedBand} onOpen={setOpen} />
            </TabsContent>
          </Tabs>
        </Panel>

        <Panel title="Dictionary">
          <div className="border-t border-line px-4 py-4 lg:px-6">
            <DictionaryStatus />
          </div>
        </Panel>
      </PageBody>
      {open !== null && <WordDetail key={open} word={open} onClose={() => setOpen(null)} />}
    </>
  );
}

/** The words with a record, by what you've said about them. */
function YourWords({ words, onOpen }: { words: Parameters<typeof yourWords>[0]; onOpen: (word: string) => void }) {
  const [tab, setTab] = useState<YourTab>("learning");
  const now = useNow(60_000);
  const gloss = useGlosser();
  const counts = useMemo(() => tabCounts(words), [words]);
  const shown = useMemo(() => yourWords(words, tab), [words, tab]);

  return (
    <div className="flex flex-col gap-3">
      <div className="px-4 lg:px-6">
        <SegmentedControl<YourTab>
          aria-label="Your words"
          value={tab}
          onValueChange={setTab}
          options={[
            { value: "learning", label: `Learning ${counts.learning}` },
            { value: "known", label: `Known ${counts.known}` },
            { value: "ignored", label: `Ignored ${counts.ignored}` },
          ]}
        />
      </div>
      {shown.length === 0 ? (
        <PanelEmpty>{EMPTY[tab]}</PanelEmpty>
      ) : (
        <WordWindow key={tab} items={shown} rowHeight={60} label={`${tab} words`} itemKey={(word) => word.id} className="max-h-[min(60dvh,560px)] border-t border-line">
          {(word) => {
            const found = gloss(word.id);
            const due = dueLabel(word.card, now);
            return (
              <WordRowButton
                word={word.id}
                pinyin={found.pinyin}
                gloss={found.gloss}
                onClick={() => onOpen(word.id)}
                aside={
                  <>
                    <span className="text-label text-muted">{bandName(found.band)}</span>
                    {due ? <span className="text-label text-muted">{due}</span> : <StatusBadge status={word.status} showNew />}
                  </>
                }
              />
            );
          }}
        </WordWindow>
      )}
    </div>
  );
}
