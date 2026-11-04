import { BufferAttribute, BufferGeometry } from "three";

import { FEMALE_DELTA, HEIGHTS, JOINTS, MALE, QUADS, SCALE } from "./figures";

// The realistic figure, unpacked from figures.ts (MakeHuman's base mesh, CC0):
// positions, triangles and joints, for the view and for tests.

export type Sex = "male" | "female";
export type Joint = keyof (typeof JOINTS)["male"];
export type Joints = Record<Joint, readonly [number, number, number]>;

export const jointsOf = (sex: Sex): Joints => JOINTS[sex];
export const heightOf = (sex: Sex): number => HEIGHTS[sex];

function bytes(base64: string): DataView {
  const text = atob(base64);
  const out = new Uint8Array(text.length);
  for (let i = 0; i < text.length; i++) out[i] = text.charCodeAt(i);
  return new DataView(out.buffer);
}

function int16s(base64: string): Int16Array {
  const view = bytes(base64);
  const out = new Int16Array(view.byteLength / 2);
  for (let i = 0; i < out.length; i++) out[i] = view.getInt16(i * 2, true);
  return out;
}

/** The figure's vertex positions, in metres: x, y, z per vertex. */
export function positionsOf(sex: Sex): Float32Array {
  const male = int16s(MALE);
  const delta = sex === "female" ? int16s(FEMALE_DELTA) : null;
  const out = new Float32Array(male.length);
  for (let i = 0; i < male.length; i++) out[i] = (male[i]! + (delta ? delta[i]! : 0)) / SCALE;
  return out;
}

/** MakeHuman's quads, each split into two triangles, keeping their winding (outward faces counter-clockwise). */
export function triangles(): Uint16Array {
  const view = bytes(QUADS);
  const count = view.byteLength / 8;
  const out = new Uint16Array(count * 6);
  for (let q = 0; q < count; q++) {
    const [a, b, c, d] = [0, 1, 2, 3].map((k) => view.getUint16(q * 8 + k * 2, true)) as [number, number, number, number];
    out.set([a, b, c, a, c, d], q * 6);
  }
  return out;
}

const cache = new Map<Sex, BufferGeometry>();

/** The figure as three.js geometry, with smooth normals; made once per sex and kept. */
export function figureGeometry(sex: Sex): BufferGeometry {
  let geometry = cache.get(sex);
  if (!geometry) {
    geometry = new BufferGeometry();
    geometry.setAttribute("position", new BufferAttribute(positionsOf(sex), 3));
    geometry.setIndex(new BufferAttribute(triangles(), 1));
    geometry.computeVertexNormals();
    geometry.computeBoundingSphere();
    cache.set(sex, geometry);
  }
  return geometry;
}
