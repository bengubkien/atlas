"use client";

import { Plus } from "lucide-react";
import { useState, useTransition } from "react";

import { Button } from "@atlas/ui/components/button";
import { FormDialog } from "@atlas/ui/components/form-dialog";
import { Input } from "@atlas/ui/components/input";
import { Select } from "@atlas/ui/components/select";
import { Textarea } from "@atlas/ui/components/textarea";
import { toastResult } from "@atlas/ui/components/toast";

import { reportIncident } from "./actions";

/** "Report an issue": something broke or needs fixing. */
export function ReportIncident({ appliances }: { appliances: { id: string; name: string }[] }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const submit = (form: FormData) => {
    setError(null);
    const value = (key: string) => String(form.get(key) ?? "");
    startTransition(async () => {
      const result = toastResult(
        await reportIncident({
          title: value("title"),
          severity: value("severity") as "urgent",
          location: value("location"),
          applianceId: value("appliance"),
          description: value("description"),
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
      title="Report an issue"
      description="Something broke, leaks or needs fixing."
      trigger={
        <Button>
          <Plus size={16} aria-hidden="true" />
          Report an issue
        </Button>
      }
    >
      <form action={submit} className="flex flex-col gap-4">
        <Input name="title" label="What's wrong" placeholder="Kitchen tap drips" required autoComplete="off" />
        <Select name="severity" label="How urgent" defaultValue="soon">
          <option value="urgent">Urgent: fix it now</option>
          <option value="soon">Soon</option>
          <option value="whenever">Whenever</option>
        </Select>
        <Input name="location" label="Where" placeholder="Kitchen" autoComplete="off" />
        <Select name="appliance" label="Appliance" defaultValue="">
          <option value="">None</option>
          {appliances.map(({ id, name }) => (
            <option key={id} value={id}>
              {name}
            </option>
          ))}
        </Select>
        <Textarea name="description" label="Details" rows={3} />
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
            {pending ? "Saving…" : "Report"}
          </Button>
        </div>
      </form>
    </FormDialog>
  );
}
