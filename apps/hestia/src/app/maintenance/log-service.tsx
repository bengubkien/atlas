"use client";

import { useId, useState, useTransition } from "react";

import { Button } from "@atlas/ui/components/button";
import { FormDialog } from "@atlas/ui/components/form-dialog";
import { Input } from "@atlas/ui/components/input";
import { Textarea } from "@atlas/ui/components/textarea";
import { toastResult } from "@atlas/ui/components/toast";

import { logServiceAction } from "./actions";

/**
 * "Log": records that a maintenance item was done, when, by whom and for how
 * much. micasa then counts the next due date from it.
 */
export function LogService({
  item,
  vendors,
  today,
  currency,
  variant = "secondary",
}: {
  item: { id: string; name: string };
  /** Vendor names, offered as you type. */
  vendors: string[];
  today: string;
  currency: string;
  variant?: "primary" | "secondary";
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const listId = useId();

  const submit = (form: FormData) => {
    setError(null);
    startTransition(async () => {
      const result = toastResult(
        await logServiceAction({
          itemId: item.id,
          date: String(form.get("date") ?? ""),
          cost: String(form.get("cost") ?? ""),
          vendor: String(form.get("vendor") ?? ""),
          notes: String(form.get("notes") ?? ""),
        }),
      );
      if (result.ok) setOpen(false);
      else setError(result.error);
    });
  };

  return (
    <FormDialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setError(null);
      }}
      title="Log service"
      description={item.name}
      trigger={
        <Button variant={variant} size={variant === "primary" ? "md" : "sm"} aria-label={`Log service: ${item.name}`}>
          {variant === "primary" ? "Log service" : "Log"}
        </Button>
      }
    >
      <form action={submit} className="flex flex-col gap-4">
        <Input name="date" type="date" label="When" defaultValue={today} max={today} required />
        <Input
          name="cost"
          label="Cost"
          inputMode="decimal"
          autoComplete="off"
          placeholder="0.00"
          hint={`In ${currency}. Leave it empty if it cost nothing.`}
        />
        <Input
          name="vendor"
          label="Who did it"
          list={listId}
          autoComplete="off"
          placeholder="Leave empty if you did"
          hint="A vendor you've used, or a new one, which is added to Vendors."
        />
        <datalist id={listId}>
          {vendors.map((name) => (
            <option key={name} value={name} />
          ))}
        </datalist>
        <Textarea name="notes" label="Notes" rows={3} placeholder="What was done, parts used…" />
        {error && (
          <p role="alert" className="text-label text-error">
            {error}
          </p>
        )}
        <div className="mt-1 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="secondary" size="lg" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button type="submit" size="lg" disabled={pending}>
            {pending ? "Saving…" : "Log service"}
          </Button>
        </div>
      </form>
    </FormDialog>
  );
}
