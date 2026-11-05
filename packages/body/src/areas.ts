import type { Joints } from "./figure";
import { add, along, limb, middle, normalize, sided, scale, type Part, type Spec } from "./parts";

// The places on the body, for saying where you feel something (Hygeia's body
// map): plain areas, not muscles, so they're drawn flat. Joints are spheres
// round the joint and win over the limb next to them (the nearer volume
// takes the skin), so a tap near the knee is the knee. The torso's front and
// back are told apart by the way the skin faces; both reach round the sides,
// where the nearer takes the skin, so a flank is never left out. The groin
// is left out on purpose. Each side is its own place: the left knee isn't
// the right one. Left is the person's own left.

type Sided = "shoulder" | "upper-arm" | "elbow" | "forearm" | "hand" | "hip" | "buttock" | "thigh" | "knee" | "lower-leg" | "foot";
type Middle = "head" | "neck" | "chest" | "upper-back" | "belly" | "lower-back";

export type Area = Middle | `${Sided}-${"left" | "right"}`;

/** Every place, in the order a list shows them: head to foot, left before right. */
export const AREAS: Area[] = [
  "head",
  "neck",
  ...(["shoulder", "upper-arm", "elbow", "forearm", "hand"] as const).flatMap((p) => [`${p}-left`, `${p}-right`] as Area[]),
  "chest",
  "upper-back",
  "belly",
  "lower-back",
  ...(["hip", "buttock", "thigh", "knee", "lower-leg", "foot"] as const).flatMap((p) => [`${p}-left`, `${p}-right`] as Area[]),
];

const NAMES: Record<string, string> = {
  head: "Head",
  neck: "Neck",
  chest: "Chest",
  "upper-back": "Upper back",
  belly: "Belly",
  "lower-back": "Lower back",
  shoulder: "shoulder",
  "upper-arm": "upper arm",
  elbow: "elbow",
  forearm: "forearm",
  hand: "wrist and hand",
  hip: "hip",
  buttock: "buttock",
  thigh: "thigh",
  knee: "knee",
  "lower-leg": "lower leg",
  foot: "ankle and foot",
};

/** "Left knee", "Lower back". */
export function areaName(area: Area): string {
  const match = /^(.*)-(left|right)$/.exec(area);
  if (!match) return NAMES[area] ?? area;
  return `${match[2] === "left" ? "Left" : "Right"} ${NAMES[match[1]!] ?? match[1]}`;
}

export const isArea = (value: unknown): value is Area => AREAS.includes(value as Area);

/** Which way the figure turns to show a place picked from a list. */
export const areaFacing = (area: Area): "front" | "back" => (area === "upper-back" || area === "lower-back" || area.startsWith("buttock") ? "back" : "front");

/** Every place, placed for a figure's joints. */
export function areasFor(j: Joints): Part<Area>[] {
  const arm = limb(j.shoulder, j.elbow);
  const forearm = limb(j.elbow, j.wrist);
  const thigh = limb(j.hip, j.knee);
  const shin = limb(j.knee, j.ankle);
  // In the figure's pose the hand hangs lower and nearer the body than the
  // forearm points, so the hand's place follows the hand, to the fingertips.
  const hand = normalize(add(forearm, [-0.2, -0.15, 0]));
  const width = j.shoulder[0];
  const flat = (spec: Spec): Spec => ({ ...spec, relief: 0 });
  const place = (name: Sided, spec: Spec) => sided<Area>(name as Area, name, flat(spec), true);

  return [
    middle<Area>("head", "head", flat({ center: [0, (j.head[1] + j.crown[1]) / 2 - 0.02, j.head[2] + 0.01], radii: [0.11, 0.165, 0.17] })),
    middle<Area>("neck", "neck", flat({ center: add(along(j.neck, j.head, 0.3), [0, 0, 0.01]), radii: [0.1, 0.1, 0.11] })),
    middle<Area>("chest", "chest", flat({
      center: [0, j.shoulder[1] - 0.09, j.chest[2] + 0.1],
      radii: [width * 1.05, 0.16, 0.25],
      facing: [0, 0.2, 1],
      cut: -0.2,
    })),
    middle<Area>("upper-back", "upper-back", flat({
      center: [0, j.shoulder[1] - 0.08, j.chest[2] - 0.1],
      radii: [width * 1.05, 0.17, 0.25],
      facing: [0, 0.2, -1],
      cut: -0.2,
    })),
    middle<Area>("belly", "belly", flat({
      center: [0, (j.waist[1] + j.pelvis[1]) / 2, j.belly[2] + 0.1],
      radii: [width * 0.95, 0.15, 0.25],
      facing: [0, 0, 1],
      cut: -0.3,
    })),
    // The small of the back: from the ribs down to the top of the buttocks,
    // which are their own places below it.
    middle<Area>("lower-back", "lower-back", flat({
      center: [0, (j.waist[1] + j.lowback[1]) / 2 + 0.01, j.lowback[2] - 0.1],
      radii: [width * 0.95, 0.1, 0.25],
      facing: [0, 0, -1],
      cut: -0.3,
    })),
    ...place("shoulder", { center: add(j.shoulder, [0.02, 0.01, 0]), radii: [0.09, 0.09, 0.09] }),
    ...place("upper-arm", { center: along(j.shoulder, j.elbow, 0.55), radii: [0.08, 0.13, 0.085], up: arm }),
    ...place("elbow", { center: j.elbow, radii: [0.06, 0.06, 0.06] }),
    ...place("forearm", { center: along(j.elbow, j.wrist, 0.5), radii: [0.07, 0.14, 0.075], up: forearm }),
    ...place("hand", { center: add(j.wrist, scale(hand, 0.09)), radii: [0.095, 0.13, 0.095], up: hand }),
    ...place("hip", { center: add(j.hip, [0.035, 0, 0.03]), radii: [0.1, 0.1, 0.15] }),
    ...place("buttock", { center: [j.hip[0] * 0.7, j.pelvis[1] - 0.03, j.pelvis[2] - 0.1], radii: [0.1, 0.13, 0.2], facing: [0.15, -0.1, -1], cut: 0.2 }),
    ...place("thigh", { center: along(j.hip, j.knee, 0.52), radii: [0.14, 0.22, 0.15], up: thigh }),
    ...place("knee", { center: j.knee, radii: [0.08, 0.09, 0.1] }),
    ...place("lower-leg", { center: along(j.knee, j.ankle, 0.5), radii: [0.1, 0.22, 0.13], up: shin }),
    ...place("foot", { center: add(along(j.ankle, j.toe, 0.45), [0, -0.01, 0]), radii: [0.075, 0.08, 0.17] }),
  ];
}
