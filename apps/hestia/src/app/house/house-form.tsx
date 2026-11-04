"use client";

import { Pencil } from "lucide-react";
import { useState, useTransition } from "react";

import { Button } from "@atlas/ui/components/button";
import { FormDialog } from "@atlas/ui/components/form-dialog";
import { Input } from "@atlas/ui/components/input";
import { toastResult } from "@atlas/ui/components/toast";

import type { House } from "@/lib/micasa/schemas";

import { saveHouseAction } from "./actions";

const FIELDS = ["nickname", "address_line1", "city", "state", "postal_code", "year_built", "square_feet", "bedrooms", "bathrooms"] as const;

/** The house's basics: set up the first time, edited afterwards. */
export function HouseForm({ house, inline = false }: { house: House; inline?: boolean }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const value = (key: (typeof FIELDS)[number]) => {
    const current = house[key];
    return current === null || current === undefined || current === 0 ? "" : String(current);
  };

  const submit = (form: FormData) => {
    setError(null);
    const input = Object.fromEntries(FIELDS.map((key) => [key, String(form.get(key) ?? "")])) as Record<(typeof FIELDS)[number], string>;
    startTransition(async () => {
      const result = toastResult(await saveHouseAction(input));
      if (result.ok) setOpen(false);
      else setError(result.error);
    });
  };

  const fields = (
    <form action={submit} className="flex flex-col gap-4">
      <Input name="nickname" label="Name" placeholder="The house on Elm Street" defaultValue={value("nickname")} required autoComplete="off" />
      <Input name="address_line1" label="Address" defaultValue={value("address_line1")} autoComplete="street-address" />
      <div className="grid gap-4 sm:grid-cols-3">
        <Input name="city" label="City" defaultValue={value("city")} autoComplete="address-level2" />
        <Input name="state" label="State or region" defaultValue={value("state")} autoComplete="address-level1" />
        <Input name="postal_code" label="Postal code" defaultValue={value("postal_code")} autoComplete="postal-code" />
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Input name="year_built" label="Built in" inputMode="numeric" defaultValue={value("year_built")} />
        <Input name="square_feet" label="Square feet" inputMode="numeric" defaultValue={value("square_feet")} />
        <Input name="bedrooms" label="Bedrooms" inputMode="numeric" defaultValue={value("bedrooms")} />
        <Input name="bathrooms" label="Bathrooms" inputMode="decimal" defaultValue={value("bathrooms")} />
      </div>
      {error && (
        <p role="alert" className="text-label text-error">
          {error}
        </p>
      )}
      <div className="mt-1 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        {!inline && (
          <Button variant="secondary" size="lg" onClick={() => setOpen(false)}>
            Cancel
          </Button>
        )}
        <Button type="submit" size="lg" disabled={pending}>
          {pending ? "Saving…" : "Save"}
        </Button>
      </div>
    </form>
  );

  if (inline) return fields;
  return (
    <FormDialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setError(null);
      }}
      title="Edit the basics"
      trigger={
        <Button variant="secondary">
          <Pencil size={15} aria-hidden="true" />
          Edit
        </Button>
      }
    >
      {fields}
    </FormDialog>
  );
}
