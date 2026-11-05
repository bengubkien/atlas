"use client";

import { Pencil, Plus } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

import { BackLink } from "@atlas/ui/components/back-link";
import { Button } from "@atlas/ui/components/button";
import { ConfirmDialog } from "@atlas/ui/components/confirm-dialog";
import { FormDialog } from "@atlas/ui/components/form-dialog";
import { Input } from "@atlas/ui/components/input";
import { PageBody, PageHeader } from "@atlas/ui/components/page-header";
import { Panel, PanelEmpty, PanelList, PanelRow } from "@atlas/ui/components/panel";
import { Select } from "@atlas/ui/components/select";
import { Textarea } from "@atlas/ui/components/textarea";
import { toast } from "@atlas/ui/components/toast";
import { useNow } from "@atlas/ui/use-now";

import { Attachments } from "@/components/attachments";
import { Loading } from "@/components/loading";
import { dayOf } from "@/lib/health";
import { thisDevice } from "@/lib/local/device";
import { useAppointments } from "@/lib/local/hooks";
import { useFormat } from "@/lib/locale";
import { newId, type Appointment } from "@/lib/model";

export default function AppointmentsPage() {
  return (
    <Suspense fallback={<Loading />}>
      <Appointments />
    </Suspense>
  );
}

function Appointments() {
  const id = useSearchParams().get("a");
  const appointments = useAppointments();
  const f = useFormat();
  const now = useNow();
  if (!appointments) return <Loading />;
  if (id) {
    const appointment = appointments.find((each) => each.id === id);
    if (appointment) return <AppointmentView appointment={appointment} />;
    return (
      <>
        <PageHeader before={<BackLink href="/appointments" label="Appointments" />} title="Not here" />
        <PageBody>
          <p className="text-sm text-muted">
            That appointment isn&apos;t on this device. It may have been deleted. <Link href="/appointments">All appointments</Link>
          </p>
        </PageBody>
      </>
    );
  }

  const upcoming = appointments.filter((each) => each.at + each.minutes * 60_000 >= now);
  const past = appointments.filter((each) => each.at + each.minutes * 60_000 < now).reverse();
  const row = (appointment: Appointment) => (
    <PanelRow
      key={appointment.id}
      href={`/appointments?a=${appointment.id}`}
      title={appointment.title}
      meta={`${f.day(appointment.at)}, ${f.time(appointment.at)}`}
      detail={[appointment.with, appointment.place, appointment.notes].filter(Boolean).join(" · ") || undefined}
      aside={<AppointmentForm appointment={appointment} />}
    />
  );

  return (
    <>
      <PageHeader title="Appointments" description="Doctors, dentists, tests. Each one is in your calendar, with alerts the day before and two hours before." actions={<AppointmentForm />} />
      <PageBody className="max-w-[720px]">
        <Panel title="Coming up" count={upcoming.length}>
          {upcoming.length === 0 ? <PanelEmpty>Nothing booked.</PanelEmpty> : <PanelList>{upcoming.map(row)}</PanelList>}
        </Panel>
        {past.length > 0 && (
          <Panel title="Past" count={past.length}>
            <PanelList>{past.map(row)}</PanelList>
          </Panel>
        )}
      </PageBody>
    </>
  );
}

/** One appointment: when, with whom, where, its notes, and its documents (a referral, what they gave you). */
function AppointmentView({ appointment }: { appointment: Appointment }) {
  const f = useFormat();
  return (
    <>
      <PageHeader
        before={<BackLink href="/appointments" label="Appointments" />}
        title={appointment.title}
        description={[`${f.day(appointment.at)}, ${f.time(appointment.at)}`, appointment.with, appointment.place].filter(Boolean).join(" · ")}
        actions={<AppointmentForm appointment={appointment} />}
      />
      <PageBody className="max-w-[720px]">
        {appointment.notes && (
          <Panel title="Notes">
            <p className="border-t border-line px-4 py-4 text-sm whitespace-pre-line text-pretty lg:px-6">{appointment.notes}</p>
          </Panel>
        )}
        <Attachments owner="appointment" ownerId={appointment.id} empty="Attach a referral, a prescription, or what they gave you to take home." />
      </PageBody>
    </>
  );
}

