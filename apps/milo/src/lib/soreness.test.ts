import { describe, expect, it } from "vitest";

import { BUILT_IN_EXERCISES } from "./library";
import { cautionsFor, cautionText, recentSoreness, type Soreness } from "./soreness";

const now = Date.UTC(2026, 10, 5, 12);
const ago = (days: number) => now - days * 86_400_000;
const exercise = (name: string) => BUILT_IN_EXERCISES.find((each) => each.name === name)!;

describe("soreness from Hygeia", () => {
  const symptoms: Soreness[] = [
    { area: "knee-left", kind: "pain", severity: 6, at: ago(2) },
    { area: "knee-left", kind: "ache", severity: 3, at: ago(5) },
    { area: "hand-right", kind: "itch", severity: 4, at: ago(1) }, // doesn't load anything
    { area: "lower-back", kind: "stiffness", severity: 5, at: ago(9) }, // over a week ago
    { area: "tail-left", kind: "pain", severity: 5, at: ago(1) }, // a place Milo doesn't know
  ];

  it("keeps each place's latest ache, pain or the like from the last week", () => {
    expect(recentSoreness(symptoms, now)).toEqual([{ area: "knee-left", kind: "pain", severity: 6, at: ago(2) }]);
  });

  it("warns the exercises that load the place, and says it plainly", () => {
    const sore = recentSoreness(symptoms, now);
    expect(["Squat", "Running", "Walking lunge", "Bench press", "Lat pulldown"].map((name) => cautionsFor(exercise(name), sore).length)).toEqual([1, 1, 1, 0, 0]);
    expect(cautionText(sore[0]!, now)).toBe("Left knee: pain, 6 of 10, 2 days ago");
  });
});
