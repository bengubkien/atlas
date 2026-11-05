"use client";

import { CalendarPlus, Pencil, Plus, X } from "lucide-react";
import { useEffect, useState } from "react";

import { Badge } from "@atlas/ui/components/badge";
import { Button, buttonClassName } from "@atlas/ui/components/button";
import { ConfirmDialog } from "@atlas/ui/components/confirm-dialog";
import { FormDialog } from "@atlas/ui/components/form-dialog";
import { Input } from "@atlas/ui/components/input";
import { PageBody, PageHeader } from "@atlas/ui/components/page-header";
import { Panel, PanelEmpty, PanelList, PanelRow } from "@atlas/ui/components/panel";
import { Textarea } from "@atlas/ui/components/textarea";
import { toast } from "@atlas/ui/components/toast";
import { ToggleChip } from "@atlas/ui/components/chip";
import { Toggle } from "@atlas/ui/components/toggle";

import { Loading } from "@/components/loading";
import { addDays, adherence, dayOf, scheduleDays, WEEK } from "@/lib/health";
import { thisDevice } from "@/lib/local/device";
import { useDoses, useMedications } from "@/lib/local/hooks";
import { useFormat } from "@/lib/locale";
import { newId, type Medication } from "@/lib/model";

export default function MedicationsPage() {
  const medications = useMedications();
  const doses = useDoses();
  const f = useFormat();
  if (!medications || !doses) return <Loading />;

  const today = dayOf(Date.now());
  const current = medications.filter((medication) => medication.endDate === null || medication.endDate >= today);
  const past = medications.filter((medication) => medication.endDate !== null && medication.endDate < today);
  const from = addDays(today, -29);

  return (
    <>
      <PageHeader title="Medications" description="What you take and when. Mark doses on Today; reminders come through your calendar." actions={<MedicationForm />} />
      <PageBody className="max-w-[720px]">
        <Panel title="Taking" count={current.length}>
          {current.length === 0 ? (
            <PanelEmpty>Nothing yet. Add what you take, with the times you take it.</PanelEmpty>
          ) : (
            <PanelList>
              {current.map((medication) => {
                const kept = adherence(medication, doses, medication.startDate > from ? medication.startDate : from, today);
                return (
                  <PanelRow
                    key={medication.id}
                    title={`${medication.name}${medication.dose ? ` · ${medication.dose}` : ""}`}
                    meta={medication.asNeeded ? "As needed" : `${scheduleDays(medication.days, f.weekdayName)} at ${medication.times.join(", ")}`}
                    detail={
                      kept.due > 0
                        ? `${kept.taken} of ${kept.due} doses taken ${
                            medication.startDate > from ? `since ${f.date(new Date(`${medication.startDate}T12:00`).getTime())}` : "in the last 30 days"
                          }${kept.skipped ? `, ${kept.skipped} skipped` : ""}`
                        : medication.startDate > today
                          ? `Starts ${f.date(new Date(`${medication.startDate}T12:00`).getTime())}`
                          : undefined
                    }
                    aside={
                      <>
                        {medication.endDate && <Badge>Until {f.date(new Date(`${medication.endDate}T12:00`).getTime())}</Badge>}
                        <MedicationForm medication={medication} />
                      </>
                    }
                  />
                );
              })}
            </PanelList>
          )}
        </Panel>

        <CalendarPanel />

        {past.length > 0 && (
          <Panel title="Stopped" count={past.length}>
            <PanelList>
              {past.map((medication) => (
                <PanelRow
                  key={medication.id}
                  title={`${medication.name}${medication.dose ? ` · ${medication.dose}` : ""}`}
                  meta={`Until ${f.date(new Date(`${medication.endDate}T12:00`).getTime())}`}
                  aside={<MedicationForm medication={medication} />}
                />
              ))}
            </PanelList>
          </Panel>
        )}
      </PageBody>
    </>
  );
}

/** How to get reminders: subscribe the phone's calendar to this server's feed. */
function CalendarPanel() {
  const [host, setHost] = useState("");
  useEffect(() => setHost(window.location.host), []);
  const feed = `${host}/calendar.ics`;
  return (
    <Panel title="Reminders">
      <div className="flex flex-col gap-3 border-t border-line px-4 py-4 text-sm text-pretty lg:px-6">
        <p className="text-muted">
          Subscribe your phone&apos;s calendar to Hygeia: each dose and appointment shows as an event with an alert. Your phone keeps the events, so
          reminders ring even while the server is off; it checks for changes every few hours.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <a href={`webcal://${feed}`} className={buttonClassName("secondary")}>
            <CalendarPlus size={15} aria-hidden="true" /> Subscribe on this device
          </a>
          <Button
            variant="text"
            onClick={() =>
              void navigator.clipboard
                .writeText(`https://${feed}`)
                .then(() => toast("Address copied."))
                .catch(() => toast(`The address: https://${feed}`))
            }
          >
            Copy the address
          </Button>
        </div>
        <p className="text-meta text-muted">
          On an iPhone, open this page in Safari and tap Subscribe. On Android, add the address in Google Calendar on a computer: Other calendars → From URL.
          Tailscale has to be on for the calendar to reach it.
        </p>
      </div>
    </Panel>
  );
}

