"use client";

import { Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@atlas/ui/components/button";
import { Panel } from "@atlas/ui/components/panel";
import { SegmentedControl } from "@atlas/ui/components/segmented-control";
import { toast } from "@atlas/ui/components/toast";

import { importChanges, planImport, type ImportPlan } from "@/lib/import";
import { thisDevice } from "@/lib/local/device";
import { useExercises, useSettings, useWorkouts } from "@/lib/local/hooks";
import { useFormat } from "@/lib/locale";
import type { Distance, Unit } from "@/lib/model";

/**
 * Brings workouts over from Strong or Hevy: pick the export, see what's in
 * it, then import. Nothing is saved before you say so, and importing the
 * same file again adds nothing.
 */
export function ImportPanel() {
  const router = useRouter();
  const settings = useSettings();
  const exercises = useExercises();
  const workouts = useWorkouts();
  const f = useFormat();
  const [text, setText] = useState<string | null>(null);
  const [fileName, setFileName] = useState("");
  const [units, setUnits] = useState<{ weight: Unit; distance: Distance }>({ weight: settings.unit, distance: settings.distance });
  const [busy, setBusy] = useState(false);

  const plan: ImportPlan | { error: string } | null = text !== null && exercises ? planImport(text, exercises, units) : null;
  const existing = new Set([...(workouts ?? []).map((w) => w.id), ...(exercises ?? []).map((e) => e.id)]);
  const fresh = plan && "workouts" in plan ? plan.workouts.filter(({ workout }) => !existing.has(workout.id)) : [];
  const already = plan && "workouts" in plan ? plan.workouts.length - fresh.length : 0;

  const pick = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > 30 * 1024 * 1024) return toast("That file is too big to be an export.");
    setFileName(file.name);
    setText(await file.text());
  };

  const run = async () => {
    if (!plan || "error" in plan) return;
    setBusy(true);
    const changes = importChanges(plan, existing);
    await thisDevice().save(changes);
    setBusy(false);
    setText(null);
    toast(`Imported ${fresh.length} ${fresh.length === 1 ? "workout" : "workouts"} from ${plan.source}.`);
    router.push("/history");
  };

  const sets = fresh.reduce((sum, { sets: list }) => sum + list.length, 0);
  const first = fresh[0]?.workout.startedAt;
  const last = fresh.at(-1)?.workout.startedAt;

  return (
    <Panel title="Import from another app">
      <div className="flex flex-col gap-4 border-t border-line px-4 py-5 lg:px-6">
        <p className="text-sm text-pretty text-muted">
          Your history from Strong or Hevy: export it as CSV in that app (in its settings), then pick the file here. Exercises are matched to Milo&apos;s by
          name; the others are added as your own.
        </p>
        <label className="flex flex-wrap items-center gap-3">
          <span className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-control border border-line-control bg-input px-4 text-sm font-medium shadow-control hover:bg-hover">
            <Upload size={15} aria-hidden="true" /> Choose the export
          </span>
          <input type="file" accept=".csv,text/csv" className="sr-only" onChange={(event) => void pick(event.target.files?.[0])} />
          {fileName && <span className="truncate text-meta text-muted">{fileName}</span>}
        </label>

        {plan && "error" in plan && (
          <p role="alert" className="text-sm text-error">
            {plan.error}
          </p>
        )}
        {plan && "workouts" in plan && (
          <div className="flex flex-col gap-4 rounded-card border border-line-card bg-surface p-4">
            {plan.unitsAsked && (
              <div className="flex flex-col gap-3">
                <p className="text-sm">Strong&apos;s file doesn&apos;t say its units. They&apos;re the ones you set in Strong:</p>
                <div className="flex flex-wrap gap-3">
                  <SegmentedControl<Unit>
                    size="sm"
                    aria-label="The file's weights are in"
                    value={units.weight}
                    onValueChange={(weight) => setUnits({ ...units, weight })}
                    options={[
                      { value: "kg", label: "kg" },
                      { value: "lb", label: "lb" },
                    ]}
                  />
                  <SegmentedControl<Distance>
                    size="sm"
                    aria-label="The file's distances are in"
                    value={units.distance}
                    onValueChange={(distance) => setUnits({ ...units, distance })}
                    options={[
                      { value: "km", label: "km" },
                      { value: "mi", label: "miles" },
                    ]}
                  />
                </div>
              </div>
            )}
            <ul className="flex flex-col gap-1 text-sm" aria-label="What's in the file">
              <li>
                <strong className="font-semibold">
                  {fresh.length} {fresh.length === 1 ? "workout" : "workouts"}
                </strong>
                , {sets} {sets === 1 ? "set" : "sets"}
                {first && last ? `, ${f.day(first)} to ${f.day(last)}` : ""}
              </li>
              {already > 0 && <li className="text-muted">{already} already here, left as they are</li>}
              <li className="text-muted">
                {plan.matched} {plan.matched === 1 ? "exercise" : "exercises"} Milo has
                {plan.newExercises.length > 0 && `, ${plan.newExercises.length} new: ${plan.newExercises.slice(0, 6).map((e) => e.name).join(", ")}${plan.newExercises.length > 6 ? "…" : ""}`}
              </li>
              {plan.skipped > 0 && <li className="text-muted">{plan.skipped} rows left out (rest timers, empty sets)</li>}
            </ul>
            <div className="flex flex-wrap gap-2">
              <Button disabled={busy || fresh.length === 0} onClick={() => void run()}>
                {busy ? "Importing…" : fresh.length ? `Import ${fresh.length} ${fresh.length === 1 ? "workout" : "workouts"}` : "Nothing new to import"}
              </Button>
              <Button variant="secondary" onClick={() => setText(null)}>
                Cancel
              </Button>
            </div>
          </div>
        )}
      </div>
    </Panel>
  );
}
