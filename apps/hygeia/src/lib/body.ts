import { AREAS, isArea, type Area } from "@atlas/body/areas";

import { addDays, dayOf } from "./health";
import type { Symptom, SymptomKind } from "./model";

// The body map's numbers: for each place, on how many days in the last 30
// you felt something there, and what and how bad the latest was. Days, not
// entries, so logging the same ache three times one afternoon counts once.

export const WINDOW_DAYS = 30;

export const KIND_LABELS: Record<SymptomKind, string> = {
  pain: "Pain",
  ache: "Ache",
  stiffness: "Stiffness",
  swelling: "Swelling",
  itch: "Itch",
  rash: "Rash",
  numbness: "Numbness",
  other: "Other",
};

export type Place = {
  area: Area;
  /** Days with something here in the last 30 (today and the 29 before). */
  days: number;
  /** The newest entry here, at any time; null if none. */
  last: Symptom | null;
  /** How bad the worst one in the last 30 days was, 0 if none. */
  worst: number;
};

/** Every place, with what's been felt there. Symptoms at places this build doesn't know are left out. */
export function places(symptoms: Symptom[], now = Date.now()): Map<Area, Place> {
  const from = addDays(dayOf(now), -(WINDOW_DAYS - 1));
  const result = new Map<Area, Place>(AREAS.map((area) => [area, { area, days: 0, last: null, worst: 0 }]));
  const days = new Map<Area, Set<string>>();
  for (const symptom of symptoms) {
    if (symptom.deleted || !isArea(symptom.area) || symptom.at > now) continue;
    const place = result.get(symptom.area)!;
    if (!place.last || symptom.at > place.last.at) place.last = symptom;
    const day = dayOf(symptom.at);
    if (day < from) continue;
    if (!days.has(symptom.area)) days.set(symptom.area, new Set());
    days.get(symptom.area)!.add(day);
    place.worst = Math.max(place.worst, symptom.severity);
  }
  for (const [area, set] of days) result.get(area)!.days = set.size;
  return result;
}

/** The shading steps: 0 none, then 1 day, 2–3, 4–7 and 8 or more, out of 30. */
export const DAY_STEPS = [
  { label: "None", test: (n: number) => n === 0 },
  { label: "1 day", test: (n: number) => n === 1 },
  { label: "2–3", test: (n: number) => n >= 2 && n <= 3 },
  { label: "4–7", test: (n: number) => n >= 4 && n <= 7 },
  { label: "8 or more", test: (n: number) => n >= 8 },
] as const;
export const dayStep = (days: number) => DAY_STEPS.findIndex((step) => step.test(days));

/** "Pain, 6 of 10". */
export const describe = (symptom: Pick<Symptom, "kind" | "severity">) => `${KIND_LABELS[symptom.kind]}, ${symptom.severity} of 10`;

/** The places with something in the last 30 days, most days first, then the latest first. */
export function recent(byArea: Map<Area, Place>): Place[] {
  return [...byArea.values()]
    .filter((place) => place.days > 0)
    .sort((a, b) => b.days - a.days || (b.last?.at ?? 0) - (a.last?.at ?? 0));
}
