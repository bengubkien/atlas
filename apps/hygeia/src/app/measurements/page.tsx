"use client";

import { Ellipsis, Pencil, Plus } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

import { BackLink } from "@atlas/ui/components/back-link";
import { Badge } from "@atlas/ui/components/badge";
import { Button } from "@atlas/ui/components/button";
import { LineChart } from "@atlas/ui/components/charts";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@atlas/ui/components/dropdown-menu";
import { FormDialog } from "@atlas/ui/components/form-dialog";
import { Input } from "@atlas/ui/components/input";
import { PageBody, PageHeader } from "@atlas/ui/components/page-header";
import { Panel, PanelEmpty, PanelList, PanelRow } from "@atlas/ui/components/panel";
import { toast } from "@atlas/ui/components/toast";
import { Toggle } from "@atlas/ui/components/toggle";

import { Loading } from "@/components/loading";
import { ReadingDialog } from "@/components/reading-dialog";
import { readingsOf } from "@/lib/health";
import { thisDevice } from "@/lib/local/device";
import { useMeasurements, useMeasures, useSettings } from "@/lib/local/hooks";
import { useFormat } from "@/lib/locale";
import { BUILT_IN_MEASURES, display, readingText, standing } from "@/lib/measures";
import { newId, type Measure, type Measurement, type Settings } from "@/lib/model";

export default function MeasurementsPage() {
  return (
    <Suspense fallback={<Loading />}>
      <Measurements />
    </Suspense>
  );
}

const STANDING = { high: { label: "Above range", tone: "warning" }, low: { label: "Below range", tone: "warning" }, in: { label: "In range", tone: "success" } } as const;

function Measurements() {
  const id = useSearchParams().get("m");
  const measures = useMeasures();
  const measurements = useMeasurements();
  const settings = useSettings();
  const f = useFormat();
  if (!measures || !measurements) return <Loading />;

  if (id) {
    const measure = measures.find((each) => each.id === id);
    return measure ? <MeasureDetail measure={measure} readings={readingsOf(id, measurements)} settings={settings} /> : <PageHeader title="Not here" description="That measure isn't on this device." />;
  }

  return (
    <>
      <PageHeader title="Measurements" description="Your readings over time, against the range you aim for." actions={<MeasureForm />} />
      <PageBody className="max-w-[720px]">
        <Panel title="Measures" count={measures.length}>
          <PanelList>
            {measures.map((measure) => {
              const readings = readingsOf(measure.id, measurements);
              const latest = readings.at(-1);
              const where = latest ? standing(measure, latest) : null;
              return (
                <PanelRow
                  key={measure.id}
                  href={`/measurements?m=${measure.id}`}
                  title={measure.name}
                  meta={latest ? `${readingText(measure, latest, settings, f.locale)} · ${f.day(latest.at)}` : "No reading yet"}
                  detail={readings.length ? `${readings.length} ${readings.length === 1 ? "reading" : "readings"}` : undefined}
                  aside={
                    <>
                      {where && <Badge tone={STANDING[where].tone}>{STANDING[where].label}</Badge>}
                      <ReadingDialog measure={measure} />
                    </>
                  }
                />
              );
            })}
          </PanelList>
        </Panel>
      </PageBody>
    </>
  );
}

function MeasureDetail({ measure, readings, settings }: { measure: Measure; readings: Measurement[]; settings: Settings }) {
  const f = useFormat();
  const shown = display(measure, settings);
  const recent = readings.slice(-60);
  const bp = measure.id === "m-blood-pressure";
  const band = !measure.pair && (measure.low !== null || measure.high !== null)
    ? { low: measure.low === null ? null : shown.toShown(measure.low), high: measure.high === null ? null : shown.toShown(measure.high), label: "Your range" }
    : undefined;

  return (
    <>
      <PageHeader
        before={<BackLink href="/measurements" label="Measurements" />}
        title={measure.name}
        description={rangeText(measure, shown.unit, shown.toShown, f.number) ?? "No range set: edit the measure to add the one you aim for."}
        actions={
          <>
            <MeasureForm measure={measure} />
            <ReadingDialog measure={measure} variant="primary" />
          </>
        }
      />
      <PageBody className="max-w-[760px]">
        {recent.length > 1 ? (
          <LineChart
            title={readings.length > recent.length ? `The last ${recent.length} readings` : "Over time"}
            labels={recent.map((reading) => ({ key: reading.id, label: f.date(reading.at) }))}
            series={
              measure.pair
                ? [
                    { name: bp ? "Systolic" : "First", values: recent.map((reading) => shown.toShown(reading.value)) },
                    { name: bp ? "Diastolic" : "Second", values: recent.map((reading) => (reading.value2 === null ? null : shown.toShown(reading.value2))) },
                  ]
                : [{ name: measure.name, values: recent.map((reading) => shown.toShown(reading.value)) }]
            }
            format={(value) => f.number(value, shown.decimals)}
            valueLabel={shown.unit ? `${measure.name} (${shown.unit})` : measure.name}
            band={band}
          />
        ) : null}
        <Panel title="Readings" count={readings.length}>
          {readings.length === 0 ? (
            <PanelEmpty>No readings yet. Add one, and they chart here over time.</PanelEmpty>
          ) : (
            <PanelList>
              {[...readings].reverse().map((reading) => {
                const where = standing(measure, reading);
                return (
                  <PanelRow
                    key={reading.id}
                    title={readingText(measure, reading, settings, f.locale)}
                    meta={`${f.day(reading.at)}, ${f.time(reading.at)}`}
                    detail={reading.note || undefined}
                    aside={
                      <>
                        {where && where !== "in" && <Badge tone="warning">{STANDING[where].label}</Badge>}
                        <DropdownMenu>
                          <DropdownMenuTrigger aria-label="More" className="grid size-9 place-items-center rounded-control text-muted hover:bg-hover hover:text-ink">
                            <Ellipsis size={16} aria-hidden="true" />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem className="text-danger" onSelect={() => void thisDevice().remove("measurement", [reading.id]).then(() => toast("Reading deleted."))}>
                              Delete reading
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </>
                    }
                  />
                );
              })}
            </PanelList>
          )}
        </Panel>
      </PageBody>
    </>
  );
}

