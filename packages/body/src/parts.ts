import type { Joints } from "./figure";

// The parts of the body you can tap, as data. Each is a volume (an
// ellipsoid) placed from the figure's own joints, so it fits the male and
// the female figure alike, and a direction its side of the skin faces: the
// skin inside the volume that faces that way is the muscle. So a volume can
// be generous in depth and still never paint the far side of an arm.
// Units are metres; the figure faces +z, its left side at +x.

export type Vec3 = readonly [number, number, number];

export type Side = "left" | "right" | "center";

export type Part<G extends string = MuscleGroup> = {
  id: string;
  /** What it belongs to: a muscle group (both biceps), or a place (the left knee). */
  group: G;
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
  /** The way its fibres run, for the drawn striations; its y axis if not given. */
  fibers?: Vec3;
  /** How much it's drawn as a muscle (a rounded belly and fibres): 1 if not given; 0 for a plain place. */
  relief?: number;
  /** Drawn as warmth, not as a zone: its shade is full in its middle and fades to nothing at its edge. */
  soft?: boolean;
};

/** What a part is made from: all of it but its name and side. */
export type Spec = Omit<Part, "id" | "side" | "group">;

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

export const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const scale = (a: Vec3, k: number): Vec3 => [a[0] * k, a[1] * k, a[2] * k];
export const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const normalize = (a: Vec3): Vec3 => scale(a, 1 / Math.hypot(a[0], a[1], a[2]));
/** `t` of the way from one point to another. */
export const along = (a: Vec3, b: Vec3, t: number): Vec3 => add(a, scale(sub(b, a), t));
/** The way a limb runs, from one joint to the next. */
export const limb = (from: Vec3, to: Vec3) => normalize(sub(to, from));
/** Forward, square to a limb: so "the front of the thigh" stays the front as the leg angles out. */
export const frontOf = (axis: Vec3): Vec3 => normalize(cross(cross(axis, [0, 0, 1]), axis));
/** The same point or direction on the figure's other side. */
const mirror = (a: Vec3): Vec3 => [-a[0], a[1], a[2]];

/** A part on each side, from the left one's spec, mirrored. With `apart`, each side is its own group (`knee-left`), as a place is. */
export function sided<G extends string>(group: G, name: string, spec: Spec, apart = false): Part<G>[] {
  return (["left", "right"] as const).map((side) => {
    const m = side === "left" ? (v: Vec3) => v : mirror;
    return {
      ...spec,
      id: `${name}-${side}`,
      group: (apart ? `${group}-${side}` : group) as G,
      side,
      center: m(spec.center),
      ...(spec.up ? { up: m(spec.up) } : {}),
      ...(spec.facing ? { facing: m(spec.facing) } : {}),
      ...(spec.fibers ? { fibers: m(spec.fibers) } : {}),
    };
  });
}

/** A part on the middle of the body. */
export const middle = <G extends string>(group: G, id: string, spec: Spec): Part<G> => ({ ...spec, id, group, side: "center" });

/** Every muscle, placed for a figure's joints (Milo's muscle map). */
export function musclesFor(j: Joints): Part[] {
  const arm = limb(j.shoulder, j.elbow);
  const forearm = limb(j.elbow, j.wrist);
  const thigh = limb(j.hip, j.knee);
  const shin = limb(j.knee, j.ankle);
  const shoulderWidth = j.shoulder[0];

  return [
    ...sided("chest", "chest", {
      // Wide enough that the two meet at the breastbone: one chest, ringed once.
      center: [shoulderWidth * 0.44, j.shoulder[1] - 0.075, j.chest[2] + 0.1],
      radii: [shoulderWidth * 0.6, 0.085, 0.2],
      up: [-0.25, 1, 0],
      facing: [0.1, 0.15, 1],
      cut: 0.35,
      fibers: [1, 0.3, 0], // from the breastbone to the arm
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
      fibers: [-0.6, 1, 0.4],
    }),
    ...sided("back", "lat", {
      // Meeting at the spine, under the traps: the back reads as one muscle.
      center: [shoulderWidth * 0.5, j.chest[1] - 0.03, j.chest[2] - 0.1],
      radii: [shoulderWidth * 0.64, 0.15, 0.2],
      up: [0.3, 1, 0],
      facing: [0.25, 0, -1],
      cut: 0.3,
      fibers: [0.7, 1, 0], // up and out, to the arm
    }),
    ...sided("glutes", "glute", {
      center: [j.hip[0] * 0.75, j.pelvis[1] - 0.05, j.pelvis[2] - 0.1],
      radii: [0.09, 0.1, 0.2],
      facing: [0.1, 0, -1],
      cut: 0.3,
      fibers: [1, -0.7, 0],
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
      fibers: [1, -0.25, 0],
    }),
  ];
}

