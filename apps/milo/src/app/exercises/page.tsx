"use client";

import { Pencil, Plus, Search } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";

import { BackLink } from "@atlas/ui/components/back-link";
import { Button } from "@atlas/ui/components/button";
import { FormDialog } from "@atlas/ui/components/form-dialog";
import { Input } from "@atlas/ui/components/input";
import { PageBody, PageHeader } from "@atlas/ui/components/page-header";
import { Panel, PanelEmpty, PanelList, PanelRow } from "@atlas/ui/components/panel";
import { Select } from "@atlas/ui/components/select";
import { Textarea } from "@atlas/ui/components/textarea";
import { toast } from "@atlas/ui/components/toast";

import { LineChart } from "@atlas/ui/components/charts";
import { Loading } from "@/components/loading";
import { EQUIPMENT_LABELS, MUSCLE_LABELS, TRACKING_LABELS } from "@/lib/library";
import { thisDevice } from "@/lib/local/device";
import { useAllSets, useExerciseMap, useExercises, useSettings, useWorkouts } from "@/lib/local/hooks";
import { useFormat } from "@/lib/locale";
import { EQUIPMENT, MUSCLES, newId, TRACKING, unitsOf, type Exercise, type Muscle } from "@/lib/model";
import { estimatedMax, exerciseHistory, setScore } from "@/lib/stats";
import { fromKg } from "@/lib/units";

import { setSummary } from "../workout/set-row";

export default function ExercisesPage() {
  return (
    <Suspense fallback={<Loading />}>
      <Exercises />
    </Suspense>
  );
}

function Exercises() {
  const id = useSearchParams().get("e");
  const exercises = useExercises();
  const all = useExerciseMap();
  const [query, setQuery] = useState("");
  const [muscle, setMuscle] = useState<Muscle | "">("");

  const shown = useMemo(() => {
    const words = query.toLowerCase().split(/\s+/).filter(Boolean);
    return (exercises ?? []).filter((e) => (!muscle || e.muscle === muscle) && words.every((w) => e.name.toLowerCase().includes(w)));
  }, [exercises, query, muscle]);

  if (!exercises || !all) return <Loading />;
  if (id) {
    const exercise = all.get(id);
    return exercise ? <ExerciseDetail exercise={exercise} /> : <PageHeader title="Not here" description="That exercise isn't on this device." />;
  }

  return (
    <>
      <PageHeader title="Exercises" description="The built-in ones and your own. Each keeps its history and your best sets." actions={<ExerciseForm />} />
      <PageBody className="max-w-[720px]">
        <div className="flex gap-2">
          <label className="relative min-w-0 flex-1">
            <span className="sr-only">Search</span>
            <Search size={16} aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted" />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search"
              className="h-11 w-full rounded-control border border-line-input bg-input pr-3 pl-9 text-field shadow-control focus:border-primary"
            />
          </label>
          <select
            aria-label="Muscle"
            value={muscle}
            onChange={(event) => setMuscle(event.target.value as Muscle | "")}
            className="h-11 w-36 shrink-0 cursor-pointer rounded-control border border-line-input bg-input px-2 text-sm shadow-control"
          >
            <option value="">All muscles</option>
            {MUSCLES.map((value) => (
              <option key={value} value={value}>
                {MUSCLE_LABELS[value]}
              </option>
            ))}
          </select>
        </div>
        <Panel title={muscle ? MUSCLE_LABELS[muscle] : "All exercises"} count={shown.length}>
          {shown.length === 0 ? (
            <PanelEmpty>Nothing matches. Add it as your own exercise.</PanelEmpty>
          ) : (
            <PanelList>
              {shown.map((exercise) => (
                <PanelRow
                  key={exercise.id}
                  href={`/exercises?e=${exercise.id}`}
                  title={exercise.name}
                  meta={`${MUSCLE_LABELS[exercise.muscle]} · ${EQUIPMENT_LABELS[exercise.equipment]}`}
                />
              ))}
            </PanelList>
          )}
        </Panel>
      </PageBody>
    </>
  );
}

