"use client";

import { useRouter } from "next/navigation";

import { Input } from "@atlas/ui/components/input";
import { Select } from "@atlas/ui/components/select";
import { Textarea } from "@atlas/ui/components/textarea";

import { field, FormFooter, useSubmit } from "@/components/dialogs";
import { centsText } from "@/lib/inputs";
import type { Incident } from "@/lib/micasa/schemas";

import { saveIncidentAction } from "./actions";

type Option = { id: string; name: string };

/** An issue: reporting one, or `incident` to edit, with who fixed it, when and for how much. */
export function IncidentForm({ incident, appliances, vendors = [], currency, today }: { incident?: Incident; appliances: Option[]; vendors?: Option[]; currency: string; today: string }) {
  const router = useRouter();
  const { error, pending, submit } = useSubmit<{ id: string }>((data) => {
    if (!incident) router.push(`/incidents/${data.id}`);
  });
  const action = (form: FormData) =>
    submit(() =>
      saveIncidentAction(incident?.id ?? null, {
        title: field(form, "title"),
        severity: field(form, "severity") as "soon",
        status: field(form, "status") as "",
        location: field(form, "location"),
        applianceId: field(form, "appliance"),
        vendorId: field(form, "vendor"),
        noticed: field(form, "noticed"),
        resolved: field(form, "resolved"),
        cost: field(form, "cost"),
        description: field(form, "description"),
      }),
    );

  return (
    <form action={action} className="flex flex-col gap-4">
      <Input name="title" label="What's wrong" placeholder="Kitchen tap drips" defaultValue={incident?.title} required autoComplete="off" />
      <div className="grid gap-4 sm:grid-cols-2">
        <Select name="severity" label="How urgent" defaultValue={incident?.severity ?? "soon"}>
          <option value="urgent">Urgent: fix it now</option>
          <option value="soon">Soon</option>
          <option value="whenever">Whenever</option>
        </Select>
        {incident && (
          <Select name="status" label="Where it's at" defaultValue={incident.status}>
            <option value="open">Open</option>
            <option value="in_progress">Being fixed</option>
            <option value="resolved">Fixed</option>
          </Select>
        )}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Input name="location" label="Where" placeholder="Kitchen" defaultValue={incident?.location} autoComplete="off" />
        <Select name="appliance" label="Appliance" defaultValue={incident?.appliance_id ?? ""}>
          <option value="">None</option>
          {appliances.map(({ id, name }) => (
            <option key={id} value={id}>
              {name}
            </option>
          ))}
        </Select>
      </div>
      {incident && (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input name="noticed" type="date" label="Noticed" max={today} defaultValue={incident.date_noticed?.slice(0, 10)} />
            <Input name="resolved" type="date" label="Fixed on" max={today} defaultValue={incident.date_resolved?.slice(0, 10)} hint="Today, if it's fixed and you leave this empty." />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Select name="vendor" label="Fixed by" defaultValue={incident.vendor_id ?? ""}>
              <option value="">You, or nobody yet</option>
              {vendors.map(({ id, name }) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </Select>
            <Input name="cost" label="What it cost" inputMode="decimal" autoComplete="off" placeholder="0.00" hint={`In ${currency}.`} defaultValue={centsText(incident.cost_cents)} />
          </div>
        </>
      )}
      <Textarea name="description" label="Details" rows={3} defaultValue={incident?.description} />
      <FormFooter error={error} pending={pending} label={incident ? "Save" : "Report"} pendingLabel="Saving…" />
    </form>
  );
}
