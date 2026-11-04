"use client";

import { Badge } from "@atlas/ui/components/badge";
import { PageBody, PageHeader } from "@atlas/ui/components/page-header";
import { Panel, PanelEmpty, PanelList, PanelRow } from "@atlas/ui/components/panel";

import { BarList, ColumnChart } from "@atlas/ui/components/charts";
import { Loading } from "@/components/loading";
import { MUSCLE_LABELS } from "@/lib/library";
import { useAllSets, useExerciseMap, useSettings, useWorkouts } from "@/lib/local/hooks";
import { useFormat } from "@/lib/locale";
import { personalRecords, setsByMuscle, startOfWeek, weeklyTotals } from "@/lib/stats";
import { fromKg } from "@/lib/units";

import { setSummary } from "../workout/set-row";

const WEEKS = 12;

export default function ProgressPage() {
  const workouts = useWorkouts();
  const sets = useAllSets();
  const exercises = useExerciseMap();
  const settings = useSettings();
  const f = useFormat();
  if (!workouts || !sets || !exercises) return <Loading />;

  const unit = settings.unit;
  const weeks = weeklyTotals(workouts, sets, WEEKS);
  const label = (start: number) => new Intl.DateTimeFormat(f.locale, { day: "numeric", month: "short" }).format(start);
  const total = weeks.reduce((sum, week) => sum + week.workouts, 0);

  // The last four whole weeks and this one, by muscle.
  const from = startOfWeek(Date.now()) - 4 * 7 * 86_400_000;
  const muscles = [...setsByMuscle(workouts, sets, exercises, from, Date.now() + 1).entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([muscle, count]) => ({ key: muscle, label: MUSCLE_LABELS[muscle], value: count }));

  const records = personalRecords(exercises, workouts, sets).reverse().slice(0, 12);
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
                  meta={setSummary(record.set, record.exercise.tracking, unit)}
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
