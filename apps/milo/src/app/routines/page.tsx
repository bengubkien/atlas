"use client";

import { ArrowDown, ArrowUp, Minus, Play, Plus, Trash2 } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";

import { BackLink } from "@atlas/ui/components/back-link";
import { Button } from "@atlas/ui/components/button";
import { ConfirmDialog } from "@atlas/ui/components/confirm-dialog";
import { PageBody, PageHeader } from "@atlas/ui/components/page-header";
import { Panel, PanelEmpty, PanelList, PanelRow } from "@atlas/ui/components/panel";
import { toast } from "@atlas/ui/components/toast";

import { Loading } from "@/components/loading";
import { thisDevice } from "@/lib/local/device";
import { useActiveWorkout, useExerciseMap, useRoutines, useSettings } from "@/lib/local/hooks";
import { newId, type Routine, type RoutineItem } from "@/lib/model";
import { clock } from "@/lib/units";
import { startWorkout } from "@/lib/workout";

import { ExercisePicker } from "../workout/exercise-picker";

const RESTS = [null, 30, 60, 90, 120, 150, 180, 240, 300] as const;

export default function RoutinesPage() {
  return (
    <Suspense fallback={<Loading />}>
      <Routines />
    </Suspense>
  );
}

function Routines() {
  const params = useSearchParams();
  const router = useRouter();
  const routines = useRoutines();
  const exercises = useExerciseMap();
  const id = params.get("r");
  const wantsNew = params.get("new") === "1";
  const created = useRef(false);

  // "New routine" makes one at once and opens it, so there's no half-made form to lose.
  useEffect(() => {
    if (!wantsNew || created.current) return;
    created.current = true;
    const routine: Routine = { id: newId(), updatedAt: 0, deleted: false, name: "New routine", notes: "", items: [] };
    void thisDevice()
      .put("routine", routine)
      .then(() => router.replace(`/routines?r=${routine.id}`));
  }, [wantsNew, router]);

  if (!routines || !exercises || wantsNew) return <Loading />;
  if (id) {
    const routine = routines.find((each) => each.id === id);
    return routine ? <RoutineEditor key={routine.id} routine={routine} /> : <PageHeader title="Not here" description="That routine isn't on this device." />;
  }

  return (
    <>
      <PageHeader
        title="Routines"
        description="Workouts you repeat, with their exercises, sets and rest laid out."
        actions={
          <Button onClick={() => router.push("/routines?new=1")}>
            <Plus size={16} aria-hidden="true" /> New routine
          </Button>
        }
      />
      <PageBody className="max-w-[720px]">
        <Panel title="Your routines" count={routines.length}>
          {routines.length === 0 ? (
            <PanelEmpty>None yet. A routine is a list of exercises with how many sets of each, like “Push day”.</PanelEmpty>
          ) : (
            <PanelList>
              {routines.map((routine) => (
                <PanelRow
                  key={routine.id}
                  href={`/routines?r=${routine.id}`}
                  title={routine.name}
                  meta={routine.items.map((item) => exercises.get(item.exerciseId)?.name ?? "?").join(", ") || "No exercises yet"}
                  detail={`${routine.items.length} ${routine.items.length === 1 ? "exercise" : "exercises"}, ${routine.items.reduce((sum, item) => sum + item.sets, 0)} sets`}
                />
              ))}
            </PanelList>
          )}
        </Panel>
      </PageBody>
    </>
  );
}

