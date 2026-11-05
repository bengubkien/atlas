import type { Metadata } from "next";

import { PageBody, PageHeader } from "@atlas/ui/components/page-header";
import { Panel, PanelEmpty, PanelList } from "@atlas/ui/components/panel";

import { DocumentRow } from "@/components/documents-panel";
import { attachedTo } from "@/lib/documents";
import { getEverything } from "@/lib/micasa/api";

export const metadata: Metadata = { title: "Documents" };

/** Every document in the house, newest name first, with what each belongs to. Attach new ones from the record they're about. */
export default async function DocumentsPage() {
  const everything = await getEverything();
  const docs = [...everything.documents].sort((a, b) => (a.title || a.file_name).localeCompare(b.title || b.file_name));
  return (
    <>
      <PageHeader title="Documents" description="Manuals, receipts, warranties and photos. Attach one from the appliance, project, issue or maintenance item it's about." />
      <PageBody>
        <Panel title="All documents" count={docs.length}>
          {docs.length === 0 ? (
            <PanelEmpty>No documents yet. Open an appliance, a project or an issue and attach a file there.</PanelEmpty>
          ) : (
            <PanelList>
              {docs.map((doc) => (
                <DocumentRow key={doc.id} doc={doc} attached={attachedTo(doc, everything)} />
              ))}
            </PanelList>
          )}
        </Panel>
      </PageBody>
    </>
  );
}