/** "Aim: 60–100 bpm", "Aim: up to 120/80 mmHg". */
function rangeText(measure: Measure, unit: string, toShown: (value: number) => number, number: (value: number, digits?: number) => string): string | null {
  const one = (low: number | null, high: number | null) =>
    low !== null && high !== null ? `${number(toShown(low), 1)}–${number(toShown(high), 1)}` : high !== null ? `up to ${number(toShown(high), 1)}` : low !== null ? `at least ${number(toShown(low), 1)}` : null;
  const first = one(measure.low, measure.high);
  const second = measure.pair ? one(measure.low2, measure.high2) : null;
  if (!first && !second) return null;
  return `Aim: ${[first, second].filter(Boolean).join(" / ")}${unit ? ` ${unit}` : ""}.`;
}

/** "New measure", or "Edit" on one: its name, unit, range, and whether Today offers it. */
function MeasureForm({ measure }: { measure?: Measure }) {
  const router = useRouter();
  const settings = useSettings();
  const [open, setOpen] = useState(false);
  const [pinned, setPinned] = useState(measure?.pinned ?? true);
  const builtIn = measure ? BUILT_IN_MEASURES.some((each) => each.id === measure.id) : false;
  const shown = measure ? display(measure, settings) : null;
  const toField = (value: number | null) => (value === null || !shown ? "" : String(Math.round(shown.toShown(value) * 100) / 100));

  const save = async (form: FormData) => {
    const text = (key: string) => String(form.get(key) ?? "").trim();
    const limit = (key: string) => {
      const value = Number(text(key).replace(",", "."));
      return text(key) && Number.isFinite(value) ? (shown ? shown.toStored(value) : value) : null;
    };
    const record: Measure = {
      id: measure?.id ?? newId(),
      updatedAt: 0,
      deleted: false,
      name: (builtIn ? measure!.name : text("name")).slice(0, 80) || "Measure",
      unit: builtIn ? measure!.unit : text("unit").slice(0, 16),
      pair: measure?.pair ?? false,
      decimals: measure?.decimals ?? 1,
      low: limit("low"),
      high: limit("high"),
      low2: measure?.pair ? limit("low2") : null,
      high2: measure?.pair ? limit("high2") : null,
      pinned,
      notes: measure?.notes ?? "",
    };
    await thisDevice().put("measure", record);
    setOpen(false);
    toast(measure ? "Saved." : `Added ${record.name}.`);
    if (!measure) router.push(`/measurements?m=${record.id}`);
  };

  return (
    <FormDialog
      open={open}
      onOpenChange={setOpen}
      title={measure ? `Edit ${measure.name.toLowerCase()}` : "New measure"}
      description={measure ? undefined : "Anything you track as a number: waist, temperature, steps…"}
      trigger={
        measure ? (
          <Button variant="secondary" aria-label="Edit measure">
            <Pencil size={15} aria-hidden="true" />
          </Button>
        ) : (
          <Button>
            <Plus size={16} aria-hidden="true" /> New measure
          </Button>
        )
      }
    >
      <form action={save} className="flex flex-col gap-4">
        {!builtIn && (
          <div className="grid grid-cols-[minmax(0,1fr)_120px] gap-3">
            <Input name="name" label="Name" defaultValue={measure?.name} required maxLength={80} autoComplete="off" />
            <Input name="unit" label="Unit" defaultValue={measure?.unit} maxLength={16} placeholder="cm" autoComplete="off" />
          </div>
        )}
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-label font-medium">The range you aim for{shown?.unit ? ` (${shown.unit})` : ""}</legend>
          <div className="grid grid-cols-2 gap-3">
            <Input name="low" aria-label={measure?.pair ? "Lowest first number" : "Lowest"} placeholder="From" inputMode="decimal" defaultValue={toField(measure?.low ?? null)} />
            <Input name="high" aria-label={measure?.pair ? "Highest first number" : "Highest"} placeholder="To" inputMode="decimal" defaultValue={toField(measure?.high ?? null)} />
          </div>
          {measure?.pair && (
            <div className="grid grid-cols-2 gap-3">
              <Input name="low2" aria-label="Lowest second number" placeholder="From (second)" inputMode="decimal" defaultValue={toField(measure.low2)} />
              <Input name="high2" aria-label="Highest second number" placeholder="To (second)" inputMode="decimal" defaultValue={toField(measure.high2)} />
            </div>
          )}
          <p className="text-label text-muted">Either end can stay empty. Your doctor&apos;s numbers beat the general ones.</p>
        </fieldset>
        <Toggle label="On Today, for a quick reading" checked={pinned} onCheckedChange={setPinned} />
        <div className="flex justify-end">
          <Button type="submit" size="lg">
            Save
          </Button>
        </div>
      </form>
    </FormDialog>
  );
}
