"use client";

import { useState } from "react";

import { Button } from "@atlas/ui/components/button";
import { FormDialog } from "@atlas/ui/components/form-dialog";
import { Input } from "@atlas/ui/components/input";
import { Select } from "@atlas/ui/components/select";
import { toast } from "@atlas/ui/components/toast";
import { parseMoney } from "@atlas/ui/format";

import { typeRate } from "@/lib/actions";
import { isDate } from "@/lib/dates";
import { useSettings, useToday } from "@/lib/local/hooks";
import { RATE_KINDS, type RateKind } from "@/lib/model";

export const RATE_NAMES: Record<RateKind, string> = { mep: "MEP", blue: "Blue", official: "Official" };

/** Typing in a day's exchange rate: pesos for one dollar. */
export function RateForm({ onDone }: { onDone: () => void }) {
  const today = useToday();
  const settings = useSettings();
  const [error, setError] = useState<string | null>(null);

  const save = async (form: FormData) => {
    const date = String(form.get("date") ?? "");
    const kind = String(form.get("kind")) as RateKind;
    const pesos = parseMoney(String(form.get("pesos") ?? ""));
    if (!isDate(date)) return setError("Pick the day.");
    if (typeof pesos !== "number" || pesos <= 0) return setError("Type how many pesos one dollar costs.");
    await typeRate(date, kind, pesos);
    toast(`${RATE_NAMES[kind]} rate for ${date} saved.`);
    onDone();
  };

  return (
    <form action={save} className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Input name="date" type="date" label="Day" defaultValue={today} required />
        <Select name="kind" label="Kind" defaultValue={settings.rateKind}>
          {RATE_KINDS.map((kind) => (
            <option key={kind} value={kind}>
              {RATE_NAMES[kind]}
            </option>
          ))}
        </Select>
      </div>
      <Input name="pesos" label="Pesos per dollar" inputMode="decimal" autoComplete="off" placeholder="1450.50" required autoFocus hint="A rate you type wins over the fetched one for that day." />
      {error && (
        <p role="alert" className="text-label text-error">
          {error}
        </p>
      )}
      <div className="flex justify-end">
        <Button type="submit" size="lg">
          Save rate
        </Button>
      </div>
    </form>
  );
}

export function RateDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <FormDialog open={open} onOpenChange={onOpenChange} title="Type a rate" description="For a day the quotes missed, or one you got yourself.">
      {open && <RateForm onDone={() => onOpenChange(false)} />}
    </FormDialog>
  );
}
