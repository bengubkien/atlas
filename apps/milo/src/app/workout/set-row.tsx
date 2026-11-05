"use client";

import { Check } from "lucide-react";
import { useState } from "react";

import { cn } from "@atlas/ui/cn";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@atlas/ui/components/dropdown-menu";
import { toast } from "@atlas/ui/components/toast";

import { thisDevice } from "@/lib/local/device";
import type { Tracking, Units, WorkoutSet } from "@/lib/model";
import { clock, distanceNumber, parseClock, parseNumber, toKg, toMeters, weightNumber } from "@/lib/units";

import { startRest } from "./rest-timer";

/** "80 × 8", "+10 × 12", "1:30", "5 km · 25:00": a set, short. */
export function setSummary(set: Pick<WorkoutSet, "weightKg" | "reps" | "seconds" | "meters">, tracking: Tracking, units: Units): string {
  const unit = units.weight;
  switch (tracking) {
    case "load":
      return `${set.weightKg !== null ? weightNumber(set.weightKg, unit) : "–"} × ${set.reps ?? "–"}`;
    case "bodyweight":
      return set.weightKg ? `+${weightNumber(set.weightKg, unit)} × ${set.reps ?? "–"}` : `${set.reps ?? "–"} reps`;
    case "duration":
      return set.seconds !== null ? clock(set.seconds) : "–";
    case "cardio":
      return [set.meters !== null ? `${distanceNumber(set.meters, units.distance)} ${units.distance}` : null, set.seconds !== null ? clock(set.seconds) : null]
        .filter(Boolean)
        .join(" · ") || "–";
  }
}

type Fields = { weight: string; reps: string; time: string; distance: string };

const fieldsOf = (set: Pick<WorkoutSet, "weightKg" | "reps" | "seconds" | "meters"> | undefined, units: Units): Fields => ({
  weight: set?.weightKg !== null && set?.weightKg !== undefined ? weightNumber(set.weightKg, units.weight) : "",
  reps: set?.reps !== null && set?.reps !== undefined ? String(set.reps) : "",
  time: set?.seconds !== null && set?.seconds !== undefined ? clock(set.seconds) : "",
  distance: set?.meters !== null && set?.meters !== undefined ? distanceNumber(set.meters, units.distance) : "",
});

/** The values typed, with empty fields taken from the hint (last time); null where a value isn't a number. */
function readFields(fields: Fields, hint: Fields, units: Units) {
  const pick = (key: keyof Fields) => fields[key] || hint[key];
  const weight = parseNumber(pick("weight"));
  const reps = parseNumber(pick("reps"));
  const seconds = parseClock(pick("time"));
  const distance = parseNumber(pick("distance"));
  const bad = [weight, reps, seconds, distance].some((value) => value !== null && Number.isNaN(value));
  if (bad || (reps !== null && !Number.isInteger(reps))) return null;
  return {
    weightKg: weight === null ? null : toKg(weight, units.weight),
    reps,
    seconds,
    meters: distance === null ? null : toMeters(distance, units.distance),
  };
}

const input =
  "h-11 w-full min-w-0 rounded-control border border-line-input bg-input px-2 text-center text-field text-ink tabular-nums shadow-control placeholder:text-faint focus:border-primary disabled:bg-transparent disabled:shadow-none disabled:border-transparent";

/**
 * One set: its number (tap for warm-up or delete), last time's numbers, the
 * fields, and the tick. Typing saves when you leave a field; ticking with
 * empty fields takes last time's numbers, and starts the rest timer.
 */