/** "New medication", or edit one: name, dose, the times, as needed, the dates. */
function MedicationForm({ medication }: { medication?: Medication }) {
  const [open, setOpen] = useState(false);
  const [times, setTimes] = useState<string[]>(medication?.times.length ? medication.times : ["08:00"]);
  const [asNeeded, setAsNeeded] = useState(medication?.asNeeded ?? false);
  const [days, setDays] = useState<number[]>(medication?.days ?? []);
  const f = useFormat();
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async (form: FormData) => {
    const text = (key: string) => String(form.get(key) ?? "").trim();
    const startDate = text("startDate");
    const endDate = text("endDate") || null;
    const cleanTimes = [...new Set(times.filter(Boolean))].sort();
    if (!text("name")) return setError("Give it a name.");
    if (!asNeeded && cleanTimes.length === 0) return setError("Add a time, or make it as needed.");
    if (endDate && endDate < startDate) return setError("It can't end before it starts.");
    const record: Medication = {
      id: medication?.id ?? newId(),
      updatedAt: 0,
      deleted: false,
      name: text("name").slice(0, 80),
      dose: text("dose").slice(0, 60),
      times: asNeeded ? [] : cleanTimes.slice(0, 8),
      asNeeded,
      // All seven is every day.
      days: asNeeded || days.length === 7 ? [] : [...days].sort(),
      startDate,
      endDate,
      notes: text("notes").slice(0, 2000),
    };
    await thisDevice().put("medication", record);
    setOpen(false);
    setError(null);
    toast(medication ? "Saved." : `Added ${record.name}.`);
  };

  return (
    <>
      <FormDialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) setError(null);
        }}
        title={medication ? `Edit ${medication.name}` : "New medication"}
        trigger={
          medication ? (
            <Button variant="text" size="sm" aria-label={`Edit ${medication.name}`} className="px-2!">
              <Pencil size={15} aria-hidden="true" />
            </Button>
          ) : (
            <Button>
              <Plus size={16} aria-hidden="true" /> New medication
            </Button>
          )
        }
      >
        <form action={save} className="flex flex-col gap-4">
          <div className="grid grid-cols-[minmax(0,1fr)_140px] gap-3">
            <Input name="name" label="Name" defaultValue={medication?.name} required maxLength={80} autoComplete="off" />
            <Input name="dose" label="Dose" defaultValue={medication?.dose} maxLength={60} placeholder="10 mg" autoComplete="off" />
          </div>
          <Toggle label="As needed" description="No set times: note each dose when you take it." checked={asNeeded} onCheckedChange={setAsNeeded} />
          {!asNeeded && (
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-1 text-label font-medium">On</legend>
              <div className="mb-2 flex flex-wrap gap-1.5" role="group" aria-label="Days of the week">
                <ToggleChip selected={days.length === 0} onClick={() => setDays([])}>
                  Every day
                </ToggleChip>
                {WEEK.map((day) => (
                  <ToggleChip
                    key={day}
                    selected={days.includes(day)}
                    onClick={() => setDays(days.includes(day) ? days.filter((each) => each !== day) : [...days, day])}
                  >
                    {f.weekdayName(day)}
                  </ToggleChip>
                ))}
              </div>
              <span className="text-label font-medium">At</span>
              {times.map((time, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Input
                    type="time"
                    aria-label={`Time ${i + 1}`}
                    value={time}
                    onChange={(event) => setTimes(times.map((each, j) => (j === i ? event.target.value : each)))}
                    className="flex-1"
                    required
                  />
                  {times.length > 1 && (
                    <button type="button" onClick={() => setTimes(times.filter((_, j) => j !== i))} aria-label={`Remove time ${i + 1}`} className="grid size-10 place-items-center rounded-control text-muted hover:bg-hover hover:text-ink">
                      <X size={16} aria-hidden="true" />
                    </button>
                  )}
                </div>
              ))}
              {times.length < 8 && (
                <Button variant="text" size="sm" onClick={() => setTimes([...times, "20:00"])} className="self-start">
                  <Plus size={14} aria-hidden="true" /> Another time
                </Button>
              )}
            </fieldset>
          )}
          <div className="grid grid-cols-2 gap-3">
            <Input name="startDate" type="date" label="From" defaultValue={medication?.startDate ?? dayOf(Date.now())} required />
            <Input name="endDate" type="date" label="Until" defaultValue={medication?.endDate ?? ""} hint="Empty: no end." />
          </div>
          <Textarea name="notes" label="Notes" rows={2} defaultValue={medication?.notes} placeholder="With food, prescribed by…" />
          {error && (
            <p role="alert" className="text-label text-error">
              {error}
            </p>
          )}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
            {medication ? (
              <Button variant="danger-text" onClick={() => setRemoving(true)}>
                Delete medication
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
      {medication && (
        <ConfirmDialog
          open={removing}
          onOpenChange={setRemoving}
          title={`Delete ${medication.name}?`}
          description="Its doses so far are kept in the records; it leaves Today and your calendar. To keep it in the list, set an end date instead."
          confirmLabel="Delete"
          onConfirm={() => {
            setRemoving(false);
            setOpen(false);
            void thisDevice().remove("medication", [medication.id]).then(() => toast(`${medication.name} deleted.`));
          }}
        />
      )}
    </>
  );
}
