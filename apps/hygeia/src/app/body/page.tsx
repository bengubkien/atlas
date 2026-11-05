"use client";

import { X } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";

import { areaFacing, areaName, AREAS, areasFor, isArea, type Area } from "@atlas/body/areas";
import { BodyView, type Facing } from "@atlas/body/body-view";
import { useCssColors } from "@atlas/body/css-colors";
import { Button } from "@atlas/ui/components/button";
import { ToggleChip } from "@atlas/ui/components/chip";
import { PageBody, PageHeader } from "@atlas/ui/components/page-header";
import { Panel, PanelEmpty, PanelList } from "@atlas/ui/components/panel";
import { SegmentedControl } from "@atlas/ui/components/segmented-control";
import { Select } from "@atlas/ui/components/select";
import { Textarea } from "@atlas/ui/components/textarea";
import { toast } from "@atlas/ui/components/toast";

import { Loading } from "@/components/loading";
import { deleteSymptom, logSymptom } from "@/lib/actions";
import { DAY_STEPS, dayStep, describe, KIND_LABELS, places, recent, WINDOW_DAYS, type Place } from "@/lib/body";
import { useSettings, useSymptoms } from "@/lib/local/hooks";
import { useFormat } from "@/lib/locale";
import { SYMPTOM_KINDS, type Symptom, type SymptomKind } from "@/lib/model";

// The body map: the body, each place shaded by how many of the last 30 days
// you felt something there. Tap a place (on the body, or pick it from the
// list beside it, which says the same in words) to see what you logged there
// and to log something now. The picked place is in the address (?a=knee-left),
// like Hygeia's other detail views, so the one offline page covers them all.

const FACINGS = [
  { value: "front", label: "Front" },
  { value: "back", label: "Back" },
] as const;

const COLORS = {
  figure: "--color-body",
  outline: "--color-body-line",
  s1: "--color-body-hygeia-1",
  s2: "--color-body-hygeia-2",
  s3: "--color-body-hygeia-3",
  s4: "--color-body-hygeia-4",
} as const;

/** The CSS colour of a step, for swatches: the figure's own for 0. */
const stepColor = (step: number) => (step > 0 ? `var(--color-body-hygeia-${step})` : "var(--color-body)");

const plural = (n: number, one: string) => `${n} ${n === 1 ? one : `${one}s`}`;

export default function BodyPage() {
  return (
    <Suspense fallback={<Loading />}>
      <BodyMap />
    </Suspense>
  );
}

