"use client";

import { Badge } from "@atlas/ui/components/badge";
import { PageBody, PageHeader } from "@atlas/ui/components/page-header";
import { Panel, PanelEmpty, PanelList, PanelRow } from "@atlas/ui/components/panel";

import { BarList, ColumnChart, LineChart } from "@atlas/ui/components/charts";
import { useNow } from "@atlas/ui/use-now";
import { Loading } from "@/components/loading";
import { strengthForWeight, weeklyWeights } from "@/lib/bodyweight";
import { useBodyWeights } from "@/lib/bodyweight-hook";
import { useAppLinks } from "@/lib/links";
import { MUSCLE_LABELS } from "@/lib/library";
import { unitsOf } from "@/lib/model";
import { useAllSets, useExerciseMap, useSettings, useWorkouts } from "@/lib/local/hooks";
import { useFormat } from "@/lib/locale";
import { personalRecords, setsByMuscle, startOfWeek, weeklyTotals } from "@/lib/stats";
import { fromKg, weightText } from "@/lib/units";

import { setSummary } from "../workout/set-row";

const WEEKS = 12;

export default function ProgressPage() {
  const workouts = useWorkouts();
  const sets = useAllSets();
  const exercises = useExerciseMap();
  const settings = useSettings();
  const f = useFormat();
  const body = useBodyWeights();
  const now = useNow();
  const hygeia = useAppLinks()?.hygeia ?? null;
  if (!workouts || !sets || !exercises) return <Loading />;

  const unit = settings.unit;
  const weeks = weeklyTotals(workouts, sets, WEEKS);
  const label = (start: number) => new Intl.DateTimeFormat(f.locale, { day: "numeric", month: "short" }).format(start);
  const total = weeks.reduce((sum, week) => sum + week.workouts, 0);

  // The last four whole weeks and this one, by muscle.
  const from = startOfWeek(now) - 4 * 7 * 86_400_000;
  const muscles = [...setsByMuscle(workouts, sets, exercises, from, now + 1).entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([muscle, count]) => ({ key: muscle, label: MUSCLE_LABELS[muscle], value: count }));

  const records = personalRecords(exercises, workouts, sets).reverse().slice(0, 12);
  const relative = strengthForWeight(exercises, workouts, sets, body.weights);
  const weekly = weeklyWeights(body.weights, weeks.map((week) => week.start));
  const latest = body.weights.at(-1);
  const compact = (value: number) => new Intl.NumberFormat(f.locale, { notation: value >= 10_000 ? "compact" : "standard", maximumFractionDigits: 1 }).format(value);

  return (
    <>
      <PageHeader title="Progress" description={total ? `${total} ${total === 1 ? "workout" : "workouts"} in the last ${WEEKS} weeks.` : "Your weeks, muscles and records, once you've trained."} />
      <PageBody className="lg:grid lg:grid-cols-2 lg:items-start">
        <ColumnChart
          title="Workouts per week"
          points={weeks.map((week) => ({ key: String(week.start), label: label(week.start), value: week.workouts }))}
          format={(value) => String(Math.round(value))}
          valueLabel="Workouts"
        />
        <ColumnChart
          title="Volume per week"
          description={`Weight × reps of every working set, in ${unit}.`}
          points={weeks.map((week) => ({ key: String(week.start), label: label(week.start), value: fromKg(week.volumeKg, unit) }))}
          format={(value) => `${f.number(value)} ${unit}`}
          axisFormat={compact}
          valueLabel={`Volume (${unit})`}
        />
        <BarList title="Sets per muscle" description="Working sets in the last four weeks and this one." rows={muscles} format={(value) => String(value)} />
        <Panel title="For your weight">
          {body.weights.length === 0 ? (
            <PanelEmpty>
              {body.status === "loading"
                ? "Asking Hygeia for your weight…"
                : body.status === "no-hygeia"
                  ? "Your weight comes from Hygeia, which isn't set up here."
                  : "Log your weight in Hygeia, and this shows how much you lift for it."}
              {hygeia && body.status !== "loading" && (
                <>
                  {" "}
                  <a href={`${hygeia}/measurements`}>Open Hygeia</a>
                </>
              )}
            </PanelEmpty>
          ) : (
            <>
              <p className="-mt-1 px-4 pb-3 text-meta text-muted lg:px-6">
                {latest ? `${weightText(latest.kg, unit)} on ${f.day(latest.at)}, from Hygeia` : ""}
                {body.status === "saved" ? " (this device's copy: Hygeia couldn't be reached)" : ""}
              </p>
              {relative.length === 0 ? (
                <PanelEmpty>Lift with weight and reps near a day you weighed yourself, and how much you lift for your weight shows here.</PanelEmpty>
              ) : (
                <PanelList>
                  {relative.map((each) => (
                    <PanelRow
                      key={each.exercise.id}
                      href={`/exercises?e=${each.exercise.id}`}
                      title={each.exercise.name}
                      meta={`About ${weightText(each.maxKg, unit)} once, at ${weightText(each.bodyKg, unit)}`}
                      aside={<span className="font-serif text-[22px] leading-none tabular-nums">{`${f.number(each.ratio, 2)}×`}</span>}
                    />
                  ))}
                </PanelList>
              )}
            </>
          )}
        </Panel>
        {weekly.some((value) => value !== null) && (
          <LineChart
            title="Body weight"
            description="The average of each week's readings in Hygeia."
            labels={weeks.map((week) => ({ key: String(week.start), label: label(week.start) }))}
            series={[{ name: "Body weight", values: weekly.map((kg) => (kg === null ? null : fromKg(kg, unit))) }]}
            format={(value) => `${f.number(value, 1)} ${unit}`}
            valueLabel={`Body weight (${unit})`}
          />
        )}
        <Panel title="Recent records" count={records.length || undefined}>
          {records.length === 0 ? (
            <PanelEmpty>A record is a set better than any before it for that exercise. They show here as you beat them.</PanelEmpty>
          ) : (
            <PanelList>
              {records.map((record) => (
                <PanelRow
                  key={record.set.id}
                  href={`/exercises?e=${record.exercise.id}`}
                  title={record.exercise.name}
                  meta={setSummary(record.set, record.exercise.tracking, unitsOf(settings))}
                  detail={f.day(record.workout.startedAt)}
                  aside={<Badge tone="success">Record</Badge>}
                />
              ))}
            </PanelList>
          )}
        </Panel>
      </PageBody>
    </>
  );
}
