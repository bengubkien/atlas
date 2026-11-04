"use client";

import { Play, Plus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { Button } from "@atlas/ui/components/button";
import { Panel, PanelEmpty, PanelList } from "@atlas/ui/components/panel";

import { thisDevice } from "@/lib/local/device";
import { useExerciseMap, useRoutines } from "@/lib/local/hooks";
import type { Routine } from "@/lib/model";
import { startWorkout } from "@/lib/workout";

/** Starting a workout: an empty one, or one of your routines. */
export function StartWorkout() {
  const router = useRouter();
  const routines = useRoutines();
  const exercises = useExerciseMap();

  const start = async (routine?: Routine) => {
    await startWorkout(thisDevice(), routine);
    router.push("/workout");
  };

  return (
    <div className="flex flex-col gap-4">
      <Button size="lg" className="h-14 w-full text-base" onClick={() => void start()}>
        <Play size={18} aria-hidden="true" /> Start an empty workout
      </Button>
      <Panel
        title="From a routine"
        count={routines?.length}
        action={
          <Link href="/routines?new=1" className="flex items-center gap-1 text-meta text-muted hover:text-ink">
            <Plus size={14} aria-hidden="true" /> New
          </Link>
        }
      >
        {routines && routines.length === 0 ? (
          <PanelEmpty>
            No routines yet. <Link href="/routines?new=1">Make one</Link> to start a workout with its exercises laid out.
          </PanelEmpty>
        ) : (
          <PanelList>
            {(routines ?? []).map((routine) => (
              <li key={routine.id} className="flex min-h-16 items-center gap-3 px-4 py-2.5 lg:px-6">
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="truncate text-sm font-medium">{routine.name}</span>
                  <span className="truncate text-meta text-muted">
                    {routine.items.map((item) => exercises?.get(item.exerciseId)?.name ?? "?").join(", ") || "No exercises yet"}
                  </span>
                </div>
                <Button variant="secondary" size="sm" onClick={() => void start(routine)} aria-label={`Start ${routine.name}`}>
                  Start
                </Button>
              </li>
            ))}
          </PanelList>
        )}
      </Panel>
    </div>
  );
}
