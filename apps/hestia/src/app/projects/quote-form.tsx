"use client";

import { useId } from "react";

import { Input } from "@atlas/ui/components/input";
import { Textarea } from "@atlas/ui/components/textarea";

import { field, FormFooter, useSubmit } from "@/components/dialogs";
import { centsText } from "@/lib/inputs";
import type { Quote } from "@/lib/micasa/schemas";

import { saveQuoteAction } from "./actions";

/** A quote for a project: who it's from and what it comes to, or `quote` to edit. */
export function QuoteForm({ projectId, quote, vendors, today, currency }: { projectId: string; quote?: Quote; vendors: string[]; today: string; currency: string }) {
  const listId = useId();
  const { error, pending, submit } = useSubmit();
  const action = (form: FormData) =>
    submit(() =>
      saveQuoteAction(quote?.id ?? null, {
        projectId,
        vendor: field(form, "vendor"),
        total: field(form, "total"),
        labor: field(form, "labor"),
        materials: field(form, "materials"),
        received: field(form, "received"),
        notes: field(form, "notes"),
      }),
    );

  return (
    <form action={action} className="flex flex-col gap-4">
      <Input name="vendor" label="From" list={listId} autoComplete="off" required defaultValue={quote?.vendor} hint="A vendor you've used, or a new one, which is added to Vendors." />
      <datalist id={listId}>
        {vendors.map((name) => (
          <option key={name} value={name} />
        ))}
      </datalist>
      <Input name="total" label="Total" inputMode="decimal" autoComplete="off" placeholder="0.00" required hint={`In ${currency}.`} defaultValue={centsText(quote?.total_cents)} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Input name="labor" label="Labor" inputMode="decimal" autoComplete="off" placeholder="0.00" hint="If it's broken down." defaultValue={centsText(quote?.labor_cents)} />
        <Input name="materials" label="Materials" inputMode="decimal" autoComplete="off" placeholder="0.00" defaultValue={centsText(quote?.materials_cents)} />
      </div>
      <Input name="received" type="date" label="Received" max={today} defaultValue={quote ? quote.received_date?.slice(0, 10) : today} />
      <Textarea name="notes" label="Notes" rows={2} placeholder="What's included, how long it's good for…" defaultValue={quote?.notes} />
      <FormFooter error={error} pending={pending} label={quote ? "Save" : "Add quote"} pendingLabel="Saving…" />
    </form>
  );
}