export function SetRow({
  set,
  number,
  tracking,
  units,
  previous,
  restSeconds,
  editing = false,
}: {
  set: WorkoutSet;
  /** The set's number among the working sets; warm-ups show "W". */
  number: number;
  tracking: Tracking;
  units: Units;
  /** The same set last time, or the set before in this workout. */
  previous: WorkoutSet | undefined;
  /** Rest after ticking it off; 0 for none (within a superset, until its last exercise). */
  restSeconds: number;
  /** A finished workout being corrected: every set is kept, so there's nothing to tick. */
  editing?: boolean;
}) {
  const [fields, setFields] = useState<Fields>(() => fieldsOf(set, units));
  const hint = fieldsOf(previous, units);
  const device = thisDevice();

  const change = (key: keyof Fields) => (event: React.ChangeEvent<HTMLInputElement>) => setFields({ ...fields, [key]: event.target.value });

  const commit = () => {
    const values = readFields(fields, { weight: "", reps: "", time: "", distance: "" }, units);
    if (!values) return toast("That isn't a number: use digits, like 62.5.");
    void device.put("set", { ...set, ...values });
  };

  const tick = () => {
    if (set.done) {
      void device.put("set", { ...set, done: false });
      return;
    }
    const values = readFields(fields, hint, units);
    if (!values) return toast("That isn't a number: use digits, like 62.5.");
    const missing =
      (tracking === "load" && (values.weightKg === null || values.reps === null)) ||
      (tracking === "bodyweight" && values.reps === null) ||
      (tracking === "duration" && values.seconds === null) ||
      (tracking === "cardio" && values.meters === null && values.seconds === null);
    if (missing) return toast(tracking === "duration" ? "Enter the time first." : "Enter the weight and reps first.");
    setFields(fieldsOf({ ...set, ...values }, units));
    void device.put("set", { ...set, ...values, done: true });
    if (!set.warmup && restSeconds > 0) startRest(restSeconds);
  };

  const field = (key: keyof Fields, label: string, mode: "decimal" | "numeric" | "text", className = "") => (
    <input
      aria-label={`Set ${number}: ${label}`}
      inputMode={mode}
      autoComplete="off"
      enterKeyHint="next"
      value={fields[key]}
      placeholder={hint[key] || (key === "time" ? "0:00" : "")}
      onChange={change(key)}
      onBlur={commit}
      disabled={set.done && !editing}
      className={cn(input, className)}
    />
  );

  return (
    <div
      className={cn(
        "grid grid-cols-[36px_minmax(0,1fr)_72px_60px_44px] items-center gap-2 rounded-control px-1 py-1 sm:grid-cols-[40px_minmax(0,1fr)_96px_80px_44px]",
        set.done && "bg-[color-mix(in_srgb,var(--color-accent-milo)_12%,transparent)]",
      )}
    >
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label={`Set ${set.warmup ? "warm-up" : number}: more`}
          className={cn(
            "grid h-9 place-items-center rounded-control text-sm font-semibold tabular-nums hover:bg-hover",
            set.warmup ? "text-warning" : "text-muted",
          )}
        >
          {set.warmup ? "W" : number}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuItem onSelect={() => void device.put("set", { ...set, warmup: !set.warmup })}>
            {set.warmup ? "Make it a working set" : "Make it a warm-up"}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => void device.remove("set", [set.id])} className="text-danger">
            Delete set
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <span className="truncate text-center text-meta text-muted tabular-nums">{previous ? setSummary(previous, tracking, units) : "–"}</span>

      {tracking === "load" && (
        <>
          {field("weight", units.weight, "decimal")}
          {field("reps", "reps", "numeric")}
        </>
      )}
      {tracking === "bodyweight" && (
        <>
          {field("weight", `added ${units.weight}`, "decimal")}
          {field("reps", "reps", "numeric")}
        </>
      )}
      {tracking === "duration" && field("time", "time, minutes:seconds", "text", "col-span-2")}
      {tracking === "cardio" && (
        <>
          {field("distance", units.distance === "km" ? "kilometres" : "miles", "decimal")}
          {field("time", "time, minutes:seconds", "text")}
        </>
      )}

      {editing ? (
        <span aria-hidden="true" />
      ) : (
      <button
        type="button"
        onClick={tick}
        aria-label={set.done ? `Set ${number} done: undo` : `Set ${number}: done`}
        aria-pressed={set.done}
        className={cn(
          "grid size-11 place-items-center rounded-control border motion-safe:transition-colors",
          set.done
            ? "border-transparent bg-[var(--color-accent-milo)] text-white"
            : "border-line-control bg-input text-muted shadow-control hover:text-ink",
        )}
      >
        <Check size={20} strokeWidth={2.5} aria-hidden="true" />
      </button>
      )}
    </div>
  );
}
