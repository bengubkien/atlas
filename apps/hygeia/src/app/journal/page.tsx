"use client";

import { X } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

import { BarList } from "@atlas/ui/components/charts";
import { PageBody, PageHeader } from "@atlas/ui/components/page-header";
import { Panel, PanelEmpty, PanelList, PanelRow } from "@atlas/ui/components/panel";

import { FeelingLabel, FeelingPicker } from "@/components/feeling";
import { Loading } from "@/components/loading";
import { saveJournal } from "@/lib/actions";
import { addDays, dayOf, symptomCounts } from "@/lib/health";
import { useJournal } from "@/lib/local/hooks";
import { useFormat } from "@/lib/locale";
import type { JournalEntry } from "@/lib/model";

export default function JournalPage() {
  return (
    <Suspense fallback={<Loading />}>
      <Journal />
    </Suspense>
  );
}

const noon = (date: string) => new Date(`${date}T12:00`).getTime();

function Journal() {
  const asked = useSearchParams().get("d");
  const journal = useJournal();
  const f = useFormat();
  if (!journal) return <Loading />;

  const today = dayOf(Date.now());
  const date = asked && /^\d{4}-\d{2}-\d{2}$/.test(asked) && asked <= today ? asked : today;
  const entry = journal.find((each) => each.date === date);
  const past = journal.filter((each) => each.date !== date);
  const known = [...new Set(journal.flatMap((each) => each.symptoms))].sort((a, b) => a.localeCompare(b));
  const counts = symptomCounts(journal, addDays(today, -29), today);

  return (
    <>
      <PageHeader
        title="Journal"
        description={date === today ? "How today went: one entry a day, as short as you like." : `Editing ${new Intl.DateTimeFormat(f.locale, { weekday: "long", day: "numeric", month: "long" }).format(noon(date))}.`}
      />
      <PageBody className="max-w-[720px]">
        <Editor key={date} date={date} entry={entry} known={known} label={date === today ? "Today" : f.day(noon(date))} />
        {date !== today && (
          <Link href="/journal" className="text-meta text-muted hover:text-ink">
            ← Back to today
          </Link>
        )}
        {counts.length > 0 && (
          <BarList
            title="Symptoms"
            description="On how many days you wrote each, in the last 30."
            rows={counts.slice(0, 10).map((each) => ({ key: each.symptom, label: each.symptom, value: each.days }))}
            format={(value) => `${value} ${value === 1 ? "day" : "days"}`}
          />
        )}
        <Panel title="Earlier" count={past.length || undefined}>
          {past.length === 0 ? (
            <PanelEmpty>Your entries from other days show here.</PanelEmpty>
          ) : (
            <PanelList>
              {past.map((each) => (
                <PanelRow
                  key={each.id}
                  href={`/journal?d=${each.date}`}
                  title={f.day(noon(each.date))}
                  meta={
                    <span className="inline-flex items-center gap-2">
                      <FeelingLabel value={each.feeling} />
                      {each.symptoms.length > 0 && <span>{each.symptoms.join(", ")}</span>}
                    </span>
                  }
                  detail={each.note || undefined}
                />
              ))}
            </PanelList>
          )}
        </Panel>
      </PageBody>
    </>
  );
}

/** One day's entry, saved as you go. */
function Editor({ date, entry, known, label }: { date: string; entry: JournalEntry | undefined; known: string[]; label: string }) {
  const [symptom, setSymptom] = useState("");
  const [note, setNote] = useState(entry?.note ?? "");
  const symptoms = entry?.symptoms ?? [];

  const addSymptom = (value: string) => {
    const clean = value.trim().slice(0, 40);
    if (!clean || symptoms.some((each) => each.toLowerCase() === clean.toLowerCase()) || symptoms.length >= 20) return setSymptom("");
    void saveJournal(date, { symptoms: [...symptoms, clean] });
    setSymptom("");
  };

  return (
    <section aria-label={`Entry for ${label}`} className="flex flex-col gap-5 rounded-panel border border-line-card bg-card p-4 lg:p-6">
      <div className="flex flex-col gap-2">
        <h2 className="font-serif text-[22px] leading-tight">{label}</h2>
        <FeelingPicker value={entry?.feeling ?? null} onChange={(feeling) => void saveJournal(date, { feeling })} />
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="symptom" className="text-label font-medium">
          Symptoms
        </label>
        {symptoms.length > 0 && (
          <ul className="flex flex-wrap gap-1.5">
            {symptoms.map((each) => (
              <li key={each}>
                <button
                  type="button"
                  onClick={() => void saveJournal(date, { symptoms: symptoms.filter((other) => other !== each) })}
                  aria-label={`Remove ${each}`}
                  className="flex items-center gap-1 rounded-full border border-line-field bg-input py-1 pr-2 pl-3 text-control hover:border-line-strong"
                >
                  {each} <X size={13} aria-hidden="true" className="text-muted" />
                </button>
              </li>
            ))}
          </ul>
        )}
        <form
          className="flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            addSymptom(symptom);
          }}
        >
          <input
            id="symptom"
            list="known-symptoms"
            value={symptom}
            onChange={(event) => setSymptom(event.target.value)}
            onBlur={() => symptom.trim() && addSymptom(symptom)}
            placeholder="Headache, cough… then Enter"
            autoComplete="off"
            enterKeyHint="done"
            className="h-11 min-w-0 flex-1 rounded-control border border-line-input bg-input px-3 text-field shadow-control focus:border-primary"
          />
          <datalist id="known-symptoms">
            {known.map((each) => (
              <option key={each} value={each} />
            ))}
          </datalist>
        </form>
      </div>

      <label className="flex flex-col gap-2">
        <span className="text-label font-medium">Note</span>
        <textarea
          value={note}
          onChange={(event) => setNote(event.target.value)}
          onBlur={() => note !== (entry?.note ?? "") && void saveJournal(date, { note: note.slice(0, 4000) })}
          rows={4}
          placeholder="Anything worth remembering: sleep, food, stress, what helped."
          className="resize-y rounded-control border border-line-input bg-input px-3 py-[11px] text-field leading-[1.6] shadow-control focus:border-primary"
        />
        <span className="text-label text-muted">Saved when you leave the field.</span>
      </label>
    </section>
  );
}
