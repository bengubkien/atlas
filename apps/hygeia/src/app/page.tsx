"use client";

import { ChevronRight, PersonStanding, Undo2 } from "lucide-react";
import Link from "next/link";

import { Badge } from "@atlas/ui/components/badge";
import { Button } from "@atlas/ui/components/button";
import { PageBody, PageHeader } from "@atlas/ui/components/page-header";
import { Panel, PanelEmpty, PanelList, PanelRow } from "@atlas/ui/components/panel";
import { toast } from "@atlas/ui/components/toast";
import { useNow } from "@atlas/ui/use-now";

import { FeelingPicker } from "@/components/feeling";
import { Loading } from "@/components/loading";
import { ReadingDialog } from "@/components/reading-dialog";
import { SyncStatus } from "@/components/sync-status";
import { logAsNeeded, saveJournal, skipDose, takeDose, undoDose } from "@/lib/actions";
import { activeOn, dayOf, latestWithChange, readingsOf, slotsFor } from "@/lib/health";
import { useAppointments, useDoses, useJournal, useMeasurements, useMeasures, useMedications, useSettings } from "@/lib/local/hooks";
import { useFormat } from "@/lib/locale";
import { display, readingText } from "@/lib/measures";

export default function TodayPage() {
  const medications = useMedications();
  const doses = useDoses();
  const measures = useMeasures();
  const measurements = useMeasurements();
  const journal = useJournal();
  const appointments = useAppointments();
  const settings = useSettings();
  const f = useFormat();
  const now = useNow();
  if (!medications || !doses || !measures || !measurements || !journal || !appointments) return <Loading />;

  const today = dayOf(now);
  const slots = slotsFor(today, medications, doses);
  const asNeeded = medications.filter((medication) => medication.asNeeded && activeOn(medication, today));
  const takenAsNeeded = doses.filter((dose) => dose.date === today && dose.time === "" && dose.takenAt);
  const pinned = measures.filter((measure) => measure.pinned);
  const entry = journal.find((each) => each.date === today);
  const next = appointments.find((appointment) => appointment.at >= now - 3_600_000);
  const left = slots.filter((slot) => !slot.dose).length;

  return (
    <>
      <PageHeader
        title="Today"
        description={`${new Intl.DateTimeFormat(f.locale, { weekday: "long", day: "numeric", month: "long" }).format(now)}${
          slots.length ? ` · ${left === 0 ? "every dose done" : `${left} ${left === 1 ? "dose" : "doses"} to go`}` : ""
        }`}
      />
      <PageBody className="max-w-[720px]">
        <Panel title="Medications" count={slots.length || undefined} action={<Link href="/medications" className="text-meta text-muted hover:text-ink">All</Link>}>
          {slots.length === 0 && asNeeded.length === 0 ? (
            <PanelEmpty>
              Nothing to take. <Link href="/medications">Add a medication</Link> to see its doses here, and get reminders in your calendar.
            </PanelEmpty>
          ) : (
            <PanelList>
              {slots.map((slot) => (
                <PanelRow
                  key={slot.id}
                  title={`${slot.time} · ${slot.medication.name}`}
                  meta={slot.medication.dose || undefined}
                  aside={
                    slot.dose ? (
                      <>
                        <Badge tone={slot.dose.takenAt ? "success" : "neutral"}>
                          {slot.dose.takenAt ? `Taken ${f.time(slot.dose.takenAt)}` : "Skipped"}
                        </Badge>
                        <button
                          type="button"
                          onClick={() => void undoDose(slot)}
                          aria-label={`Undo: ${slot.medication.name} at ${slot.time}`}
                          className="grid size-9 place-items-center rounded-control text-muted hover:bg-hover hover:text-ink"
                        >
                          <Undo2 size={16} aria-hidden="true" />
                        </button>
                      </>
                    ) : (
                      <>
                        <Button variant="text" size="sm" onClick={() => void skipDose(slot, today)} aria-label={`Skip ${slot.medication.name} at ${slot.time}`}>
                          Skip
                        </Button>
                        <Button size="sm" onClick={() => void takeDose(slot, today)} aria-label={`Take ${slot.medication.name} at ${slot.time}`}>
                          Take
                        </Button>
                      </>
                    )
                  }
                />
              ))}
              {asNeeded.map((medication) => {
                const taken = takenAsNeeded.filter((dose) => dose.medicationId === medication.id);
                return (
                  <PanelRow
                    key={medication.id}
                    title={`As needed · ${medication.name}`}
                    meta={taken.length ? `Taken today at ${taken.map((dose) => f.time(dose.takenAt!)).join(", ")}` : medication.dose || undefined}
                    aside={
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => void logAsNeeded(medication, today).then(() => toast(`${medication.name} noted.`))}
                        aria-label={`Took ${medication.name} now`}
                      >
                        Took one
                      </Button>
                    }
                  />
                );
              })}
            </PanelList>
          )}
        </Panel>

        <Panel title="How you feel" action={<Link href="/journal" className="text-meta text-muted hover:text-ink">Journal</Link>}>
          <div className="flex flex-col gap-3 border-t border-line px-4 py-4 lg:px-6">
            <FeelingPicker value={entry?.feeling ?? null} onChange={(feeling) => void saveJournal(today, { feeling })} />
            <Link href="/journal" className="flex items-center gap-1 text-meta text-muted hover:text-ink">
              {entry?.symptoms.length || entry?.note ? `${entry.symptoms.join(", ")}${entry.symptoms.length && entry.note ? " · " : ""}${entry.note.slice(0, 60)}` : "Add symptoms or a note"}
              <ChevronRight size={14} aria-hidden="true" />
            </Link>
          </div>
        </Panel>

        <Panel title="Readings" action={<Link href="/measurements" className="text-meta text-muted hover:text-ink">All</Link>}>
          <PanelList>
            {pinned.map((measure) => {
              const latest = latestWithChange(readingsOf(measure.id, measurements));
              const shown = display(measure, settings);
              const change = latest?.change != null ? shown.toShown(latest.latest.value) - shown.toShown(latest.latest.value - latest.change) : null;
              return (
                <PanelRow
                  key={measure.id}
                  href={`/measurements?m=${measure.id}`}
                  title={measure.name}
                  meta={latest ? `${readingText(measure, latest.latest, settings, f.locale)} · ${f.day(latest.latest.at)}` : "No reading yet"}
                  detail={
                    change !== null && Math.abs(change) >= 10 ** -shown.decimals
                      ? `${change > 0 ? "+" : "−"}${f.number(Math.abs(change), shown.decimals)} ${shown.unit} in a week`
                      : undefined
                  }
                  aside={<ReadingDialog measure={measure} />}
                />
              );
            })}
          </PanelList>
        </Panel>

        {next && (
          <Panel title="Next appointment" action={<Link href="/appointments" className="text-meta text-muted hover:text-ink">All</Link>}>
            <PanelList>
              <PanelRow
                href="/appointments"
                title={next.title}
                meta={`${f.day(next.at)}, ${f.time(next.at)}`}
                detail={[next.with, next.place].filter(Boolean).join(" · ") || undefined}
              />
            </PanelList>
          </Panel>
        )}

        <Link
          href="/body"
          className="flex min-h-14 items-center gap-3 rounded-panel border border-line-card bg-card px-4 py-3 text-ink hover:border-line-strong hover:text-ink lg:px-6"
        >
          <PersonStanding size={18} aria-hidden="true" className="shrink-0 text-muted" />
          <span className="flex-1 text-sm text-pretty">Something hurting or itching? Show where on the body map.</span>
          <ChevronRight size={16} aria-hidden="true" className="shrink-0 text-faint" />
        </Link>

        <SyncStatus className="px-1" />
      </PageBody>
    </>
  );
}
