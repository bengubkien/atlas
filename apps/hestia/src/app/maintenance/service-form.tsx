"use client";

import { useId } from "react";

import { Input } from "@atlas/ui/components/input";
import { Textarea } from "@atlas/ui/components/textarea";

import { field, FormFooter, useSubmit } from "@/components/dialogs";
import { centsText } from "@/lib/inputs";
import type { ServiceLogEntry } from "@/lib/micasa/schemas";

import { saveServiceAction } from "./actions";

/**
 * A service: that a maintenance item was done, when, by whom and for how
 * much (micasa then counts the next due date from it), or `entry` to
 * correct one.
 */
export function ServiceForm({
  itemId,
  entry,
  vendors,
  today,
  currency,
}: {
  itemId: string;
  entry?: ServiceLogEntry;
  /** Vendor names, offered as you type. */
  vendors: string[];
  today: string;
  currency: string;
}) {
  const listId = useId();
  const { error, pending, submit } = useSubmit();
  const action = (form: FormData) =>
    submit(() =>
      saveServiceAction(entry?.id ?? null, {
        itemId,
        date: field(form, "date"),
        cost: field(form, "cost"),
        vendor: field(form, "vendor"),
        notes: field(form, "notes"),
      }),
    );

  return (
    <form action={action} className="flex flex-col gap-4">
      <Input name="date" type="date" label="When" defaultValue={entry?.serviced_at.slice(0, 10) ?? today} max={today} required />
      <Input
        name="cost"
        label="Cost"
        inputMode="decimal"
        autoComplete="off"
        placeholder="0.00"
        hint={`In ${currency}. Leave it empty if it cost nothing.`}
        defaultValue={centsText(entry?.cost_cents)}
      />
      <Input
        name="vendor"
        label="Who did it"
        list={listId}
        autoComplete="off"
        placeholder="Leave empty if you did"
        hint="A vendor you've used, or a new one, which is added to Vendors."
        defaultValue={entry?.vendor}
      />
      <datalist id={listId}>
        {vendors.map((name) => (
          <option key={name} value={name} />
        ))}
      </datalist>
      <Textarea name="notes" label="Notes" rows={3} placeholder="What was done, parts used…" defaultValue={entry?.notes} />
      <FormFooter error={error} pending={pending} label={entry ? "Save" : "Log service"} pendingLabel="Saving…" />
    </form>
  );
}
