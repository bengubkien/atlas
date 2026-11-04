"use client";

import { Plus } from "lucide-react";
import { useState } from "react";

import { Button } from "@atlas/ui/components/button";
import { FormDialog } from "@atlas/ui/components/form-dialog";
import { Input } from "@atlas/ui/components/input";
import { toast } from "@atlas/ui/components/toast";

import { addReading } from "@/lib/actions";
import { useSettings } from "@/lib/local/hooks";
import { display } from "@/lib/measures";
import type { Measure } from "@/lib/model";

/** "YYYY-MM-DDTHH:MM" for a datetime-local field, here and now. */
const localNow = () => {
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  return now.toISOString().slice(0, 16);
};

const number = (text: string) => {
  const value = Number(text.trim().replace(",", "."));
  return text.trim() && Number.isFinite(value) ? value : null;
};

/** "Add" a reading of a measure: its number (or two), when, and a note. */
export function ReadingDialog({ measure, variant = "secondary" }: { measure: Measure; variant?: "primary" | "secondary" }) {
  const settings = useSettings();
  const shown = display(measure, settings);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async (form: FormData) => {
    const value = number(String(form.get("value") ?? ""));
    const value2 = measure.pair ? number(String(form.get("value2") ?? "")) : null;
    const when = new Date(String(form.get("at") ?? "")).getTime();
    if (value === null || (measure.pair && value2 === null)) return setError(measure.pair ? "Enter both numbers." : "Enter the number.");
    if (!Number.isFinite(when)) return setError("Pick when it was.");
    if (when > Date.now() + 60_000) return setError("That's in the future.");
    await addReading({
      measureId: measure.id,
      at: when,
      value: shown.toStored(value),
      value2: value2 === null ? null : shown.toStored(value2),
      note: String(form.get("note") ?? "").trim().slice(0, 500),
    });
    setOpen(false);
    setError(null);
    toast(`${measure.name} saved.`);
  };

  return (
    <FormDialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setError(null);
      }}
      title={measure.name}
      description={shown.unit ? `In ${shown.unit}.` : undefined}
      trigger={
        <Button variant={variant} size={variant === "primary" ? "md" : "sm"} aria-label={`Add ${measure.name.toLowerCase()}`}>
          {variant === "primary" && <Plus size={16} aria-hidden="true" />}
          {variant === "primary" ? "Add reading" : "Add"}
        </Button>
      }
    >
      <form action={save} className="flex flex-col gap-4">
        {measure.pair ? (
          <div className="grid grid-cols-2 gap-3">
            <Input name="value" label={measure.id === "m-blood-pressure" ? "Systolic (top)" : "First"} inputMode="decimal" autoComplete="off" required autoFocus />
            <Input name="value2" label={measure.id === "m-blood-pressure" ? "Diastolic (bottom)" : "Second"} inputMode="decimal" autoComplete="off" required />
          </div>
        ) : (
          <Input name="value" label={shown.unit ? `${measure.name} (${shown.unit})` : measure.name} inputMode="decimal" autoComplete="off" required autoFocus />
        )}
        <Input name="at" type="datetime-local" label="When" defaultValue={localNow()} required />
        <Input name="note" label="Note" autoComplete="off" placeholder="After a run, before breakfast…" />
        {error && (
          <p role="alert" className="text-label text-error">
            {error}
          </p>
        )}
        <div className="flex justify-end">
          <Button type="submit" size="lg">
            Save
          </Button>
        </div>
      </form>
    </FormDialog>
  );
}
