"use client";

import { Plus, Search } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";

import { FormDialog } from "@atlas/ui/components/form-dialog";

import { EQUIPMENT_LABELS, MUSCLE_LABELS } from "@/lib/library";
import { thisDevice } from "@/lib/local/device";
import { useExercises } from "@/lib/local/hooks";
import { MUSCLES, newId, type Exercise, type Muscle } from "@/lib/model";

/**
 * Picks an exercise: search by name, narrow by muscle. A name that isn't in
 * the list can be added as a new exercise on the spot (its details can be set
 * later, under Exercises).
 */
export function ExercisePicker({ trigger, onPick, title = "Add an exercise" }: { trigger: ReactNode; onPick: (exercise: Exercise) => void; title?: string }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [muscle, setMuscle] = useState<Muscle | "">("");
  const exercises = useExercises();

  const shown = useMemo(() => {
    const words = query.toLowerCase().split(/\s+/).filter(Boolean);
    return (exercises ?? []).filter(
      (exercise) => (!muscle || exercise.muscle === muscle) && words.every((word) => exercise.name.toLowerCase().includes(word)),
    );
  }, [exercises, query, muscle]);
  const exact = shown.some((exercise) => exercise.name.toLowerCase() === query.trim().toLowerCase());

  const pick = (exercise: Exercise) => {
    setOpen(false);
    setQuery("");
    onPick(exercise);
  };

  const create = async () => {
    const exercise: Exercise = {
      id: newId(),
      updatedAt: 0,
      deleted: false,
      name: query.trim(),
      muscle: muscle || "full_body",
      equipment: "other",
      tracking: "load",
      notes: "",
    };
    await thisDevice().put("exercise", exercise);
    pick(exercise);
  };

  return (
    <FormDialog open={open} onOpenChange={setOpen} title={title} trigger={trigger}>
      <div className="flex flex-col gap-3">
        <div className="flex gap-2">
          <label className="relative min-w-0 flex-1">
            <span className="sr-only">Search</span>
            <Search size={16} aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted" />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search"
              autoComplete="off"
              className="h-11 w-full rounded-control border border-line-input bg-input pr-3 pl-9 text-field shadow-control focus:border-primary"
            />
          </label>
          <select
            aria-label="Muscle"
            value={muscle}
            onChange={(event) => setMuscle(event.target.value as Muscle | "")}
            className="h-11 w-32 shrink-0 cursor-pointer rounded-control border border-line-input bg-input px-2 text-sm shadow-control"
          >
            <option value="">All muscles</option>
            {MUSCLES.map((value) => (
              <option key={value} value={value}>
                {MUSCLE_LABELS[value]}
              </option>
            ))}
          </select>
        </div>
        <ul className="-mx-2 flex max-h-[min(52dvh,440px)] flex-col overflow-y-auto">
          {query.trim() && !exact && (
            <li>
              <button type="button" onClick={create} className="flex min-h-12 w-full items-center gap-3 rounded-control px-2 text-left hover:bg-hover">
                <Plus size={18} aria-hidden="true" className="text-muted" />
                <span className="text-sm">
                  New exercise <span className="font-medium">“{query.trim()}”</span>
                </span>
              </button>
            </li>
          )}
          {shown.map((exercise) => (
            <li key={exercise.id}>
              <button
                type="button"
                onClick={() => pick(exercise)}
                className="flex min-h-12 w-full flex-col justify-center rounded-control px-2 py-1.5 text-left hover:bg-hover"
              >
                <span className="text-sm font-medium">{exercise.name}</span>
                <span className="text-xs text-muted">
                  {MUSCLE_LABELS[exercise.muscle]} · {EQUIPMENT_LABELS[exercise.equipment]}
                </span>
              </button>
            </li>
          ))}
          {exercises && shown.length === 0 && !query.trim() && <li className="px-2 py-4 text-sm text-muted">No exercises for that muscle.</li>}
        </ul>
      </div>
    </FormDialog>
  );
}
