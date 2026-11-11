"use client";

import { PageBody, PageHeader } from "@atlas/ui/components/page-header";
import { Panel, PanelEmpty, PanelList, PanelRow } from "@atlas/ui/components/panel";

import { Loading } from "@/components/loading";
import { useTexts } from "@/lib/local/hooks";

export default function LibraryPage() {
  const texts = useTexts();
  if (!texts) return <Loading />;

  return (
    <>
      <PageHeader title="Library" description="Texts at your level, to read and listen to." />
      <PageBody className="max-w-[720px]">
        <Panel title="Texts" count={texts.length || undefined}>
          {texts.length === 0 ? (
            <PanelEmpty>No texts yet.</PanelEmpty>
          ) : (
            <PanelList>
              {texts.map((text) => (
                <PanelRow
                  key={text.id}
                  title={
                    <span lang="zh-Hans" className="font-zh">
                      {text.title.zh}
                    </span>
                  }
                  meta={text.title.en}
                  aside={<span className="text-meta text-muted">Band {text.band}</span>}
                />
              ))}
            </PanelList>
          )}
        </Panel>
      </PageBody>
    </>
  );
}
