"use client";

import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@atlas/ui/components/button";
import { Input } from "@atlas/ui/components/input";
import { PageBody, PageHeader } from "@atlas/ui/components/page-header";
import { Panel } from "@atlas/ui/components/panel";
import { Textarea } from "@atlas/ui/components/textarea";
import { toast } from "@atlas/ui/components/toast";
import { useNow } from "@atlas/ui/use-now";

import { Loading } from "@/components/loading";
import { fromLocal, localDate, localTime } from "@/lib/clock-time";
import { thisDevice } from "@/lib/local/device";
import { useAllSets, useExerciseMap, useSettings, useWorkouts, useWorkoutSets } from "@/lib/local/hooks";
import { unitsOf, type Change, type Workout } from "@/lib/model";
import { lastTime } from "@/lib/stats";
import { addExercise, blocks, dropEmptySets, runs } from "@/lib/workout";

import { ExerciseBlock } from "../workout/exercise-block";
import { ExercisePicker } from "../workout/exercise-picker";

/**
 * Corrects a finished workout: its name, when it was and for how long, its
 * notes, and every set, as during the workout but with nothing to tick
 * (every set is kept). Sets left empty are dropped when you're done.
 */
export function EditWorkout({ workout }: { workout: Workout }) {
  const router = useRouter();
  const device = thisDevice();
  const sets = useWorkoutSets(workout.id);
  const exercises = useExerciseMap();
  const allSets = useAllSets();
  const workouts = useWorkouts();
  const settings = useSettings();
  const now = useNow();
  const [error, setError] = useState<string | null>(null);
  if (!sets || !exercises || !allSets || !workouts) return <Loading />;

  const minutes = workout.endedAt ? Math.max(1, Math.round((workout.endedAt - workout.startedAt) / 60_000)) : 60;
  const exerciseBlocks = blocks(sets);

  const saveDetails = (form: FormData) => {
    const value = (key: string) => String(form.get(key) ?? "").trim();
    const startedAt = fromLocal(value("date"), value("time"));
    const length = Number(value("minutes"));
    if (!value("name")) return setError("Give it a name.");
    if (startedAt === null) return setError("Pick the day and the time it started.");
    if (startedAt > Date.now()) return setError("It can't have started in the future.");
    if (!Number.isInteger(length) || length < 1 || length > 1440) return setError("How long is a number of minutes, from 1 to 1440.");
    setError(null);
    void device.put("workout", {
      ...workout,
      name: value("name").slice(0, 80),
      startedAt,
      endedAt: startedAt + length * 60_000,
      notes: value("notes").slice(0, 4000),
    });
    toast("Saved.");
  };

  const finish = async () => {
    await dropEmptySets(device, sets);
    // Sets typed in here are kept, whatever they were before.
    const filled = sets.filter((set) => !set.done && (set.weightKg !== null || set.reps !== null || set.seconds !== null || set.meters !== null));
    if (filled.length) await device.save(filled.map((set): Change => ({ kind: "set", record: { ...set, done: true } })));
    router.push(`/history?w=${workout.id}`);
  };

  return (
    <>
      <PageHeader title="Edit workout" description={workout.name} actions={<Button onClick={() => void finish()}>Done</Button>} />
      <PageBody className="max-w-[760px] gap-3 pb-24">
        <Panel title="Details">
          <form action={saveDetails} className="flex flex-col gap-4 border-t border-line px-4 py-4 lg:px-6">
            <Input name="name" label="Name" defaultValue={workout.name} required maxLength={80} autoComplete="off" />
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <Input name="date" type="date" label="Day" defaultValue={localDate(workout.startedAt)} max={localDate(now)} required />
              <Input name="time" type="time" label="Started" defaultValue={localTime(workout.startedAt)} required />
              <Input name="minutes" label="Minutes" inputMode="numeric" defaultValue={String(minutes)} required className="col-span-2 sm:col-span-1" />
            </div>
            <Textarea name="notes" label="Notes" rows={2} defaultValue={workout.notes} />
            {error && (
              <p role="alert" className="text-label text-error">
                {error}
              </p>
            )}
            <div className="flex justify-end">
              <Button type="submit" variant="secondary">
                Save details
              </Button>
            </div>
          </form>
        </Panel>
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
              return (
                <ExerciseBlock
                  key={block.position}
                  exercise={exercise}
                  position={block.position}
                  sets={block.sets}
                  allSets={sets}
                  lastTime={lastTime(exercise.id, workouts, allSets, workout.startedAt)}
                  units={unitsOf(settings)}
                  restSeconds={0}
                  first={i === 0}
                  last={i === exerciseBlocks.length - 1}
                  superset={block.superset}
                  editing
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
          onPick={(exercise) => void addExercise(device, workout.id, exercise, sets, true)}
        />
      </PageBody>
    </>
  );
}
