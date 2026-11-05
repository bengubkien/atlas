"use client";

import { Pencil, Repeat, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

import { BackLink } from "@atlas/ui/components/back-link";
import { Badge } from "@atlas/ui/components/badge";
import { Button } from "@atlas/ui/components/button";
import { ConfirmDialog } from "@atlas/ui/components/confirm-dialog";
import { PageBody, PageHeader } from "@atlas/ui/components/page-header";
import { Panel, PanelEmpty, PanelList, PanelRow } from "@atlas/ui/components/panel";
import { toast } from "@atlas/ui/components/toast";

import { Loading } from "@/components/loading";
import { thisDevice } from "@/lib/local/device";
import { useActiveWorkout, useAllSets, useExerciseMap, useSettings, useWorkouts } from "@/lib/local/hooks";
import { useFormat } from "@/lib/locale";
import { unitsOf, type Workout, type WorkoutSet } from "@/lib/model";
import { counts, groupBy, personalRecords } from "@/lib/stats";
import { duration, workoutTotals } from "@/lib/summary";
import { blocks, discardWorkout, repeatWorkout } from "@/lib/workout";

import { setSummary } from "../workout/set-row";

import { EditWorkout } from "./edit-workout";

export default function HistoryPage() {
  return (
    <Suspense fallback={<Loading />}>
      <History />
    </Suspense>
  );
}

function History() {
  const params = useSearchParams();
  const id = params.get("w");
  const editing = params.get("edit") === "1";
  const workouts = useWorkouts();
  const sets = useAllSets();
  const exercises = useExerciseMap();
  const settings = useSettings();
  const f = useFormat();
  if (!workouts || !sets || !exercises) return <Loading />;

  const records = personalRecords(exercises, workouts, sets);
  if (id) {
    const workout = workouts.find((each) => each.id === id);
    if (!workout) {
      return (
        <>
          <PageHeader title="Not here" />
          <PageBody>
            <p className="text-sm text-muted">
              That workout isn&apos;t on this device. It may have been deleted. <Link href="/history">All workouts</Link>
            </p>
          </PageBody>
        </>
      );
    }
    if (editing && workout.endedAt !== null) return <EditWorkout key={workout.id} workout={workout} />;
    return <WorkoutDetail workout={workout} sets={sets.filter((set) => set.workoutId === id)} recordSetIds={new Set(records.map((r) => r.set.id))} />;
  }

  const finished = workouts.filter((workout) => workout.endedAt !== null);
  const setsByWorkout = groupBy(sets, (set) => set.workoutId);
  const recordsByWorkout = groupBy(records, (record) => record.workout.id);
  const months = groupBy(finished, (workout) => new Intl.DateTimeFormat(f.locale, { month: "long", year: "numeric" }).format(workout.startedAt));

  return (
    <>
      <PageHeader title="History" description={finished.length ? `${finished.length} ${finished.length === 1 ? "workout" : "workouts"}, newest first.` : undefined} />
      <PageBody className="max-w-[720px]">
        {finished.length === 0 ? (
          <Panel title="Nothing yet">
            <PanelEmpty>Finished workouts are kept here, with every set.</PanelEmpty>
          </Panel>
        ) : (
          [...months.entries()].map(([month, list]) => (
            <Panel key={month} title={month} count={list.length}>
              <PanelList>
                {list.map((workout) => {
                  const prs = recordsByWorkout.get(workout.id)?.length ?? 0;
                  return (
                    <PanelRow
                      key={workout.id}
                      href={`/history?w=${workout.id}`}
                      title={workout.name}
                      meta={[f.day(workout.startedAt), duration(workout)].filter(Boolean).join(" · ")}
                      detail={workoutTotals(setsByWorkout.get(workout.id) ?? [], settings.unit, f.locale)}
                      aside={prs > 0 ? <Badge tone="success">{prs === 1 ? "1 record" : `${prs} records`}</Badge> : undefined}
                    />
                  );
                })}
              </PanelList>
            </Panel>
          ))
        )}
      </PageBody>
    </>
  );
}

function WorkoutDetail({ workout, sets, recordSetIds }: { workout: Workout; sets: WorkoutSet[]; recordSetIds: Set<string> }) {
  const router = useRouter();
  const exercises = useExerciseMap();
  const settings = useSettings();
  const active = useActiveWorkout();
  const f = useFormat();
  const [deleting, setDeleting] = useState(false);
  const kept = sets.filter((set) => set.done).sort((a, b) => a.position - b.position || a.index - b.index);

  const again = async () => {
    if (active) return toast("Finish the workout going on first.");
    await repeatWorkout(thisDevice(), workout, kept);
    router.push("/workout");
  };
  const remove = async () => {
    setDeleting(false);
    await discardWorkout(thisDevice(), workout, sets);
    toast("Workout deleted.");
    router.push("/history");
  };

  return (
    <>
      <PageHeader
        before={<BackLink href="/history" label="History" />}
        title={workout.name}
        description={[f.day(workout.startedAt), `${f.time(workout.startedAt)}`, duration(workout), workoutTotals(kept, settings.unit, f.locale)].filter(Boolean).join(" · ")}
        actions={
          workout.endedAt !== null && (
            <>
              <Button variant="secondary" onClick={() => setDeleting(true)} aria-label="Delete workout">
                <Trash2 size={15} aria-hidden="true" />
              </Button>
              <Button variant="secondary" onClick={() => router.push(`/history?w=${workout.id}&edit=1`)}>
                <Pencil size={15} aria-hidden="true" /> Edit
              </Button>
              <Button onClick={() => void again()}>
                <Repeat size={15} aria-hidden="true" /> Do it again
              </Button>
            </>
          )
        }
      />
      <PageBody className="max-w-[720px] gap-3">
        {blocks(kept).map((block) => {
          const exercise = exercises?.get(block.exerciseId);
          if (!exercise) return null;
          let working = 0;
          return (
            <section
              key={block.position}
              className={`rounded-panel border border-line-card bg-card px-4 py-3 lg:px-6 ${block.superset ? "border-l-4 border-l-[var(--color-accent-milo)]" : ""} ${block.superset && !block.superset.first ? "-mt-3 rounded-t-none border-t-0" : ""} ${block.superset && !block.superset.last ? "rounded-b-none" : ""}`}
            >
              {block.superset?.first && <span className="text-[11px] font-semibold tracking-wide text-[var(--color-accent-milo)] uppercase">Superset</span>}
              <h2 className="mb-2">
                <Link href={`/exercises?e=${exercise.id}`} className="text-field font-semibold text-ink hover:text-muted">
                  {exercise.name}
                </Link>
              </h2>
              <ol className="flex flex-col gap-1">
                {block.sets.map((set) => {
                  if (!set.warmup) working += 1;
                  return (
                    <li key={set.id} className="flex items-center gap-3 text-sm">
                      <span className={`w-6 text-center font-semibold tabular-nums ${set.warmup ? "text-warning" : "text-muted"}`}>{set.warmup ? "W" : working}</span>
                      <span className="font-mono tabular-nums">{setSummary(set, exercise.tracking, unitsOf(settings))}</span>
                      {recordSetIds.has(set.id) && counts(set) && <Badge tone="success">Record</Badge>}
                    </li>
                  );
                })}
              </ol>
            </section>
          );
        })}
        {workout.notes && <p className="text-sm text-pretty text-muted">{workout.notes}</p>}
      </PageBody>
      <ConfirmDialog
        open={deleting}
        onOpenChange={setDeleting}
        title="Delete this workout?"
        description="Its sets go too, from every device. This can't be undone."
        confirmLabel="Delete"
        onConfirm={() => void remove()}
      />
    </>
  );
}
