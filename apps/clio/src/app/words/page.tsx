"use client";

import { PageBody, PageHeader } from "@atlas/ui/components/page-header";
import { Panel, PanelEmpty, PanelList, PanelRow } from "@atlas/ui/components/panel";

import { Loading } from "@/components/loading";
import { useSettings, useWords } from "@/lib/local/hooks";
import type { WordStatus } from "@/lib/model";

const STATUS_NAMES: Record<WordStatus, string> = { new: "New", learning: "Learning", known: "Known", ignored: "Ignored" };

export default function WordsPage() {
  const words = useWords();
  const { assumedBand } = useSettings();
  if (!words) return <Loading />;

  const sorted = [...words].sort((a, b) => b.updatedAt - a.updatedAt);

  return (
    <>
      <PageHeader title="Words" description={`Words you've looked up, saved or marked.${assumedBand === 0 ? "" : ` The rest of ${assumedBand === 1 ? "band 1" : `bands 1 to ${assumedBand}`} count as known.`}`} />
      <PageBody className="max-w-[720px]">
        <Panel title="Your words" count={words.length || undefined}>
          {sorted.length === 0 ? (
            <PanelEmpty>No words yet. Words you tap in a text show up here.</PanelEmpty>
          ) : (
            <PanelList>
              {sorted.map((word) => (
                <PanelRow
                  key={word.id}
                  title={
                    <span lang="zh-Hans" className="font-zh">
                      {word.id}
                    </span>
                  }
                  aside={<span className="text-meta text-muted">{STATUS_NAMES[word.status]}</span>}
                />
              ))}
            </PanelList>
          )}
        </Panel>
      </PageBody>
    </>
  );
}
