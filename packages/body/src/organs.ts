import type { Joints } from "./figure";
import { add, along, middle, sided, type Part } from "./parts";

// Where the organs lab tests are about sit, painted on the skin over them
// (the figure has no insides): the thyroid at the front of the neck, the
// heart left of the breastbone, the liver under the right ribs, the
// pancreas behind the stomach, the kidneys either side of the spine (seen
// from the back), the bladder low in the belly. Left is the person's own.

export const ORGANS = ["thyroid", "heart", "liver", "pancreas", "kidneys", "bladder"] as const;
export type Organ = (typeof ORGANS)[number];

export const ORGAN_NAMES: Record<Organ, string> = {
  thyroid: "Thyroid",
  heart: "Heart and circulation",
  liver: "Liver",
  pancreas: "Pancreas and blood sugar",
  kidneys: "Kidneys",
  bladder: "Bladder and urine",
};

export const isOrgan = (value: unknown): value is Organ => ORGANS.includes(value as Organ);

/** Which way the figure turns to show an organ. */
export const organFacing = (organ: Organ): "front" | "back" => (organ === "kidneys" ? "back" : "front");

/** The organs, placed for a figure's joints, drawn flat. */
export function organsFor(j: Joints): Part<Organ>[] {
  const front = (z: number) => z + 0.15;
  return [
    middle<Organ>("thyroid", "thyroid", { center: add(along(j.neck, j.head, 0.05), [0, -0.01, 0.06]), radii: [0.04, 0.025, 0.08], facing: [0, 0, 1], cut: 0.3, relief: 0 }),
    middle<Organ>("heart", "heart", { center: [0.04, j.shoulder[1] - 0.115, front(j.chest[2])], radii: [0.05, 0.055, 0.25], facing: [0, 0, 1], cut: 0.3, relief: 0 }),
    middle<Organ>("liver", "liver", { center: [-0.065, j.waist[1] + 0.035, front(j.belly[2])], radii: [0.085, 0.06, 0.25], facing: [0, 0, 1], cut: 0.2, relief: 0 }),
    middle<Organ>("pancreas", "pancreas", { center: [0.03, j.waist[1] - 0.025, front(j.belly[2])], radii: [0.06, 0.035, 0.25], facing: [0, 0, 1], cut: 0.2, relief: 0 }),
    ...sided<Organ>("kidneys", "kidney", { center: [0.06, j.waist[1] - 0.02, j.lowback[2] - 0.15], radii: [0.04, 0.06, 0.25], facing: [0.2, 0, -1], cut: 0.3, relief: 0 }),
    middle<Organ>("bladder", "bladder", { center: [0, j.pelvis[1] + 0.05, front(j.belly[2])], radii: [0.06, 0.045, 0.25], facing: [0, 0, 1], cut: 0.2, relief: 0 }),
  ];
}
