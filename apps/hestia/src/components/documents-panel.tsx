import { FileText, Paperclip } from "lucide-react";

import { Panel, PanelEmpty, PanelList } from "@atlas/ui/components/panel";

import { DocumentForm, UploadForm } from "@/app/documents/document-forms";
import { fileKind, fileSize } from "@/lib/documents";
import type { DocumentKind } from "@/lib/micasa/api";
import type { HouseDocument } from "@/lib/micasa/schemas";

import { DialogButton } from "./dialogs";
import { RecordMenu } from "./record-menu";

/** A record's documents (manuals, receipts, photos), to open, rename or delete, and a button to attach another. */
export function DocumentsPanel({ kind, id, documents, empty }: { kind: DocumentKind; id: string; documents: HouseDocument[]; empty: string }) {
  const mine = documents.filter((doc) => doc.entity_kind === kind && doc.entity_id === id).sort((a, b) => a.title.localeCompare(b.title));
  return (
    <Panel
      title="Documents"
      count={mine.length || undefined}
      action={
        <DialogButton label="Attach" icon={<Paperclip size={15} aria-hidden="true" />} title="Attach a file" variant="secondary" size="sm">
          <UploadForm kind={kind} id={id} />
        </DialogButton>
      }
    >
      {mine.length === 0 ? (
        <PanelEmpty>{empty}</PanelEmpty>
      ) : (
        <PanelList>
          {mine.map((doc) => (
            <DocumentRow key={doc.id} doc={doc} />
          ))}
        </PanelList>
      )}
    </Panel>
  );
}

/** One document: its name opens it. */
export function DocumentRow({ doc, attached }: { doc: HouseDocument; attached?: { label: string; href?: string } | null }) {
  return (
    <li className="flex min-h-14 items-center gap-3 px-4 py-2.5 lg:px-6">
      <FileText size={18} aria-hidden="true" className="shrink-0 text-muted" />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <a href={`/documents/${doc.id}`} target="_blank" rel="noreferrer" className="truncate text-sm font-medium text-ink hover:text-muted">
          {doc.title || doc.file_name}
        </a>
        <span className="truncate text-meta text-muted">
          {[fileKind(doc), fileSize(doc.size_bytes), attached === undefined ? null : attached ? attached.label : "Not attached to anything"].filter(Boolean).join(" · ")}
        </span>
        {doc.notes && <span className="truncate text-xs text-muted">{doc.notes}</span>}
      </div>
      <RecordMenu entity="document" id={doc.id} name={doc.title || doc.file_name} editTitle="Edit document">
        <DocumentForm doc={doc} />
      </RecordMenu>
    </li>
  );
}

