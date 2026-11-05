"use client";

import { Input } from "@atlas/ui/components/input";
import { Textarea } from "@atlas/ui/components/textarea";

import { field, FormFooter, useSubmit } from "@/components/dialogs";
import type { DocumentKind } from "@/lib/micasa/api";
import type { HouseDocument } from "@/lib/micasa/schemas";

import { editDocumentAction, uploadDocumentAction } from "./actions";

/** Attaches a file (a manual, a receipt, a photo, a warranty) to a record. */
export function UploadForm({ kind, id }: { kind: DocumentKind; id: string }) {
  const { error, pending, submit } = useSubmit();
  const action = (form: FormData) => {
    form.set("kind", kind);
    form.set("id", id);
    submit(() => uploadDocumentAction(form));
  };
  return (
    <form action={action} className="flex flex-col gap-4">
      <Input name="file" type="file" label="File" required hint="Up to 50 MB: a PDF, a photo, anything." className="[&_input]:py-2" />
      <Input name="title" label="Name" autoComplete="off" placeholder="The file's name, if you leave this empty" />
      <Textarea name="notes" label="Notes" rows={2} />
      <FormFooter error={error} pending={pending} label="Attach" pendingLabel="Uploading…" />
    </form>
  );
}

/** A document's name and notes. */
export function DocumentForm({ doc }: { doc: HouseDocument }) {
  const { error, pending, submit } = useSubmit();
  const action = (form: FormData) => submit(() => editDocumentAction(doc.id, { title: field(form, "title"), notes: field(form, "notes") }));
  return (
    <form action={action} className="flex flex-col gap-4">
      <Input name="title" label="Name" defaultValue={doc.title} required autoComplete="off" />
      <Textarea name="notes" label="Notes" rows={2} defaultValue={doc.notes} />
      <FormFooter error={error} pending={pending} label="Save" pendingLabel="Saving…" />
    </form>
  );
}
