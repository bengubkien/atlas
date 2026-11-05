"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Input } from "@atlas/ui/components/input";
import { Select } from "@atlas/ui/components/select";
import { Textarea } from "@atlas/ui/components/textarea";

import { field, FormFooter, useSubmit } from "@/components/dialogs";
import { centsText } from "@/lib/inputs";
import type { MaintenanceItem } from "@/lib/micasa/schemas";

import { saveMaintenanceAction } from "./actions";

type Option = { id: string; name: string };

/** A maintenance item's form: a new one (then its page opens), or `item` to edit. */
export function MaintenanceForm({ item, categories, appliances, currency }: { item?: MaintenanceItem; categories: Option[]; appliances: Option[]; currency: string }) {
  const router = useRouter();
  const [once, setOnce] = useState(Boolean(item && !item.interval_months && item.due_date));
  const { error, pending, submit } = useSubmit<{ id: string }>((data) => {
    if (!item) router.push(`/maintenance/${data.id}`);
  });

  const action = (form: FormData) =>
    submit(() =>
      saveMaintenanceAction(item?.id ?? null, {
        name: field(form, "name"),
        categoryId: field(form, "category"),
        every: once ? "" : field(form, "every"),
        dueDate: once ? field(form, "dueDate") : "",
        applianceId: field(form, "appliance"),
        season: field(form, "season") as "",
        cost: field(form, "cost"),
        notes: field(form, "notes"),
      }),
    );

  return (
    <form action={action} className="flex flex-col gap-4">
      <Input name="name" label="What" placeholder="Replace the furnace filter" defaultValue={item?.name} required autoComplete="off" />
      <Select name="category" label="Category" required defaultValue={item?.category_id ?? ""}>
        <option value="" disabled>
          Pick one
        </option>
        {categories.map(({ id, name }) => (
          <option key={id} value={id}>
            {name}
          </option>
        ))}
      </Select>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-label font-medium">When</legend>
        <div className="flex gap-4 text-sm">
          <label className="flex items-center gap-2">
            <input type="radio" name="schedule" checked={!once} onChange={() => setOnce(false)} className="accent-[var(--color-primary)]" />
            Every few months
          </label>
          <label className="flex items-center gap-2">
            <input type="radio" name="schedule" checked={once} onChange={() => setOnce(true)} className="accent-[var(--color-primary)]" />
            Once, by a date
          </label>
        </div>
        {once ? (
          <Input name="dueDate" type="date" aria-label="Due date" defaultValue={item?.due_date?.slice(0, 10)} required />
        ) : (
          <Input
            name="every"
            type="number"
            min={1}
            max={120}
            inputMode="numeric"
            aria-label="Every how many months"
            placeholder="12"
            hint="Every how many months."
            defaultValue={item?.interval_months || undefined}
            required
          />
        )}
      </fieldset>
      <Select name="appliance" label="Appliance" defaultValue={item?.appliance_id ?? ""} hint="If it's for one.">
        <option value="">None</option>
        {appliances.map(({ id, name }) => (
          <option key={id} value={id}>
            {name}
          </option>
        ))}
      </Select>
      <div className="grid gap-4 sm:grid-cols-2">
        <Select name="season" label="Best season" defaultValue={item?.season ?? ""}>
          <option value="">Any time</option>
          <option value="spring">Spring</option>
          <option value="summer">Summer</option>
          <option value="fall">Fall</option>
          <option value="winter">Winter</option>
        </Select>
        <Input name="cost" label="Usual cost" inputMode="decimal" autoComplete="off" placeholder="0.00" hint={`In ${currency}.`} defaultValue={centsText(item?.cost_cents)} />
      </div>
      <Textarea name="notes" label="Notes" rows={2} defaultValue={item?.notes} />
      <FormFooter error={error} pending={pending} label={item ? "Save" : "Add item"} pendingLabel={item ? "Saving…" : "Adding…"} />
    </form>
  );
}