/** The parts of one group, e.g. both biceps. */
export const partsOf = <G extends string>(parts: Part<G>[], group: G): Part<G>[] => parts.filter((part) => part.group === group);

// --- Which part a point of skin belongs to ---------------------------------------

/**
 * A part ready for the maths: its centre, the matrix taking a point into its
 * unit sphere (so a distance under 1 is inside), and its facing. The shader
 * gets these as uniforms; tapping and tests use them in JavaScript.
 */
export type Compiled = {
  center: Vec3;
  matrix: [Vec3, Vec3, Vec3];
  facing: Vec3;
  cut: number;
  ring: number;
  /** Across its fibres (unit): fixed for the part, so its striations run straight and parallel. */
  across: Vec3;
  /** How much it's drawn as a muscle (its rounded belly and fibres): 1 for muscles, 0 for plain areas. */
  relief: number;
  /** 1 when its shade fades out from its middle, 0 when it fills the part to a crisp edge. */
  soft: number;
  /** For a soft part: the reach of its own skin nearest its centre, where its shade is full (see `fitted`). */
  core: number;
  /** For a soft part: the reach of its own skin farthest out, where its shade is gone. */
  edge: number;
};

/** How wide the picked part's outline is, in metres. */
export const RING = 0.011;

export function compile(part: Part<string>): Compiled {
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
    across: normalize(cross(normalize(part.fibers ?? y), part.facing ? normalize(part.facing) : z)),
    relief: part.relief ?? 1,
    soft: part.soft ? 1 : 0,
    core: 0,
    edge: 1,
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

/**
 * Fits each soft part's warmth to the skin it owns: its core (the reach of
 * that skin nearest the part's centre, all but a little) and its edge (of
 * that farthest out).
 * A volume's centre is inside the body, so the skin over the middle of a
 * thigh already sits half way out, and over the middle of the chest a tenth;
 * and a neighbour often takes the skin well before a volume ends (the
 * buttock over the top of the thigh). Fading from core to edge, not from 0
 * to 1, makes every place warmest in the middle of its own skin and gone
 * where the next place begins. `positions` and `normals` are the figure's,
 * three numbers a vertex.
 */
export function fitted(compiled: Compiled[], positions: ArrayLike<number>, normals: ArrayLike<number>): Compiled[] {
  if (!compiled.some((c) => c.soft)) return compiled;
  const reaches: number[][] = compiled.map(() => []);
  for (let i = 0; i < positions.length; i += 3) {
    const point: Vec3 = [positions[i]!, positions[i + 1]!, positions[i + 2]!];
    const index = partAt(compiled, point, [normals[i]!, normals[i + 1]!, normals[i + 2]!]);
    if (index >= 0) reaches[index]!.push(reach(compiled[index]!, point));
  }
  return compiled.map((c, index) => {
    const own = reaches[index]!.sort((a, b) => a - b);
    if (!c.soft || own.length === 0) return c;
    // Not the very nearest or farthest: stray vertices (inside an eye socket,
    // a fingertip, a fold) shouldn't pull the warmth to them or stretch it.
    const at = (share: number) => own[Math.floor((own.length - 1) * share)]!;
    const core = at(0.15);
    const edge = at(0.95);
    // Always some room to fade in, however thin the part's share of the skin.
    return { ...c, core, edge: Math.max(edge, core + 0.15) };
  });
}
