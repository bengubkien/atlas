"use client";

import { PageBody, PageHeader } from "@atlas/ui/components/page-header";
import { Panel, PanelEmpty } from "@atlas/ui/components/panel";

import { Loading } from "@/components/loading";
import { useDueCount } from "@/lib/local/hooks";

export default function ReviewPage() {
  const due = useDueCount();
  if (due === undefined) return <Loading />;

  return (
    <>
      <PageHeader title="Review" description="Words you saved come back here, just before you'd forget them." />
      <PageBody className="max-w-[720px]">
        <Panel title="Due now" count={due}>
          <PanelEmpty>{due === 0 ? "Nothing to review." : `${due} ${due === 1 ? "word is" : "words are"} due.`}</PanelEmpty>
        </Panel>
      </PageBody>
    </>
  );
}