function RoutineEditor({ routine }: { routine: Routine }) {
  const router = useRouter();
  const device = thisDevice();
  const exercises = useExerciseMap();
  const settings = useSettings();
  const active = useActiveWorkout();
  const [name, setName] = useState(routine.name);
  const [deleting, setDeleting] = useState(false);

  const save = (patch: Partial<Routine>) => device.put("routine", { ...routine, ...patch });
  const setItem = (index: number, patch: Partial<RoutineItem>) =>
    save({ items: routine.items.map((item, i) => (i === index ? { ...item, ...patch } : item)) });
  const move = (index: number, direction: -1 | 1) => {
    const items = [...routine.items];
    const [item] = items.splice(index, 1);
    items.splice(index + direction, 0, item!);
    void save({ items });
  };

  const start = async () => {
    if (active) return toast("Finish the workout going on first.");
    if (routine.items.length === 0) return toast("Add an exercise first.");
    await startWorkout(device, routine);
    router.push("/workout");
  };

  return (
    <>
      <PageHeader
        before={<BackLink href="/routines" label="Routines" />}
        title={routine.name}
        actions={
          <>
            <Button variant="secondary" onClick={() => setDeleting(true)} aria-label="Delete routine">
              <Trash2 size={15} aria-hidden="true" />
            </Button>
            <Button onClick={() => void start()}>
              <Play size={15} aria-hidden="true" /> Start
            </Button>
          </>
        }
      />
      <PageBody className="max-w-[720px] gap-4">
        <label className="flex flex-col gap-[7px]">
          <span className="text-label font-medium">Name</span>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            onBlur={() => {
              const trimmed = name.trim().slice(0, 80);
              if (trimmed && trimmed !== routine.name) void save({ name: trimmed });
              else setName(routine.name);
            }}
            maxLength={80}
            className="h-11 rounded-control border border-line-input bg-input px-3 text-field shadow-control focus:border-primary"
          />
        </label>

        <ol className="flex flex-col gap-2">
          {routine.items.map((item, index) => {
            const exercise = exercises?.get(item.exerciseId);
            return (
              <li key={`${item.exerciseId}-${index}`} className="flex flex-col gap-3 rounded-panel border border-line-card bg-card p-3 sm:p-4">
                <div className="flex items-center gap-2">
                  <span className="w-5 text-center text-sm font-semibold text-muted tabular-nums">{index + 1}</span>
                  <span className="min-w-0 flex-1 truncate text-field font-semibold">{exercise?.name ?? "Unknown exercise"}</span>
                  <button type="button" disabled={index === 0} onClick={() => move(index, -1)} aria-label="Move up" className="grid size-9 place-items-center rounded-control text-muted hover:bg-hover hover:text-ink disabled:opacity-30">
                    <ArrowUp size={16} aria-hidden="true" />
                  </button>
                  <button type="button" disabled={index === routine.items.length - 1} onClick={() => move(index, 1)} aria-label="Move down" className="grid size-9 place-items-center rounded-control text-muted hover:bg-hover hover:text-ink disabled:opacity-30">
                    <ArrowDown size={16} aria-hidden="true" />
                  </button>
                  <button type="button" onClick={() => void save({ items: routine.items.filter((_, i) => i !== index) })} aria-label={`Remove ${exercise?.name ?? "exercise"}`} className="grid size-9 place-items-center rounded-control text-muted hover:bg-hover hover:text-danger">
                    <Trash2 size={16} aria-hidden="true" />
                  </button>
                </div>
                <div className="grid grid-cols-[auto_minmax(0,1fr)_minmax(0,1fr)] items-end gap-3 pl-7">
                  <div className="flex flex-col gap-1">
                    <span className="text-label text-muted">Sets</span>
                    <div className="flex items-center rounded-control border border-line-input bg-input shadow-control">
                      <button type="button" onClick={() => setItem(index, { sets: Math.max(1, item.sets - 1) })} aria-label="One set fewer" className="grid size-10 place-items-center text-muted hover:text-ink">
                        <Minus size={16} aria-hidden="true" />
                      </button>
                      <span className="w-6 text-center text-field font-semibold tabular-nums">{item.sets}</span>
                      <button type="button" onClick={() => setItem(index, { sets: Math.min(20, item.sets + 1) })} aria-label="One set more" className="grid size-10 place-items-center text-muted hover:text-ink">
                        <Plus size={16} aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                  <label className="flex flex-col gap-1">
                    <span className="text-label text-muted">Reps</span>
                    <input
                      defaultValue={item.reps}
                      placeholder="8–12"
                      maxLength={16}
                      onBlur={(event) => event.target.value !== item.reps && void setItem(index, { reps: event.target.value.trim() })}
                      className="h-10 w-full rounded-control border border-line-input bg-input px-3 text-field shadow-control focus:border-primary"
                    />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-label text-muted">Rest</span>
                    <select
                      value={item.restSeconds ?? ""}
                      onChange={(event) => void setItem(index, { restSeconds: event.target.value === "" ? null : Number(event.target.value) })}
                      className="h-10 w-full cursor-pointer rounded-control border border-line-input bg-input px-2 text-sm shadow-control"
                    >
                      {RESTS.map((seconds) => (
                        <option key={seconds ?? "default"} value={seconds ?? ""}>
                          {seconds === null ? `Usual (${clock(settings.restSeconds)})` : clock(seconds)}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              </li>
            );
          })}
        </ol>

        <ExercisePicker
          trigger={
            <Button variant="secondary" size="lg" className="h-12 w-full">
              <Plus size={18} aria-hidden="true" /> Add exercise
            </Button>
          }
          onPick={(exercise) => void save({ items: [...routine.items, { exerciseId: exercise.id, sets: 3, reps: "", restSeconds: null }] })}
        />
      </PageBody>
      <ConfirmDialog
        open={deleting}
        onOpenChange={setDeleting}
        title="Delete this routine?"
        description="Workouts done with it are kept."
        confirmLabel="Delete"
        onConfirm={() => {
          setDeleting(false);
          void device.remove("routine", [routine.id]).then(() => {
            toast("Routine deleted.");
            router.push("/routines");
          });
        }}
      />
    </>
  );
}
