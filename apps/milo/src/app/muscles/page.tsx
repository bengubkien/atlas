"use client";

import { Play, Plus, X } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";

import { BodyView, type Facing } from "@atlas/body/body-view";
import { useCssColors } from "@atlas/body/css-colors";
import { GROUP_FACING, MUSCLE_GROUPS, musclesFor, type MuscleGroup } from "@atlas/body/parts";
import { Button } from "@atlas/ui/components/button";
import { PageBody, PageHeader } from "@atlas/ui/components/page-header";
import { Panel, PanelList } from "@atlas/ui/components/panel";
import { SegmentedControl } from "@atlas/ui/components/segmented-control";
import { useNow } from "@atlas/ui/use-now";

import { Loading } from "@/components/loading";
import { MUSCLE_LABELS } from "@/lib/library";
import { thisDevice } from "@/lib/local/device";
import { useActiveWorkout, useAllSets, useExerciseMap, useExercises, useSettings, useWorkouts, useWorkoutSets } from "@/lib/local/hooks";
import { useFormat } from "@/lib/locale";
import { ago, balanceNotes, exercisesFor, MAPPED, planFor, RECENT_STEPS, recentStep, SET_STEPS, setStep, standings, type Standing } from "@/lib/muscles";
import { addPlan, startWorkout } from "@/lib/workout";

// The muscle map: the body, each muscle shaded by its sets in the last 7
// days, or by how recently it worked. Tap a muscle (on the body, or in the
// list, which says the same in words) for its exercises and a workout with
// them. The picked muscle is in the address (?m=chest), like Milo's other
// detail views, so the one offline page covers them all.

type View = "week" | "recent";

const VIEWS = [
  { value: "week", label: "Last 7 days" },
  { value: "recent", label: "Last trained" },
] as const;
const FACINGS = [
  { value: "front", label: "Front" },
  { value: "back", label: "Back" },
] as const;

const COLORS = {
  figure: "--color-body",
  outline: "--color-body-line",
  s1: "--color-body-milo-1",
  s2: "--color-body-milo-2",
  s3: "--color-body-milo-3",
  s4: "--color-body-milo-4",
} as const;

/** The CSS colour of a step, for swatches: the figure's own for 0. */
const stepColor = (step: number) => (step > 0 ? `var(--color-body-milo-${step})` : "var(--color-body)");

const isGroup = (value: string | null): value is MuscleGroup => MUSCLE_GROUPS.includes(value as MuscleGroup);

export default function MusclesPage() {
  return (
    <Suspense fallback={<Loading />}>
      <Muscles />
    </Suspense>
  );
}

