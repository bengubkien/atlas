"use client";

import { useRouter } from "next/navigation";

import { Input } from "@atlas/ui/components/input";
import { Textarea } from "@atlas/ui/components/textarea";

import { field, FormFooter, useSubmit } from "@/components/dialogs";
import { centsText } from "@/lib/inputs";
import type { Appliance } from "@/lib/micasa/schemas";

import { saveApplianceAction } from "./actions";

/** An appliance's form: what it is, where, its numbers and its warranty. A new one opens its page. */
export function ApplianceForm({ appliance, currency }: { appliance?: Appliance; currency: string }) {
  const router = useRouter();
  const { error, pending, submit } = useSubmit<{ id: string }>((data) => {
    if (!appliance) router.push(`/appliances/${data.id}`);
  });
  const action = (form: FormData) =>
    submit(() =>
      saveApplianceAction(appliance?.id ?? null, {
        name: field(form, "name"),
        brand: field(form, "brand"),
        model: field(form, "model"),
        serial: field(form, "serial"),
        location: field(form, "location"),
        bought: field(form, "bought"),
        warranty: field(form, "warranty"),
        cost: field(form, "cost"),
        notes: field(form, "notes"),
      }),
    );

  return (
    <form action={action} className="flex flex-col gap-4">
      <Input name="name" label="What" placeholder="Fridge" defaultValue={appliance?.name} required autoComplete="off" />
      <div className="grid gap-4 sm:grid-cols-2">
        <Input name="brand" label="Brand" defaultValue={appliance?.brand} autoComplete="off" />
        <Input name="location" label="Where" placeholder="Kitchen" defaultValue={appliance?.location} autoComplete="off" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Input name="model" label="Model number" defaultValue={appliance?.model_number} autoComplete="off" />
        <Input name="serial" label="Serial number" defaultValue={appliance?.serial_number} autoComplete="off" />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Input name="bought" type="date" label="Bought" defaultValue={appliance?.purchase_date?.slice(0, 10)} />
        <Input name="warranty" type="date" label="Warranty until" defaultValue={appliance?.warranty_expiry?.slice(0, 10)} />
        <Input name="cost" label="Cost" inputMode="decimal" autoComplete="off" placeholder="0.00" hint={`In ${currency}.`} defaultValue={centsText(appliance?.cost_cents)} />
      </div>
      <Textarea name="notes" label="Notes" rows={2} defaultValue={appliance?.notes} />
      <FormFooter error={error} pending={pending} label={appliance ? "Save" : "Add appliance"} pendingLabel={appliance ? "Saving…" : "Adding…"} />
    </form>
  );
}
