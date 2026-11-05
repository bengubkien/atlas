"use client";

import { useRouter } from "next/navigation";

import { Input } from "@atlas/ui/components/input";
import { Select } from "@atlas/ui/components/select";
import { Textarea } from "@atlas/ui/components/textarea";

import { field, FormFooter, useSubmit } from "@/components/dialogs";
import { centsText } from "@/lib/inputs";
import type { Project } from "@/lib/micasa/schemas";

import { saveProjectAction } from "./actions";

/** A project's form: a new one (an idea, then its page opens), or `project` to edit, with what it cost and its dates. */
export function ProjectForm({ project, types, currency }: { project?: Project; types: { id: string; name: string }[]; currency: string }) {
  const router = useRouter();
  const { error, pending, submit } = useSubmit<{ id: string }>((data) => {
    if (!project) router.push(`/projects/${data.id}`);
  });
  const action = (form: FormData) =>
    submit(() =>
      saveProjectAction(project?.id ?? null, {
        title: field(form, "title"),
        typeId: field(form, "type"),
        budget: field(form, "budget"),
        spent: field(form, "spent"),
        start: field(form, "start"),
        end: field(form, "end"),
        description: field(form, "description"),
      }),
    );

  return (
    <form action={action} className="flex flex-col gap-4">
      <Input name="title" label="What" placeholder="Redo the back deck" defaultValue={project?.title} required autoComplete="off" />
      <Select name="type" label="Type" required defaultValue={project?.project_type_id ?? ""}>
        <option value="" disabled>
          Pick one
        </option>
        {types.map(({ id, name }) => (
          <option key={id} value={id}>
            {name}
          </option>
        ))}
      </Select>
      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          name="budget"
          label="Budget"
          inputMode="decimal"
          autoComplete="off"
          placeholder="0"
          hint={`In ${currency}, if you have one in mind.`}
          defaultValue={centsText(project?.budget_cents)}
        />
        {project && <Input name="spent" label="What it cost" inputMode="decimal" autoComplete="off" placeholder="0" hint="So far, or in the end." defaultValue={centsText(project.actual_cents)} />}
      </div>
      {project && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Input name="start" type="date" label="Started" defaultValue={project.start_date?.slice(0, 10)} />
          <Input name="end" type="date" label="Finished" defaultValue={project.end_date?.slice(0, 10)} />
        </div>
      )}
      <Textarea name="description" label="Description" rows={3} defaultValue={project?.description} />
      <FormFooter error={error} pending={pending} label={project ? "Save" : "Add project"} pendingLabel={project ? "Saving…" : "Adding…"} />
    </form>
  );
}
