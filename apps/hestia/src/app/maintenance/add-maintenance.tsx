"use client";

import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@atlas/ui/components/button";
import { FormDialog } from "@atlas/ui/components/form-dialog";
import { Input } from "@atlas/ui/components/input";
import { Select } from "@atlas/ui/components/select";
import { Textarea } from "@atlas/ui/components/textarea";
import { toastResult } from "@atlas/ui/components/toast";

import { addMaintenanceAction } from "./actions";

type Option = { id: string; name: string };

/** "Add item": a new recurring (or one-off) maintenance task. */
export function AddMaintenance({ categories, appliances }: { categories: Option[]; appliances: Option[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [once, setOnce] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const submit = (form: FormData) => {
    setError(null);
    const value = (key: string) => String(form.get(key) ?? "");
    startTransition(async () => {
      const result = toastResult(
        await addMaintenanceAction({
          name: value("name"),
          categoryId: value("category"),
          every: once ? "" : value("every"),
          dueDate: once ? value("dueDate") : "",
          applianceId: value("appliance"),
          season: value("season") as "",
          notes: value("notes"),
        }),
      );
      if (result.ok) {
        setOpen(false);
        router.push(`/maintenance/${result.data.id}`);
      } else {
        setError(result.error);
      }
    });
  };

  return (
    <FormDialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setError(null);
      }}
      title="Add a maintenance item"
      description="Something to do every so often, or once."
      trigger={
        <Button>
          <Plus size={16} aria-hidden="true" />
          Add item
        </Button>
      }
    >
      <form action={submit} className="flex flex-col gap-4">
        <Input name="name" label="What" placeholder="Replace the furnace filter" required autoComplete="off" />
        <Select name="category" label="Category" required defaultValue="">
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
            <Input name="dueDate" type="date" aria-label="Due date" required />
          ) : (
            <Input name="every" type="number" min={1} max={120} inputMode="numeric" aria-label="Every how many months" placeholder="12" hint="Every how many months." required />
          )}
        </fieldset>
        <Select name="appliance" label="Appliance" defaultValue="" hint="If it's for one.">
          <option value="">None</option>
          {appliances.map(({ id, name }) => (
            <option key={id} value={id}>
              {name}
            </option>
          ))}
        </Select>
        <Select name="season" label="Best season" defaultValue="">
          <option value="">Any time</option>
          <option value="spring">Spring</option>
          <option value="summer">Summer</option>
          <option value="fall">Fall</option>
          <option value="winter">Winter</option>
        </Select>
        <Textarea name="notes" label="Notes" rows={2} />
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
            {pending ? "Adding…" : "Add item"}
          </Button>
        </div>
      </form>
    </FormDialog>
  );
}
