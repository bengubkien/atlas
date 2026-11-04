// The body, as data: a stylised figure in an A-pose, built from rounded
// shapes, and the parts of it you can tap, each a raised pad on the figure.
// Units are metres, y is up, and the figure faces +z (towards you, in its
// front view), so its left side is at +x. Nothing here draws: body-view.tsx
// does, and tests can check the shapes without a browser.

export type Vec3 = readonly [number, number, number];

/** An ellipsoid: its centre, its three radii, and the direction its y radius points (up, unless given). */
export type Shape = { center: Vec3; radii: Vec3; up?: Vec3 };

/** A rounded rod between two points, for arms, legs and the neck. */
export type Limb = { from: Vec3; to: Vec3; radius: number };

export type Side = "left" | "right" | "center";

/** A part you can tap: the group it belongs to (e.g. "biceps"), and its side. */
export type Part = { id: string; group: MuscleGroup; side: Side; shape: Shape };

/** The muscle groups the figure has, the same as Milo's (less "whole body" and "cardio", which aren't places). */
export const MUSCLE_GROUPS = [
  "chest",
  "back",
  "shoulders",
  "biceps",
  "triceps",
  "forearms",
  "core",
  "quads",
  "hamstrings",
  "glutes",
  "calves",
] as const;
export type MuscleGroup = (typeof MUSCLE_GROUPS)[number];

/** Which way up a group faces, for turning the figure to show it when it's picked from a list. */
export const GROUP_FACING: Record<MuscleGroup, "front" | "back"> = {
  chest: "front",
  back: "back",
  shoulders: "front",
  biceps: "front",
  triceps: "back",
  forearms: "front",
  core: "front",
  quads: "front",
  hamstrings: "back",
  glutes: "back",
  calves: "back",
};

// --- Small vector helpers ------------------------------------------------------

const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const scale = (a: Vec3, k: number): Vec3 => [a[0] * k, a[1] * k, a[2] * k];
const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const length = (a: Vec3) => Math.hypot(a[0], a[1], a[2]);
export const normalize = (a: Vec3): Vec3 => scale(a, 1 / length(a));
/** The same point on the figure's other side. */
const mirror = (a: Vec3): Vec3 => [-a[0], a[1], a[2]];
const lerp = (a: Vec3, b: Vec3, t: number): Vec3 => add(a, scale(sub(b, a), t));

// --- Joints (the left side; the right mirrors it) --------------------------------

const SHOULDER: Vec3 = [0.2, 1.41, 0];
const ELBOW: Vec3 = [0.285, 1.13, 0];
const WRIST: Vec3 = [0.345, 0.875, 0.03];
const HIP: Vec3 = [0.09, 0.925, 0];
const KNEE: Vec3 = [0.102, 0.5, 0.015];
const ANKLE: Vec3 = [0.1, 0.09, -0.005];

/** A pad lying along a limb: `t` of the way from one end, pushed out by `offset`, its long radius along the limb. */
function onLimb(from: Vec3, to: Vec3, t: number, offset: Vec3, radii: Vec3): Shape {
  return { center: add(lerp(from, to, t), offset), radii, up: normalize(sub(to, from)) };
}

// --- The figure, which isn't tappable -------------------------------------------

type Figure = { shapes: Shape[]; limbs: Limb[] };

function figureSide(side: 1 | -1): Figure {
  const at = (v: Vec3): Vec3 => (side === 1 ? v : mirror(v));
  const forearm = normalize(sub(WRIST, ELBOW));
  return {
    shapes: [
      { center: at(SHOULDER), radii: [0.055, 0.055, 0.055] },
      { center: at(add(WRIST, scale(forearm, 0.07))), radii: [0.03, 0.062, 0.022], up: at(forearm) },
    ],
    limbs: [
      { from: at(SHOULDER), to: at(ELBOW), radius: 0.046 },
      { from: at(ELBOW), to: at(WRIST), radius: 0.039 },
      { from: at(HIP), to: at(KNEE), radius: 0.068 },
      { from: at(KNEE), to: at(ANKLE), radius: 0.047 },
      { from: at([0.1, 0.04, -0.035]), to: at([0.1, 0.035, 0.11]), radius: 0.035 },
    ],
  };
}

