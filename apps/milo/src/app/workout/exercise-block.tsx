"use client";

import { ArrowDown, ArrowUp, Ellipsis, Link2, Plus, Trash2, TriangleAlert, Unlink } from "lucide-react";
import Link from "next/link";

import { Button } from "@atlas/ui/components/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@atlas/ui/components/dropdown-menu";

import { MUSCLE_LABELS } from "@/lib/library";
import { thisDevice } from "@/lib/local/device";
import type { Exercise, Tracking, Units, WorkoutSet } from "@/lib/model";
import { cn } from "@atlas/ui/cn";

import { addSet, joinSuperset, leaveSuperset, moveExercise, removeExercise, workingNumbers, type Block } from "@/lib/workout";

import { SetRow, setSummary } from "./set-row";

const HEADINGS: Record<Tracking, [string, string]> = {
  load: ["", "reps"],
  bodyweight: ["+", "reps"],
  duration: ["time", ""],
  cardio: ["", "time"],
};

/** One exercise in the workout: last time's sets, this time's, and a way to add one. */
export function ExerciseBlock({
  exercise,
  position,
  sets,
  allSets,
  lastTime,
  units,
  restSeconds,
  first,
  last,
  superset = null,
  editing = false,
  cautions = [],
}: {
  exercise: Exercise;
  position: number;
  /** This exercise's sets in this workout, in order. */
  sets: WorkoutSet[];
  /** All of this workout's sets (for moving and adding). */
  allSets: WorkoutSet[];
  /** The exercise's sets the last time it was done. */
  lastTime: WorkoutSet[];
  units: Units;
  restSeconds: number;
  first: boolean;
  last: boolean;
  /** Its place in a superset, if it's in one. */
  superset?: Block["superset"];
  /** A finished workout being corrected (see SetRow). */
  editing?: boolean;
  /** Recent soreness this exercise loads, from Hygeia ("Left knee: pain, 6 of 10, yesterday"). */
  cautions?: string[];
}) {
  const device = thisDevice();
  const workoutId = sets[0]?.workoutId ?? "";
  const [left, right] = HEADINGS[exercise.tracking];
  const numbers = workingNumbers(sets);

  return (
    <section
      aria-label={superset ? `${exercise.name}, in a superset` : exercise.name}
      className={cn(
        "flex flex-col rounded-panel border border-line-card bg-card",
        // A superset's exercises read as one: a bar down the side, joined edges.
        superset && "border-l-4 border-l-[var(--color-accent-milo)]",
        superset && !superset.first && "rounded-t-none border-t-0",
        superset && !superset.last && "rounded-b-none",
      )}
    >
      <header className="flex items-start gap-2 px-3 pt-3 pb-1 sm:px-4">
        <div className="flex min-w-0 flex-1 flex-col gap-0.5 pl-1">
          {superset?.first && <span className="text-[11px] font-semibold tracking-wide text-[var(--color-accent-milo)] uppercase">Superset</span>}
          <Link href={`/exercises?e=${exercise.id}`} className="truncate text-field font-semibold text-ink hover:text-muted">
            {exercise.name}
          </Link>
          <span className="truncate text-xs text-muted">
            {[
              superset ? (superset.last ? "Then rest" : "Then the next exercise") : null,
              lastTime.length > 0 ? `Last time: ${lastTime.map((set) => setSummary(set, exercise.tracking, units)).join(", ")}` : MUSCLE_LABELS[exercise.muscle],
            ]
              .filter(Boolean)
              .join(" · ")}
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
            {!last && !(superset && !superset.last) && (
              <DropdownMenuItem onSelect={() => void joinSuperset(device, position, allSets)}>
                <Link2 size={15} aria-hidden="true" /> Superset with the next
              </DropdownMenuItem>
            )}
            {superset && (
              <DropdownMenuItem onSelect={() => void leaveSuperset(device, position, allSets)}>
                <Unlink size={15} aria-hidden="true" /> Take out of the superset
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onSelect={() => void removeExercise(device, position, allSets)} className="text-danger">
              <Trash2 size={15} aria-hidden="true" /> Remove exercise
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>

      {cautions.length > 0 && (
        <p className="mx-3 mb-1 flex items-start gap-2 rounded-control bg-warning-surface px-2.5 py-1.5 text-meta text-ink sm:mx-4">
          <TriangleAlert size={15} aria-hidden="true" className="mt-0.5 shrink-0 text-warning" />
          <span>{cautions.join(". ")}. Go easy, or swap it.</span>
        </p>
      )}
      <div className="flex flex-col px-2 pb-1 sm:px-3">
        <div
          aria-hidden="true"
          className="grid grid-cols-[36px_minmax(0,1fr)_72px_60px_44px] gap-2 px-1 pt-1 pb-0.5 text-center text-[11px] font-medium text-muted uppercase sm:grid-cols-[40px_minmax(0,1fr)_96px_80px_44px]"
        >
          <span>Set</span>
          <span>Previous</span>
          <span className={exercise.tracking === "duration" ? "col-span-2" : ""}>{left || (exercise.tracking === "cardio" ? units.distance : units.weight)}</span>
          {exercise.tracking !== "duration" && <span>{right}</span>}
          <span />
        </div>
        {sets.map((set, i) => {
          // Last time's set in the same place, else the set before this one.
          const previous = lastTime[i] ?? (i > 0 ? sets[i - 1] : undefined);
          return (
            <SetRow
              key={`${set.id}-${set.done}`}
              set={set}
              number={numbers[i]!}
              tracking={exercise.tracking}
              units={units}
              previous={previous?.done || lastTime[i] ? previous : undefined}
              restSeconds={superset && !superset.last ? 0 : restSeconds}
              editing={editing}
            />
          );
        })}
      </div>

      <div className="px-3 pt-1 pb-3 sm:px-4">
        <Button variant="secondary" size="sm" className="w-full" onClick={() => void addSet(device, workoutId, exercise.id, position, allSets, editing)}>
          <Plus size={15} aria-hidden="true" /> Add set
        </Button>
      </div>
    </section>
  );
}
