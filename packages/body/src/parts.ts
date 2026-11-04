import type { Joints } from "./figure";

// The parts of the body you can tap, as data. Each is a volume (an
// ellipsoid) placed from the figure's own joints, so it fits the male and
// the female figure alike, and a direction its side of the skin faces: the
// skin inside the volume that faces that way is the muscle. So a volume can
// be generous in depth and still never paint the far side of an arm.
// Units are metres; the figure faces +z, its left side at +x.

export type Vec3 = readonly [number, number, number];

export type Side = "left" | "right" | "center";

export type Part = {
  id: string;
  group: MuscleGroup;
  side: Side;
  center: Vec3;
  /** The volume's half-widths along its own x, y (up) and z. */
  radii: Vec3;
  /** Where the volume's y axis points; up if not given. */
  up?: Vec3;
  /** The way the muscle's skin faces; any way if not given. */
  facing?: Vec3;
  /** How squarely the skin must face that way: the cosine of the widest angle. */
  cut?: number;
};

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

/** Which way the figure turns to show a group picked from a list. */
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
const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const normalize = (a: Vec3): Vec3 => scale(a, 1 / Math.hypot(a[0], a[1], a[2]));
const lerp = (a: Vec3, b: Vec3, t: number): Vec3 => add(a, scale(sub(b, a), t));
/** The same point or direction on the figure's other side. */
const mirror = (a: Vec3): Vec3 => [-a[0], a[1], a[2]];

/** Every part, placed for a figure's joints. */
export function partsFor(j: Joints): Part[] {
  const along = (from: Vec3, to: Vec3, t: number) => lerp(from, to, t);
  const limb = (from: Vec3, to: Vec3) => normalize(sub(to, from));

  type Spec = Omit<Part, "id" | "side" | "group">;
  const sided = (group: MuscleGroup, name: string, spec: Spec): Part[] =>
    (["left", "right"] as const).map((side) => {
      const m = side === "left" ? (v: Vec3) => v : mirror;
      return {
        id: `${name}-${side}`,
        group,
        side,
        center: m(spec.center),
        radii: spec.radii,
        ...(spec.up ? { up: m(spec.up) } : {}),
        ...(spec.facing ? { facing: m(spec.facing) } : {}),
        ...(spec.cut !== undefined ? { cut: spec.cut } : {}),
      };
    });
  const middle = (group: MuscleGroup, id: string, spec: Spec): Part => ({ id, group, side: "center", ...spec });

  const arm = limb(j.shoulder, j.elbow);
  const forearm = limb(j.elbow, j.wrist);
  const thigh = limb(j.hip, j.knee);
  const shin = limb(j.knee, j.ankle);
  // Forward, square to a limb: so "the front of the thigh" stays the front as the leg angles out.
  const frontOf = (axis: Vec3): Vec3 => normalize(cross(cross(axis, [0, 0, 1]), axis));
  const shoulderWidth = j.shoulder[0];

  return [
    ...sided("chest", "chest", {
      // Wide enough that the two meet at the breastbone: one chest, ringed once.
      center: [shoulderWidth * 0.44, j.shoulder[1] - 0.075, j.chest[2] + 0.1],
      radii: [shoulderWidth * 0.6, 0.085, 0.2],
      up: [-0.25, 1, 0],
      facing: [0.1, 0.15, 1],
      cut: 0.35,
    }),
    ...sided("shoulders", "deltoid", {
      center: add(along(j.shoulder, j.elbow, 0.16), [0.02, 0.005, 0]),
      radii: [0.1, 0.13, 0.1],
      up: normalize(add(arm, [0, 0.9, 0])),
      facing: [1, 0.35, 0],
      cut: -0.1,
    }),
    ...sided("biceps", "biceps", {
      center: along(j.shoulder, j.elbow, 0.55),
      radii: [0.05, 0.11, 0.2],
      up: arm,
      facing: frontOf(arm),
      cut: 0.35,
    }),
    ...sided("triceps", "triceps", {
      center: along(j.shoulder, j.elbow, 0.5),
      radii: [0.055, 0.12, 0.2],
      up: arm,
      facing: scale(frontOf(arm), -1),
      cut: 0.25,
    }),
    ...sided("forearms", "forearm", {
      center: along(j.elbow, j.wrist, 0.45),
      radii: [0.066, 0.165, 0.066],
      up: forearm,
    }),
    ...sided("core", "oblique", {
      center: [shoulderWidth * 0.66, (j.waist[1] + j.pelvis[1]) / 2 + 0.03, j.belly[2] + 0.04],
      radii: [0.05, 0.12, 0.2],
      facing: [1, 0, 0.35],
      cut: 0.5,
    }),
    ...sided("back", "lat", {
      // Meeting at the spine, under the traps: the back reads as one muscle.
      center: [shoulderWidth * 0.5, j.chest[1] - 0.03, j.chest[2] - 0.1],
      radii: [shoulderWidth * 0.64, 0.15, 0.2],
      up: [0.3, 1, 0],
      facing: [0.25, 0, -1],
      cut: 0.3,
    }),
    ...sided("glutes", "glute", {
      center: [j.hip[0] * 0.75, j.pelvis[1] - 0.05, j.pelvis[2] - 0.1],
      radii: [0.09, 0.1, 0.2],
      facing: [0.1, 0, -1],
      cut: 0.3,
    }),
    ...sided("quads", "quad", {
      center: along(j.hip, j.knee, 0.45),
      radii: [0.085, 0.22, 0.2],
      up: thigh,
      facing: frontOf(thigh),
      cut: 0.3,
    }),
    ...sided("hamstrings", "hamstring", {
      center: along(j.hip, j.knee, 0.55),
      radii: [0.08, 0.19, 0.2],
      up: thigh,
      facing: scale(frontOf(thigh), -1),
      cut: 0.3,
    }),
    ...sided("calves", "calf", {
      center: along(j.knee, j.ankle, 0.3),
      radii: [0.06, 0.14, 0.2],
      up: shin,
      facing: scale(frontOf(shin), -1),
      cut: 0.2,
    }),
    middle("core", "abs", {
      center: [0, (j.waist[1] + j.pelvis[1]) / 2 + 0.06, j.belly[2] + 0.12],
      radii: [shoulderWidth * 0.36, 0.17, 0.2],
      facing: [0, 0, 1],
      cut: 0.6,
    }),
    middle("back", "traps", {
      center: [0, j.neck[1] - 0.075, j.chest[2] - 0.05],
      radii: [shoulderWidth * 0.75, 0.12, 0.2],
      facing: [0, 0.6, -1],
      cut: 0.2,
    }),
  ];
}

