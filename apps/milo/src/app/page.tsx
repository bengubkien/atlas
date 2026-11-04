"use client";

import { ChevronRight, PersonStanding } from "lucide-react";
import Link from "next/link";

import { buttonClassName } from "@atlas/ui/components/button";
import { PageBody, PageHeader } from "@atlas/ui/components/page-header";
import { Panel, PanelEmpty, PanelList, PanelRow } from "@atlas/ui/components/panel";

import { Loading } from "@/components/loading";
import { SyncStatus } from "@/components/sync-status";
import { MUSCLE_LABELS } from "@/lib/library";
import { useActiveWorkout, useAllSets, useExerciseMap, useSettings, useWorkouts } from "@/lib/local/hooks";
import { useFormat } from "@/lib/locale";
import { ago, restedLongest, standings } from "@/lib/muscles";
import { groupBy, weeklyTotals } from "@/lib/stats";
import { duration, workoutTotals } from "@/lib/summary";

import { Elapsed } from "./workout/elapsed";
import { StartWorkout } from "./workout/start";

export default function TodayPage() {
  const active = useActiveWorkout();
  const workouts = useWorkouts();
  const sets = useAllSets();
  const exercises = useExerciseMap();
  const settings = useSettings();
  const f = useFormat();
  if (active === undefined || !workouts || !sets || !exercises) return <Loading />;

  const finished = workouts.filter((workout) => workout.endedAt !== null);
  const [thisWeek] = weeklyTotals(finished, sets, 1);
  const setsByWorkout = groupBy(sets, (set) => set.workoutId);
  const recent = finished.slice(0, 5);
  const rested = restedLongest(standings(workouts, sets, exercises));

  return (
    <>
      <PageHeader
        title="Today"
        description={
          thisWeek && thisWeek.workouts > 0
            ? `${thisWeek.workouts} ${thisWeek.workouts === 1 ? "workout" : "workouts"} and ${thisWeek.sets} sets this week.`
            : "No workout yet this week."
        }
      />
      <PageBody className="max-w-[720px]">
        {active ? (
          <div className="flex flex-col gap-4 rounded-panel border border-line-card bg-card p-5">
            <div className="flex flex-col gap-1">
              <span className="text-meta text-muted">Going on now</span>
              <span className="font-serif text-[26px] leading-tight">{active.name}</span>
              <span className="text-sm text-muted">
                Started {f.time(active.startedAt)} · <Elapsed since={active.startedAt} />
              </span>
            </div>
            <Link href="/workout" className={buttonClassName("primary", "lg", "h-12 w-full text-base")}>
              Back to the workout <ChevronRight size={18} aria-hidden="true" />
            </Link>
          </div>
        ) : (
          <StartWorkout />
        )}

        {!active && rested.length > 0 && (
          <Link
            href="/muscles"
            className="flex min-h-14 items-center gap-3 rounded-panel border border-line-card bg-card px-4 py-3 text-ink hover:border-line-strong hover:text-ink lg:px-6"
          >
            <PersonStanding size={18} aria-hidden="true" className="shrink-0 text-muted" />
            <span className="flex-1 text-sm text-pretty">
              Rested longest: {rested.map((standing) => `${MUSCLE_LABELS[standing.muscle].toLowerCase()} (${ago(standing.days)})`).join(", ")}.
            </span>
            <ChevronRight size={16} aria-hidden="true" className="shrink-0 text-faint" />
          </Link>
        )}

        <Panel title="Recent" count={finished.length || undefined} action={finished.length > 5 ? <Link href="/history" className="text-meta text-muted hover:text-ink">All</Link> : undefined}>
          {recent.length === 0 ? (
            <PanelEmpty>Your finished workouts show here.</PanelEmpty>
          ) : (
            <PanelList>
              {recent.map((workout) => (
                <PanelRow
                  key={workout.id}
                  href={`/history?w=${workout.id}`}
                  title={workout.name}
                  meta={[f.day(workout.startedAt), duration(workout)].filter(Boolean).join(" · ")}
                  detail={workoutTotals(setsByWorkout.get(workout.id) ?? [], settings.unit, f.locale)}
                />
              ))}
            </PanelList>
          )}
        </Panel>

        <SyncStatus className="px-1" />
      </PageBody>
    </>
  );
}
