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

import { addProjectAction } from "./actions";

/** "New project": starts as an idea, to plan, quote and do later. */
export function AddProject({ types, currency }: { types: { id: string; name: string }[]; currency: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const submit = (form: FormData) => {
    setError(null);
    const value = (key: string) => String(form.get(key) ?? "");
    startTransition(async () => {
      const result = toastResult(
        await addProjectAction({ title: value("title"), typeId: value("type"), budget: value("budget"), description: value("description") }),
      );
      if (result.ok) {
        setOpen(false);
        router.push(`/projects/${result.data.id}`);
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
      title="New project"
      description="It starts as an idea; move it along as you plan, get quotes and start."
      trigger={
        <Button>
          <Plus size={16} aria-hidden="true" />
          New project
        </Button>
      }
    >
      <form action={submit} className="flex flex-col gap-4">
        <Input name="title" label="What" placeholder="Redo the back deck" required autoComplete="off" />
        <Select name="type" label="Type" required defaultValue="">
          <option value="" disabled>
            Pick one
          </option>
          {types.map(({ id, name }) => (
            <option key={id} value={id}>
              {name}
            </option>
          ))}
        </Select>
        <Input name="budget" label="Budget" inputMode="decimal" autoComplete="off" placeholder="0" hint={`In ${currency}, if you have one in mind.`} />
        <Textarea name="description" label="Description" rows={3} />
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
            {pending ? "Adding…" : "Add project"}
          </Button>
        </div>
      </form>
    </FormDialog>
  );
}