const DURATIONS = [15, 30, 45, 60, 90, 120];

/** "New appointment", or edit one. */
function AppointmentForm({ appointment }: { appointment?: Appointment }) {
  const router = useRouter();
  const now = useNow();
  const [open, setOpen] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const when = appointment ? new Date(appointment.at) : null;
  const pad = (n: number) => String(n).padStart(2, "0");

  const save = async (form: FormData) => {
    const text = (key: string) => String(form.get(key) ?? "").trim();
    const at = new Date(`${text("date")}T${text("time") || "09:00"}`).getTime();
    if (!text("title")) return setError("Say what it is.");
    if (!Number.isFinite(at)) return setError("Pick the date and time.");
    const record: Appointment = {
      id: appointment?.id ?? newId(),
      updatedAt: 0,
      deleted: false,
      title: text("title").slice(0, 80),
      with: text("with").slice(0, 80),
      place: text("place").slice(0, 160),
      at,
      minutes: Number(text("minutes")) || 30,
      notes: text("notes").slice(0, 4000),
    };
    await thisDevice().put("appointment", record);
    setOpen(false);
    setError(null);
    toast(appointment ? "Saved." : "Booked.");
  };

  return (
    <>
      <FormDialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) setError(null);
        }}
        title={appointment ? "Edit appointment" : "New appointment"}
        trigger={
          appointment ? (
            <Button variant="text" size="sm" aria-label={`Edit ${appointment.title}`} className="px-2!">
              <Pencil size={15} aria-hidden="true" />
            </Button>
          ) : (
            <Button>
              <Plus size={16} aria-hidden="true" /> New appointment
            </Button>
          )
        }
      >
        <form action={save} className="flex flex-col gap-4">
          <Input name="title" label="What" defaultValue={appointment?.title} placeholder="Dentist check-up" required maxLength={80} autoComplete="off" />
          <div className="grid grid-cols-2 gap-3">
            <Input name="date" type="date" label="Date" defaultValue={when ? dayOf(when.getTime()) : dayOf(now + 86_400_000)} required />
            <Input name="time" type="time" label="Time" defaultValue={when ? `${pad(when.getHours())}:${pad(when.getMinutes())}` : "09:00"} required />
          </div>
          <div className="grid grid-cols-[minmax(0,1fr)_130px] gap-3">
            <Input name="with" label="With" defaultValue={appointment?.with} placeholder="Dr. Ruiz" maxLength={80} autoComplete="off" />
            <Select name="minutes" label="Takes" defaultValue={String(appointment?.minutes ?? 30)}>
              {DURATIONS.map((minutes) => (
                <option key={minutes} value={minutes}>
                  {minutes < 60 ? `${minutes} min` : `${minutes / 60} h`}
                </option>
              ))}
            </Select>
          </div>
          <Input name="place" label="Where" defaultValue={appointment?.place} maxLength={160} autoComplete="off" />
          <Textarea name="notes" label="Notes" rows={3} defaultValue={appointment?.notes} placeholder="What to ask, what to bring, what they said…" />
          {error && (
            <p role="alert" className="text-label text-error">
              {error}
            </p>
          )}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
            {appointment ? (
              <Button variant="danger-text" onClick={() => setRemoving(true)}>
                Delete appointment
              </Button>
            ) : (
              <span />
            )}
            <Button type="submit" size="lg">
              Save
            </Button>
          </div>
        </form>
      </FormDialog>
      {appointment && (
        <ConfirmDialog
          open={removing}
          onOpenChange={setRemoving}
          title="Delete this appointment?"
          description="It also leaves your calendar at its next update."
          confirmLabel="Delete"
          onConfirm={() => {
            setRemoving(false);
            setOpen(false);
            void thisDevice()
              .remove("appointment", [appointment.id])
              .then(() => {
                toast("Appointment deleted.");
                router.replace("/appointments");
              });
          }}
        />
      )}
    </>
  );
}