const left = figureSide(1);
const right = figureSide(-1);

export const FIGURE: Figure = {
  shapes: [
    { center: [0, 1.635, 0.005], radii: [0.092, 0.112, 0.1] }, // head
    { center: [0, 1.31, 0], radii: [0.175, 0.19, 0.108] }, // chest and upper back
    { center: [0, 1.1, 0.002], radii: [0.14, 0.17, 0.092] }, // waist
    { center: [0, 0.94, 0], radii: [0.158, 0.105, 0.1] }, // hips
    ...left.shapes,
    ...right.shapes,
  ],
  limbs: [{ from: [0, 1.47, -0.005], to: [0, 1.56, 0], radius: 0.047 }, ...left.limbs, ...right.limbs],
};

// --- The muscles ----------------------------------------------------------------

function musclesOn(side: "left" | "right"): Part[] {
  const s = side === "left" ? 1 : -1;
  const at = (v: Vec3): Vec3 => (s === 1 ? v : mirror(v));
  const part = (group: MuscleGroup, name: string, shape: Shape): Part => ({
    id: `${name}-${side}`,
    group,
    side,
    shape: { center: at(shape.center), radii: shape.radii, ...(shape.up ? { up: at(shape.up) } : {}) },
  });
  return [
    part("chest", "chest", { center: [0.074, 1.35, 0.074], radii: [0.086, 0.066, 0.046], up: normalize([-0.25, 1, 0]) }),
    part("shoulders", "deltoid", { center: [0.212, 1.402, 0], radii: [0.066, 0.078, 0.066], up: normalize([0.35, 1, 0]) }),
    part("biceps", "biceps", onLimb(SHOULDER, ELBOW, 0.52, [0, 0, 0.019], [0.038, 0.09, 0.035])),
    part("triceps", "triceps", onLimb(SHOULDER, ELBOW, 0.46, [0, 0, -0.021], [0.04, 0.095, 0.037])),
    part("forearms", "forearm", onLimb(ELBOW, WRIST, 0.36, [0, 0, 0.003], [0.047, 0.1, 0.045])),
    part("core", "oblique", { center: [0.106, 1.1, 0.04], radii: [0.042, 0.1, 0.056] }),
    part("back", "lat", { center: [0.088, 1.25, -0.066], radii: [0.087, 0.14, 0.046], up: normalize([0.28, 1, 0]) }),
    part("glutes", "glute", { center: [0.072, 0.91, -0.062], radii: [0.079, 0.086, 0.056] }),
    part("quads", "quad", onLimb(HIP, KNEE, 0.45, [0, 0, 0.025], [0.066, 0.18, 0.05])),
    part("hamstrings", "hamstring", onLimb(HIP, KNEE, 0.5, [0, 0, -0.025], [0.062, 0.17, 0.048])),
    part("calves", "calf", onLimb(KNEE, ANKLE, 0.3, [0, 0, -0.022], [0.043, 0.115, 0.046])),
  ];
}

const center = (group: MuscleGroup, id: string, shape: Shape): Part => ({ id, group, side: "center", shape });

/** Every muscle part on the figure. */
export const MUSCLE_PARTS: Part[] = [
  ...musclesOn("left"),
  ...musclesOn("right"),
  center("core", "abs", { center: [0, 1.11, 0.076], radii: [0.072, 0.135, 0.036] }),
  center("back", "traps", { center: [0, 1.43, -0.05], radii: [0.1, 0.075, 0.046] }),
];

/** The parts of one group, e.g. both biceps. */
export const partsOf = (group: MuscleGroup): Part[] => MUSCLE_PARTS.filter((part) => part.group === group);