function BodyMap() {
  const router = useRouter();
  const param = useSearchParams().get("a");
  const selected = isArea(param) ? param : null;
  const symptoms = useSymptoms();
  const settings = useSettings();
  const [facing, setFacing] = useState<Facing>(selected ? areaFacing(selected) : "front");
  const colors = useCssColors(COLORS);
  const detail = useRef<HTMLDivElement>(null);
  const f = useFormat();

  // On a phone the details sit under the body: bring them into view when a place is picked there.
  useEffect(() => {
    const box = detail.current?.getBoundingClientRect();
    if (selected && box && box.top > window.innerHeight - 80) detail.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [selected]);

  if (!symptoms) return <Loading />;

  const byArea = places(symptoms);
  const lately = recent(byArea);
  const shades = colors
    ? Object.fromEntries(
        [...byArea.values()].flatMap((place) => {
          const step = dayStep(place.days);
          return step > 0 ? [[place.area, colors[`s${step}` as "s1"]]] : [];
        }),
      )
    : {};
  const pick = (area: Area | null, turn = false) => {
    if (area && turn) setFacing(areaFacing(area));
    router.replace(area ? `/body?a=${area}` : "/body", { scroll: false });
  };

  return (
    <>
      <PageHeader
        title="Body"
        description={
          lately.length
            ? `Where you've felt something in the last ${WINDOW_DAYS} days. Tap a place to see it, or to log what you feel there now.`
            : "Tap where you feel something, on the body or from the list, to log it there."
        }
      />
      <PageBody className="max-w-[1120px] lg:grid lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start">
        <section aria-label="Body" className="flex min-w-0 flex-col rounded-panel border border-line-card bg-card">
          <div className="flex flex-wrap items-center justify-between gap-2 px-4 pt-4 lg:px-5">
            <span className="text-meta text-muted">Last {WINDOW_DAYS} days</span>
            <SegmentedControl size="sm" aria-label="Show the" options={FACINGS} value={facing} onValueChange={setFacing} />
          </div>
          {colors ? (
            <BodyView
              className="h-[460px] w-full lg:h-[600px]"
              sex={settings.body}
              parts={areasFor}
              shades={shades}
              colors={{ figure: colors.figure, outline: colors.outline }}
              selected={selected}
              onSelect={(area) => pick(area)}
              facing={facing}
              onTurn={setFacing}
              label={`A body, each place shaded by how many of the last ${WINDOW_DAYS} days you felt something there`}
              fallback={<p className="p-6 text-sm text-muted">This device can&rsquo;t draw the 3D body. Pick a place from the list instead.</p>}
            />
          ) : (
            <div className="h-[460px] lg:h-[600px]" />
          )}
          <ul aria-label="What the shades mean: days with something there" className="flex flex-wrap gap-x-4 gap-y-1.5 border-t border-line px-4 py-3 text-meta text-muted lg:px-5">
            {DAY_STEPS.map((step, index) => (
              <li key={step.label} className="flex items-center gap-1.5">
                <span aria-hidden="true" className="size-3 rounded-[3px] border border-line-field" style={{ backgroundColor: stepColor(index) }} />
                {step.label}
              </li>
            ))}
          </ul>
        </section>

        <div className="flex min-w-0 flex-col gap-4">
          <div ref={detail} className="scroll-mt-4">
            {/* Keyed by place, so the form starts afresh from each place's own latest entry. */}
            {selected && <PlaceDetail key={selected} place={byArea.get(selected)!} symptoms={symptoms.filter((s) => s.area === selected)} onClose={() => pick(null)} />}
          </div>
          <Select
            label="Or pick a place"
            value={selected ?? ""}
            onChange={(event) => pick(isArea(event.target.value) ? event.target.value : null, true)}
          >
            <option value="">Choose…</option>
            {AREAS.map((area) => (
              <option key={area} value={area}>
                {areaName(area)}
              </option>
            ))}
          </Select>
          <Panel title="Lately" count={lately.length || undefined}>
            {lately.length === 0 ? (
              <PanelEmpty>Nothing in the last {WINDOW_DAYS} days.</PanelEmpty>
            ) : (
              <PanelList>
                {lately.map((place) => (
                  <li key={place.area}>
                    <button
                      type="button"
                      aria-pressed={selected === place.area}
                      onClick={() => pick(selected === place.area ? null : place.area, true)}
                      className="flex min-h-12 w-full items-center gap-3 px-4 py-2 text-left hover:bg-hover aria-pressed:bg-selected lg:px-6"
                    >
                      <span aria-hidden="true" className="size-3.5 shrink-0 rounded-[4px] border border-line-field" style={{ backgroundColor: stepColor(dayStep(place.days)) }} />
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate text-sm font-medium">{areaName(place.area)}</span>
                        {place.last && <span className="truncate text-meta text-muted">{`${describe(place.last)}, ${f.day(place.last.at)}`}</span>}
                      </span>
                      <span className="text-meta text-muted tabular-nums">{plural(place.days, "day")}</span>
                    </button>
                  </li>
                ))}
              </PanelList>
            )}
          </Panel>
        </div>
      </PageBody>
    </>
  );
}

function PlaceDetail({ place, symptoms, onClose }: { place: Place; symptoms: Symptom[]; onClose: () => void }) {
  const f = useFormat();
  const [kind, setKind] = useState<SymptomKind>(place.last?.kind ?? "pain");
  const [severity, setSeverity] = useState(place.last?.severity ?? 3);
  const [note, setNote] = useState("");
  const name = areaName(place.area);

  const log = async () => {
    await logSymptom({ area: place.area, kind, severity, note: note.trim() });
    setNote("");
    toast(`${name}: ${describe({ kind, severity }).toLowerCase()}, logged.`);
  };

  return (
    <Panel
      title={name}
      action={
        <button type="button" onClick={onClose} aria-label="Close" title="Close" className="grid size-8 place-items-center rounded-control text-muted hover:bg-hover hover:text-ink">
          <X size={16} aria-hidden="true" />
        </button>
      }
    >
      <p className="-mt-1 px-4 pb-3 text-meta text-muted lg:px-6">
        {place.days ? `${plural(place.days, "day")} in the last ${WINDOW_DAYS}, the worst ${place.worst} of 10` : `Nothing in the last ${WINDOW_DAYS} days`}
      </p>
      <form
        className="flex flex-col gap-4 border-t border-line px-4 py-4 lg:px-6"
        onSubmit={(event) => {
          event.preventDefault();
          void log();
        }}
      >
        <fieldset className="flex flex-col gap-2">
          <legend className="pb-2 text-label font-medium">What you feel</legend>
          <div className="flex flex-wrap gap-1.5">
            {SYMPTOM_KINDS.map((value) => (
              <ToggleChip key={value} selected={kind === value} onClick={() => setKind(value)}>
                {KIND_LABELS[value]}
              </ToggleChip>
            ))}
          </div>
        </fieldset>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="severity" className="flex items-baseline justify-between text-label font-medium">
            How bad <output htmlFor="severity" className="text-meta text-muted tabular-nums">{severity} of 10</output>
          </label>
          <input
            id="severity"
            type="range"
            min={1}
            max={10}
            step={1}
            value={severity}
            onChange={(event) => setSeverity(Number(event.target.value))}
            className="h-6 w-full accent-[var(--color-body-hygeia-3)]"
            aria-valuetext={`${severity} of 10`}
          />
          <div aria-hidden="true" className="flex justify-between text-[11px] text-muted">
            <span>Barely</span>
            <span>The worst</span>
          </div>
        </div>
        <Textarea label="Note" rows={2} maxLength={500} value={note} onChange={(event) => setNote(event.target.value)} placeholder="When it started, what makes it better or worse…" />
        <Button type="submit" size="lg" className="w-full">
          Log it now
        </Button>
      </form>
      {symptoms.length > 0 && (
        <PanelList>
          {symptoms.slice(0, 8).map((symptom) => (
            <li key={symptom.id} className="flex min-h-12 items-center gap-3 px-4 py-2 lg:px-6">
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="truncate text-sm font-medium">{describe(symptom)}</span>
                <span className="truncate text-meta text-muted">
                  {f.day(symptom.at)}, {f.time(symptom.at)}
                  {symptom.note ? ` · ${symptom.note}` : ""}
                </span>
              </span>
              <button
                type="button"
                onClick={() => void deleteSymptom(symptom).then(() => toast("Taken off the body map."))}
                aria-label={`Delete ${describe(symptom).toLowerCase()} from ${f.day(symptom.at)}`}
                title="Delete"
                className="grid size-8 shrink-0 place-items-center rounded-control text-muted hover:bg-hover hover:text-ink"
              >
                <X size={15} aria-hidden="true" />
              </button>
            </li>
          ))}
        </PanelList>
      )}
    </Panel>
  );
}