/** The parts of one group, e.g. both biceps. */
export const partsOf = (parts: Part[], group: MuscleGroup): Part[] => parts.filter((part) => part.group === group);

// --- Which part a point of skin belongs to ---------------------------------------

/**
 * A part ready for the maths: its centre, the matrix taking a point into its
 * unit sphere (so a distance under 1 is inside), and its facing. The shader
 * gets these as uniforms; tapping and tests use them in JavaScript.
 */
export type Compiled = { center: Vec3; matrix: [Vec3, Vec3, Vec3]; facing: Vec3; cut: number; ring: number };

/** How wide the picked part's outline is, in metres. */
export const RING = 0.011;

export function compile(part: Part): Compiled {
  const y = normalize(part.up ?? [0, 1, 0]);
  const x = normalize(cross(y, [0, 0, 1]));
  const z = cross(x, y);
  const [rx, ry, rz] = part.radii;
  return {
    center: part.center,
    // Rows: each local axis scaled by 1/radius, so matrix · (p − centre) is in the unit sphere.
    matrix: [scale(x, 1 / rx), scale(y, 1 / ry), scale(z, 1 / rz)],
    facing: part.facing ? normalize(part.facing) : [0, 0, 0],
    cut: part.facing ? (part.cut ?? 0.25) : -2,
    ring: RING / Math.min(rx, ry),
  };
}

/** How far into a part a point is: under 1 inside, 1 on its edge. */
export function reach(c: Compiled, point: Vec3): number {
  const d = sub(point, c.center);
  return Math.hypot(dot(c.matrix[0], d), dot(c.matrix[1], d), dot(c.matrix[2], d));
}

/** Whether skin with this normal faces the part's way. */
export const faces = (c: Compiled, normal: Vec3) => dot(c.facing, normal) >= c.cut;

/** The index of the part a point of skin (with its outward normal) belongs to, or -1. */
export function partAt(compiled: Compiled[], point: Vec3, normal: Vec3): number {
  let best = -1;
  let nearest = 1;
  compiled.forEach((c, index) => {
    const d = reach(c, point);
    if (d <= nearest && faces(c, normal)) {
      nearest = d;
      best = index;
    }
  });
  return best;
}