function ExerciseDetail({ exercise }: { exercise: Exercise }) {
  const workouts = useWorkouts();
  const sets = useAllSets();
  const settings = useSettings();
  const f = useFormat();
  if (!workouts || !sets) return <Loading />;

  const sessions = exerciseHistory(exercise, workouts, sets);
  const unit = settings.unit;
  const best = sessions
    .map((session) => session.best)
    .filter((set) => set !== null)
    .sort((a, b) => setScore(b, exercise.tracking) - setScore(a, exercise.tracking))[0];
  const bestMax = best && exercise.tracking === "load" ? estimatedMax(best.weightKg, best.reps) : null;
  const chartPoints = [...sessions]
    .reverse()
    .map((session) => ({
      key: session.workout.id,
      label: f.date(session.workout.startedAt),
      value: exercise.tracking === "load" ? (estimatedMax(session.best?.weightKg ?? null, session.best?.reps ?? null) ?? 0) : (session.best?.reps ?? 0),
    }))
    .filter((point) => point.value > 0);

  return (
    <>
      <PageHeader
        before={<BackLink href="/exercises" label="Exercises" />}
        title={exercise.name}
        description={`${MUSCLE_LABELS[exercise.muscle]} · ${EQUIPMENT_LABELS[exercise.equipment]} · ${TRACKING_LABELS[exercise.tracking]}`}
        actions={<ExerciseForm exercise={exercise} />}
      />
      <PageBody className="max-w-[720px]">
        {sessions.length === 0 ? (
          <Panel title="Not done yet">
            <PanelEmpty>Its sets and your best show here once you&apos;ve done it in a workout.</PanelEmpty>
          </Panel>
        ) : (
          <>
            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {[
                ["Best set", best ? setSummary(best, exercise.tracking, unitsOf(settings)) : "–"],
                ...(bestMax ? [["Estimated 1-rep max", `${Math.round(fromKg(bestMax, unit))} ${unit}`]] : []),
                ["Sessions", String(sessions.length)],
              ].map(([label, value]) => (
                <div key={label} className="flex flex-col gap-1 rounded-card border border-line-card bg-card px-4 py-3">
                  <dt className="text-label text-muted">{label}</dt>
                  <dd className="text-[22px] leading-tight font-semibold tabular-nums">{value}</dd>
                </div>
              ))}
            </dl>
            {chartPoints.length > 1 && (
              <LineChart
                title={exercise.tracking === "load" ? "Estimated 1-rep max" : "Most reps in a set"}
                description={exercise.tracking === "load" ? "From each session's best set (Epley's formula, sets of 12 reps or fewer)." : "Each session's best set."}
                labels={chartPoints}
                series={[{ name: exercise.tracking === "load" ? "Estimated 1-rep max" : "Reps", values: chartPoints.map((point) => point.value) }]}
                format={(value) => (exercise.tracking === "load" ? String(Math.round(fromKg(value, unit))) : String(value))}
                valueLabel={exercise.tracking === "load" ? `Estimated 1-rep max (${unit})` : "Reps"}
              />
            )}
            <Panel title="Sessions" count={sessions.length}>
              <PanelList>
                {sessions.map((session) => (
                  <PanelRow
                    key={session.workout.id}
                    href={`/history?w=${session.workout.id}`}
                    title={f.day(session.workout.startedAt)}
                    meta={session.sets.map((set) => setSummary(set, exercise.tracking, unitsOf(settings))).join(", ")}
                    detail={session.workout.name}
                  />
                ))}
              </PanelList>
            </Panel>
          </>
        )}
        {exercise.notes && <p className="text-sm text-pretty text-muted">{exercise.notes}</p>}
      </PageBody>
    </>
  );
}

/** "New exercise", or "Edit" on one: name, muscle, equipment, what its sets record. */
function ExerciseForm({ exercise }: { exercise?: Exercise }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const save = async (form: FormData) => {
    const value = (key: string) => String(form.get(key) ?? "");
    const name = value("name").trim().slice(0, 80);
    if (!name) return toast("Give it a name.");
    const record: Exercise = {
      id: exercise?.id ?? newId(),
      updatedAt: 0,
      deleted: false,
      name,
      muscle: value("muscle") as Exercise["muscle"],
      equipment: value("equipment") as Exercise["equipment"],
      tracking: value("tracking") as Exercise["tracking"],
      notes: value("notes").slice(0, 4000),
    };
    await thisDevice().put("exercise", record);
    setOpen(false);
    toast(exercise ? "Saved." : `Added ${name}.`);
    if (!exercise) router.push(`/exercises?e=${record.id}`);
  };
  return (
    <FormDialog
      open={open}
      onOpenChange={setOpen}
      title={exercise ? "Edit exercise" : "New exercise"}
      trigger={
        exercise ? (
          <Button variant="secondary">
            <Pencil size={15} aria-hidden="true" /> Edit
          </Button>
        ) : (
          <Button>
            <Plus size={16} aria-hidden="true" /> New exercise
          </Button>
        )
      }
    >
      <form action={save} className="flex flex-col gap-4">
        <Input name="name" label="Name" defaultValue={exercise?.name} required maxLength={80} autoComplete="off" />
        <div className="grid grid-cols-2 gap-4">
          <Select name="muscle" label="Muscle" defaultValue={exercise?.muscle ?? "chest"}>
            {MUSCLES.map((value) => (
              <option key={value} value={value}>
                {MUSCLE_LABELS[value]}
              </option>
            ))}
          </Select>
          <Select name="equipment" label="Equipment" defaultValue={exercise?.equipment ?? "barbell"}>
            {EQUIPMENT.map((value) => (
              <option key={value} value={value}>
                {EQUIPMENT_LABELS[value]}
              </option>
            ))}
          </Select>
        </div>
        <Select name="tracking" label="Each set records" defaultValue={exercise?.tracking ?? "load"}>
          {TRACKING.map((value) => (
            <option key={value} value={value}>
              {TRACKING_LABELS[value]}
            </option>
          ))}
        </Select>
        <Textarea name="notes" label="Notes" rows={2} defaultValue={exercise?.notes} placeholder="Grip, seat height, cues…" />
        <div className="flex justify-end">
          <Button type="submit" size="lg">
            Save
          </Button>
        </div>
      </form>
    </FormDialog>
  );
}

