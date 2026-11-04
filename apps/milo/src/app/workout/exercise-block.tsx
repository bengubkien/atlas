"use client";

import { ArrowDown, ArrowUp, Ellipsis, Plus, Trash2 } from "lucide-react";
import Link from "next/link";

import { Button } from "@atlas/ui/components/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@atlas/ui/components/dropdown-menu";

import { MUSCLE_LABELS } from "@/lib/library";
import { thisDevice } from "@/lib/local/device";
import type { Exercise, Tracking, Unit, WorkoutSet } from "@/lib/model";
import { addSet, moveExercise, removeExercise } from "@/lib/workout";

import { SetRow, setSummary } from "./set-row";

const HEADINGS: Record<Tracking, [string, string]> = {
  load: ["", "reps"],
  bodyweight: ["+", "reps"],
  duration: ["time", ""],
  cardio: ["km", "time"],
};

/** One exercise in the workout: last time's sets, this time's, and a way to add one. */
export function ExerciseBlock({
  exercise,
  position,
  sets,
  allSets,
  lastTime,
  unit,
  restSeconds,
  first,
  last,
}: {
  exercise: Exercise;
  position: number;
  /** This exercise's sets in this workout, in order. */
  sets: WorkoutSet[];
  /** All of this workout's sets (for moving and adding). */
  allSets: WorkoutSet[];
  /** The exercise's sets the last time it was done. */
  lastTime: WorkoutSet[];
  unit: Unit;
  restSeconds: number;
  first: boolean;
  last: boolean;
}) {
  const device = thisDevice();
  const workoutId = sets[0]?.workoutId ?? "";
  const [left, right] = HEADINGS[exercise.tracking];
  let working = 0;

  return (
    <section aria-label={exercise.name} className="flex flex-col rounded-panel border border-line-card bg-card">
      <header className="flex items-start gap-2 px-3 pt-3 pb-1 sm:px-4">
        <div className="flex min-w-0 flex-1 flex-col gap-0.5 pl-1">
          <Link href={`/exercises?e=${exercise.id}`} className="truncate text-field font-semibold text-ink hover:text-muted">
            {exercise.name}
          </Link>
          <span className="truncate text-xs text-muted">
            {lastTime.length > 0 ? `Last time: ${lastTime.map((set) => setSummary(set, exercise.tracking, unit)).join(", ")}` : MUSCLE_LABELS[exercise.muscle]}
          </span>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger aria-label={`${exercise.name}: more`} className="grid size-9 shrink-0 place-items-center rounded-control text-muted hover:bg-hover hover:text-ink">
            <Ellipsis size={18} aria-hidden="true" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {!first && (
              <DropdownMenuItem onSelect={() => void moveExercise(device, position, -1, allSets)}>
                <ArrowUp size={15} aria-hidden="true" /> Move up
              </DropdownMenuItem>
            )}
            {!last && (
              <DropdownMenuItem onSelect={() => void moveExercise(device, position, 1, allSets)}>
                <ArrowDown size={15} aria-hidden="true" /> Move down
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onSelect={() => void removeExercise(device, position, allSets)} className="text-danger">
              <Trash2 size={15} aria-hidden="true" /> Remove exercise
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>

      <div className="flex flex-col px-2 pb-1 sm:px-3">
        <div
          aria-hidden="true"
          className="grid grid-cols-[36px_minmax(0,1fr)_72px_60px_44px] gap-2 px-1 pt-1 pb-0.5 text-center text-[11px] font-medium text-muted uppercase sm:grid-cols-[40px_minmax(0,1fr)_96px_80px_44px]"
        >
          <span>Set</span>
          <span>Previous</span>
          <span className={exercise.tracking === "duration" ? "col-span-2" : ""}>{left || unit}</span>
          {exercise.tracking !== "duration" && <span>{right}</span>}
          <span />
        </div>
        {sets.map((set, i) => {
          if (!set.warmup) working += 1;
          // Last time's set in the same place, else the set before this one.
          const previous = lastTime[i] ?? (i > 0 ? sets[i - 1] : undefined);
          return (
            <SetRow
              key={`${set.id}-${set.done}`}
              set={set}
              number={working}
              tracking={exercise.tracking}
              unit={unit}
              previous={previous?.done || lastTime[i] ? previous : undefined}
              restSeconds={restSeconds}
            />
          );
        })}
      </div>

      <div className="px-3 pt-1 pb-3 sm:px-4">
        <Button variant="secondary" size="sm" className="w-full" onClick={() => void addSet(device, workoutId, exercise.id, position, allSets)}>
          <Plus size={15} aria-hidden="true" /> Add set
        </Button>
      </div>
    </section>
  );
}
