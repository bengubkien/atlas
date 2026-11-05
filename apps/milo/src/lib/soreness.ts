import { areaName, isArea } from "@atlas/body/areas";

import type { Exercise, Muscle } from "./model";

// What's been sore, from Hygeia's body map, and the exercises it should make
// you careful with: a sore knee warns squats, lunges, leg presses and runs.
// Itches and rashes don't load a joint, so only aches and the like count.

export type Soreness = { area: string; kind: string; severity: number; at: number };

/** A symptom counts this long after it was logged. */
export const RECENT_DAYS = 7;

const LOADING_KINDS = new Set(["pain", "ache", "stiffness", "swelling", "numbness", "other"]);

/** The muscles whose exercises load each place (by place, without its side). */
const LOADS: Record<string, Muscle[]> = {
  head: [],
  neck: ["shoulders", "back"],
  chest: ["chest", "triceps"],
  "upper-back": ["back", "shoulders"],
  belly: ["core"],
  "lower-back": ["back", "hamstrings", "glutes", "quads", "core", "full_body"],
  shoulder: ["shoulders", "chest", "back", "triceps"],
  "upper-arm": ["biceps", "triceps"],
  elbow: ["biceps", "triceps", "forearms", "chest", "back"],
  forearm: ["forearms", "biceps"],
  hand: ["forearms", "biceps", "back", "full_body"],
  hip: ["glutes", "quads", "hamstrings", "cardio"],
  buttock: ["glutes", "hamstrings"],
  thigh: ["quads", "hamstrings"],
  knee: ["quads", "hamstrings", "glutes", "calves", "cardio"],
  "lower-leg": ["calves", "cardio"],
  foot: ["calves", "cardio"],
};

const place = (area: string) => area.replace(/-(left|right)$/, "");

/** The latest of each place's recent symptoms that load a joint or muscle, newest first. */
export function recentSoreness(symptoms: Soreness[], now = Date.now()): Soreness[] {
  const latest = new Map<string, Soreness>();
  for (const symptom of symptoms) {
    if (!isArea(symptom.area) || !LOADING_KINDS.has(symptom.kind)) continue;
    if (symptom.at > now || now - symptom.at > RECENT_DAYS * 86_400_000) continue;
    const seen = latest.get(symptom.area);
    if (!seen || symptom.at > seen.at) latest.set(symptom.area, symptom);
  }
  return [...latest.values()].sort((a, b) => b.at - a.at);
}

/** The recent symptoms an exercise loads: none for most, the knee's for a squat. */
export function cautionsFor(exercise: Pick<Exercise, "muscle">, soreness: Soreness[]): Soreness[] {
  return soreness.filter((symptom) => (LOADS[place(symptom.area)] ?? []).includes(exercise.muscle));
}

/** "Left knee: pain, 6 of 10, 2 days ago". */
export function cautionText(symptom: Soreness, now = Date.now()): string {
  const days = Math.floor((now - symptom.at) / 86_400_000);
  const when = days <= 0 ? "today" : days === 1 ? "yesterday" : `${days} days ago`;
  const kind = symptom.kind === "other" ? "something" : symptom.kind;
  return `${isArea(symptom.area) ? areaName(symptom.area) : symptom.area}: ${kind}, ${symptom.severity} of 10, ${when}`;
}

/** The muscles a place loads, for saying what to go easy on. */
export const musclesLoaded = (area: string): Muscle[] => LOADS[place(area)] ?? [];
