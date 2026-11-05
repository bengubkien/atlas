"use client";

import { Ellipsis, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@atlas/ui/components/button";
import { ConfirmDialog } from "@atlas/ui/components/confirm-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@atlas/ui/components/dropdown-menu";
import { FormDialog } from "@atlas/ui/components/form-dialog";
import { Input } from "@atlas/ui/components/input";
import { PageBody, PageHeader } from "@atlas/ui/components/page-header";
import { toast } from "@atlas/ui/components/toast";

import { Loading } from "@/components/loading";
import { thisDevice } from "@/lib/local/device";
import { useActiveWorkout, useAllSets, useExerciseMap, useRoutines, useSettings, useWorkouts, useWorkoutSets } from "@/lib/local/hooks";
import { useFormat } from "@/lib/locale";
import { unitsOf, type Workout } from "@/lib/model";
import { lastTime } from "@/lib/stats";
import { clock } from "@/lib/units";
import { addExercise, blocks, discardWorkout, finishWorkout, runs } from "@/lib/workout";

import { Elapsed } from "./elapsed";
import { ExerciseBlock } from "./exercise-block";
import { ExercisePicker } from "./exercise-picker";
import { RestBar, stopRest } from "./rest-timer";
import { StartWorkout } from "./start";
import { useWakeLock } from "./wake-lock";

export default function WorkoutPage() {
  const active = useActiveWorkout();
  if (active === undefined) return <Loading />;
  if (!active) {
    return (
      <>
        <PageHeader title="Start a workout" description="Empty, adding exercises as you go, or from a routine with everything laid out." />
        <PageBody className="max-w-[720px]">
          <StartWorkout />
        </PageBody>
      </>
    );
  }
  return <ActiveWorkout key={active.id} workout={active} />;
}

function ActiveWorkout({ workout }: { workout: Workout }) {
  const router = useRouter();
  const device = thisDevice();
  const f = useFormat();
  const sets = useWorkoutSets(workout.id);
  const exercises = useExerciseMap();
  const allSets = useAllSets();
  const workouts = useWorkouts();
  const settings = useSettings();
  const routine = useRoutines()?.find((each) => each.id === workout.routineId);
  const [finishing, setFinishing] = useState(false);
  const [discarding, setDiscarding] = useState(false);
  const [renaming, setRenaming] = useState(false);
  useWakeLock(true);

  if (!sets || !exercises || !allSets || !workouts) return <Loading />;

  const done = sets.filter((set) => set.done);
  const undone = sets.length - done.length;
  const exerciseBlocks = blocks(sets);

  const finish = async () => {
    setFinishing(false);
    stopRest();
    const kept = await finishWorkout(device, workout, sets);
    if (kept) {
      const minutes = clock((Date.now() - workout.startedAt) / 1000);
      toast(`Saved: ${done.length} ${done.length === 1 ? "set" : "sets"} in ${minutes}.`);
      router.push(`/history?w=${workout.id}`);
    } else {
      toast("Nothing was ticked off, so the workout wasn't kept.");
      router.push("/");
    }
  };

  const discard = async () => {
    setDiscarding(false);
    stopRest();
    await discardWorkout(device, workout, sets);
    toast("Workout discarded.");
    router.push("/");
  };

  return (
    <>
      <PageHeader
        title={workout.name}
        description={
          <>
            Started {f.time(workout.startedAt)} · <Elapsed since={workout.startedAt} /> · {done.length} of {sets.length} sets done
          </>
        }
        actions={
          <>
            <DropdownMenu>
              <DropdownMenuTrigger aria-label="More" className="grid size-10 place-items-center rounded-control text-muted hover:bg-hover hover:text-ink">
                <Ellipsis size={18} aria-hidden="true" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={() => setRenaming(true)}>Rename</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setDiscarding(true)} className="text-danger">
                  Discard workout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button onClick={() => (undone > 0 && done.length > 0 ? setFinishing(true) : void finish())}>Finish</Button>
          </>
        }
      />
      <PageBody className="max-w-[760px] gap-3 pb-40 lg:pb-32">
        {exerciseBlocks.length === 0 && (
          <p className="rounded-panel border border-dashed border-line-field px-4 py-8 text-center text-sm text-muted">
            Add your first exercise. Its sets show here, with what you did last time beside them.
          </p>
        )}
        {runs(exerciseBlocks).map((run) => (
          <div
            key={run[0]!.position}
            role={run.length > 1 ? "group" : undefined}
            aria-label={run.length > 1 ? "Superset" : undefined}
            className="flex flex-col"
          >
            {run.map((block) => {
              const i = exerciseBlocks.indexOf(block);
              const exercise = exercises.get(block.exerciseId);
              if (!exercise) return null;
              const item = routine?.items[block.position];
              const rest = item?.exerciseId === block.exerciseId && item.restSeconds !== null ? item.restSeconds : settings.restSeconds;
              return (
                <ExerciseBlock
                  key={block.position}
                  exercise={exercise}
                  position={block.position}
                  sets={block.sets}
                  allSets={sets}
                  lastTime={lastTime(exercise.id, workouts, allSets, workout.startedAt)}
                  units={unitsOf(settings)}
                  restSeconds={rest}
                  first={i === 0}
                  last={i === exerciseBlocks.length - 1}
                  superset={block.superset}
                />
              );
            })}
          </div>
        ))}
        <ExercisePicker
          trigger={
            <Button variant="secondary" size="lg" className="h-12 w-full">
              <Plus size={18} aria-hidden="true" /> Add exercise
            </Button>
          }
          onPick={(exercise) => void addExercise(device, workout.id, exercise, sets)}
        />
      </PageBody>
      <RestBar />

      <FormDialog open={finishing} onOpenChange={setFinishing} title="Finish the workout?" description={`${undone} ${undone === 1 ? "set isn't" : "sets aren't"} ticked off. ${undone === 1 ? "It won't" : "They won't"} be kept.`}>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="secondary" size="lg" onClick={() => setFinishing(false)}>
            Keep going
          </Button>
          <Button size="lg" onClick={() => void finish()}>
            Finish
          </Button>
        </div>
      </FormDialog>

      <ConfirmDialog
        open={discarding}
        onOpenChange={setDiscarding}
        title="Discard this workout?"
        description="Its sets go too. This can't be undone."
        confirmLabel="Discard"
        onConfirm={() => void discard()}
      />

      <RenameDialog open={renaming} onOpenChange={setRenaming} workout={workout} />
    </>
  );
}

function RenameDialog({ open, onOpenChange, workout }: { open: boolean; onOpenChange: (open: boolean) => void; workout: Workout }) {
  return (
    <FormDialog open={open} onOpenChange={onOpenChange} title="Rename">
      <form
        className="flex flex-col gap-4"
        action={(form) => {
          const name = String(form.get("name") ?? "").trim();
          if (name) void thisDevice().put("workout", { ...workout, name: name.slice(0, 80) });
          onOpenChange(false);
        }}
      >
        <Input name="name" label="Name" defaultValue={workout.name} required maxLength={80} autoComplete="off" />
        <div className="flex justify-end">
          <Button type="submit" size="lg">
            Save
          </Button>
        </div>
      </form>
    </FormDialog>
  );
}