function Muscles() {
  const router = useRouter();
  const param = useSearchParams().get("m");
  const selected = isGroup(param) ? param : null;
  const workouts = useWorkouts();
  const sets = useAllSets();
  const exerciseMap = useExerciseMap();
  const settings = useSettings();
  const [view, setView] = useState<View>("week");
  const [facing, setFacing] = useState<Facing>(selected ? GROUP_FACING[selected] : "front");
  const colors = useCssColors(COLORS);
  const detail = useRef<HTMLDivElement>(null);
  const now = useNow();

  // On a phone the details sit under the body: bring them into view when a muscle is picked there.
  useEffect(() => {
    const box = detail.current?.getBoundingClientRect();
    if (selected && box && box.top > window.innerHeight - 80) detail.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [selected]);

  if (!workouts || !sets || !exerciseMap) return <Loading />;

  const byMuscle = standings(workouts, sets, exerciseMap, now);
  const notes = balanceNotes(workouts, sets, exerciseMap, now);
  const stepOf = (standing: Standing) => (view === "week" ? setStep(standing.sets) : recentStep(standing.days));
  const shades = colors
    ? Object.fromEntries(
        [...byMuscle.values()].flatMap((standing) => {
          const step = stepOf(standing);
          return step > 0 ? [[standing.muscle, colors[`s${step}` as "s1"]]] : [];
        }),
      )
    : {};

  const pick = (muscle: MuscleGroup | null, turn = false) => {
    if (muscle && turn) setFacing(GROUP_FACING[muscle]);
    router.replace(muscle ? `/muscles?m=${muscle}` : "/muscles", { scroll: false });
  };
  const steps = view === "week" ? SET_STEPS : RECENT_STEPS;
  const trained = [...byMuscle.values()].some((standing) => standing.lastAt !== null);

  return (
    <>
      <PageHeader
        title="Muscles"
        description={
          trained
            ? "What each muscle has done lately. Tap one, on the body or in the list, for its exercises."
            : "Each muscle fills in as you train it. Tap one for its exercises."
        }
      />
      <PageBody className="max-w-[1120px] lg:grid lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start">
        <section aria-label="Body" className="flex min-w-0 flex-col rounded-panel border border-line-card bg-card">
          <div className="flex flex-wrap items-center justify-between gap-2 px-4 pt-4 lg:px-5">
            <SegmentedControl size="sm" aria-label="Shade by" options={VIEWS} value={view} onValueChange={setView} />
            <SegmentedControl size="sm" aria-label="Show the" options={FACINGS} value={facing} onValueChange={setFacing} />
          </div>
          {colors ? (
            <BodyView
              className="h-[460px] w-full lg:h-[600px]"
              sex={settings.body}
              parts={musclesFor}
              shades={shades}
              colors={{ figure: colors.figure, outline: colors.outline }}
              selected={selected}
              onSelect={(muscle) => pick(muscle)}
              facing={facing}
              onTurn={setFacing}
              label={view === "week" ? "A body, each muscle shaded by its sets in the last 7 days" : "A body, each muscle shaded by how recently it was trained"}
              fallback={<p className="p-6 text-sm text-muted">This device can&rsquo;t draw the 3D body. The list has everything it shows.</p>}
            />
          ) : (
            <div className="h-[460px] lg:h-[600px]" />
          )}
          <ul aria-label="What the shades mean" className="flex flex-wrap gap-x-4 gap-y-1.5 border-t border-line px-4 py-3 text-meta text-muted lg:px-5">
            {steps.map((step, index) => (
              <li key={step.label} className="flex items-center gap-1.5">
                <span aria-hidden="true" className="size-3 rounded-[3px] border border-line-field" style={{ backgroundColor: stepColor(index) }} />
                {step.label}
              </li>
            ))}
          </ul>
        </section>

        <div className="flex min-w-0 flex-col gap-4">
          <div ref={detail} className="scroll-mt-4">
            {selected && <MuscleDetail muscle={selected} standing={byMuscle.get(selected)!} onClose={() => pick(null)} />}
          </div>
          <Panel title="Every muscle">
            <PanelList>
              {MAPPED.map((muscle) => {
                const standing = byMuscle.get(muscle)!;
                return (
                  <li key={muscle}>
                    <button
                      type="button"
                      aria-pressed={selected === muscle}
                      onClick={() => pick(selected === muscle ? null : muscle, true)}
                      className="flex min-h-12 w-full items-center gap-3 px-4 py-2 text-left hover:bg-hover aria-pressed:bg-selected lg:px-6"
                    >
                      <span aria-hidden="true" className="size-3.5 shrink-0 rounded-[4px] border border-line-field" style={{ backgroundColor: stepColor(stepOf(standing)) }} />
                      <span className="flex-1 text-sm font-medium">{MUSCLE_LABELS[muscle]}</span>
                      <span className="text-meta text-muted tabular-nums">
                        {standing.sets} {standing.sets === 1 ? "set" : "sets"} · {ago(standing.days)}
                      </span>
                    </button>
                  </li>
                );
              })}
            </PanelList>
          </Panel>
          {notes.length > 0 && (
            <Panel title="Worth knowing">
              <ul className="flex flex-col gap-2 border-t border-line px-4 py-4 text-sm text-pretty lg:px-6">
                {notes.map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
            </Panel>
          )}
        </div>
      </PageBody>
    </>
  );
}

/** How many sets the plan lays out: last time's, and 3 for an exercise you haven't done. */
function setsSentence(chosen: { lastAt: number | null }[]): string {
  const done = chosen.filter((use) => use.lastAt !== null).length;
  if (done === 0) return "3 sets each";
  if (done === chosen.length) return "as many sets as last time";
  return "as many sets as last time, and 3 of a new one";
}

function MuscleDetail({ muscle, standing, onClose }: { muscle: MuscleGroup; standing: Standing; onClose: () => void }) {
  const router = useRouter();
  const exercises = useExercises();
  const workouts = useWorkouts();
  const sets = useAllSets();
  const active = useActiveWorkout();
  const activeSets = useWorkoutSets(active?.id);
  const f = useFormat();
  const [busy, setBusy] = useState(false);
  if (!exercises || !workouts || !sets) return null;

  const uses = exercisesFor(muscle, exercises, workouts, sets);
  const plan = planFor(uses);
  const name = MUSCLE_LABELS[muscle];
  const go = async () => {
    setBusy(true);
    if (active) await addPlan(thisDevice(), active.id, plan, activeSets ?? []);
    else await startWorkout(thisDevice(), { name, items: plan });
    router.push("/workout");
  };

  return (
    <Panel
      title={name}
      action={
        <button type="button" onClick={onClose} aria-label="Close" title="Close" className="grid size-8 place-items-center rounded-control text-muted hover:bg-hover hover:text-ink">
          <X size={16} aria-hidden="true" />
        </button>
      }
    >
      <p className="-mt-1 px-4 pb-3 text-meta text-muted lg:px-6">
        {standing.sets} {standing.sets === 1 ? "set" : "sets"} in the last 7 days · last trained {ago(standing.days)}
        {standing.lastAt !== null && standing.days !== null && standing.days > 1 ? ` (${f.day(standing.lastAt)})` : ""}
      </p>
      {plan.length > 0 && (
        <div className="flex flex-col gap-1.5 border-t border-line px-4 py-3 lg:px-6">
          <Button size="lg" className="w-full" disabled={busy} onClick={() => void go()}>
            {active ? <Plus size={17} aria-hidden="true" /> : <Play size={17} aria-hidden="true" />}
            {active ? "Add these to your workout" : `Start a ${name.toLowerCase()} workout`}
          </Button>
          <p className="text-meta text-muted">
            {plan.map((item) => uses.find((use) => use.exercise.id === item.exerciseId)!.exercise.name).join(", ")}, with{" "}
            {setsSentence(plan.map((item) => uses.find((use) => use.exercise.id === item.exerciseId)!))}.
          </p>
        </div>
      )}
      <PanelList>
        {uses.slice(0, 6).map((use) => (
          <li key={use.exercise.id}>
            <Link href={`/exercises?e=${encodeURIComponent(use.exercise.id)}`} className="flex min-h-12 flex-col justify-center gap-0.5 px-4 py-2 text-ink hover:bg-hover hover:text-ink lg:px-6">
              <span className="truncate text-sm font-medium">{use.exercise.name}</span>
              <span className="truncate text-meta text-muted">
                {use.lastAt !== null ? `Last time ${use.lastSets} ${use.lastSets === 1 ? "set" : "sets"}, ${f.day(use.lastAt)}` : "Not done yet"}
              </span>
            </Link>
          </li>
        ))}
      </PanelList>
    </Panel>
  );
}
