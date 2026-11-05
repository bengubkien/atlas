"use client";

import { Input } from "@atlas/ui/components/input";
import { Textarea } from "@atlas/ui/components/textarea";

import { field, FormFooter, useSubmit } from "@/components/dialogs";
import type { Vendor } from "@/lib/micasa/schemas";

import { saveVendorAction } from "./actions";

/** A vendor: who they are and how to reach them, or `vendor` to edit. */
export function VendorForm({ vendor }: { vendor?: Vendor }) {
  const { error, pending, submit } = useSubmit();
  const action = (form: FormData) =>
    submit(() =>
      saveVendorAction(vendor?.id ?? null, {
        name: field(form, "name"),
        contact: field(form, "contact"),
        phone: field(form, "phone"),
        email: field(form, "email"),
        website: field(form, "website"),
        notes: field(form, "notes"),
      }),
    );
  return (
    <form action={action} className="flex flex-col gap-4">
      <Input name="name" label="Name" placeholder="Smith Plumbing" defaultValue={vendor?.name} required autoComplete="off" />
      <Input name="contact" label="Who to ask for" defaultValue={vendor?.contact_name} autoComplete="off" />
      <div className="grid gap-4 sm:grid-cols-2">
        <Input name="phone" type="tel" label="Phone" defaultValue={vendor?.phone} autoComplete="off" />
        <Input name="email" type="email" label="Email" defaultValue={vendor?.email} autoComplete="off" />
      </div>
      <Input name="website" label="Website" inputMode="url" defaultValue={vendor?.website} autoComplete="off" />
      <Textarea name="notes" label="Notes" rows={2} defaultValue={vendor?.notes} />
      <FormFooter error={error} pending={pending} label={vendor ? "Save" : "Add vendor"} pendingLabel="Saving…" />
    </form>
  );
}
