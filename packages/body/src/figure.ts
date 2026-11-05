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

/**
 * How deep in a crease each vertex sits, 0 to 1, and how far up a ridge, 0 to
 * 1: the grooves between muscles and the curve of each. From the mesh alone:
 * a vertex below the average of its neighbours (along its normal) is in a
 * hollow, above it on a ridge. Smoothed three times, so it follows the shapes of
 * muscles rather than the mesh's own facets, and scaled against the figure's
 * own deepest creases, so both figures shade alike. Cheap enough to work out
 * in the browser (a few milliseconds), so nothing more is downloaded.
 */
export function creasesOf(positions: Float32Array, normals: ArrayLike<number>, indices: Uint16Array): { crease: Float32Array; ridge: Float32Array } {
  const count = positions.length / 3;
  const neighbours: Set<number>[] = Array.from({ length: count }, () => new Set());
  for (let t = 0; t < indices.length; t += 3) {
    const [a, b, c] = [indices[t]!, indices[t + 1]!, indices[t + 2]!];
    neighbours[a]!.add(b).add(c);
    neighbours[b]!.add(a).add(c);
    neighbours[c]!.add(a).add(b);
  }
  let depth = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    let mx = 0, my = 0, mz = 0, edge = 0;
    for (const j of neighbours[i]!) {
      const dx = positions[j * 3]! - positions[i * 3]!;
      const dy = positions[j * 3 + 1]! - positions[i * 3 + 1]!;
      const dz = positions[j * 3 + 2]! - positions[i * 3 + 2]!;
      mx += dx; my += dy; mz += dz;
      edge += Math.hypot(dx, dy, dz);
    }
    const n = neighbours[i]!.size || 1;
    // Along the normal, as a share of the edge length: the same whatever the mesh's density.
    depth[i] = (mx * normals[i * 3]! + my * normals[i * 3 + 1]! + mz * normals[i * 3 + 2]!) / n / (edge / n || 1);
  }
  for (let pass = 0; pass < 3; pass++) {
    const next = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      let sum = depth[i]!;
      for (const j of neighbours[i]!) sum += depth[j]!;
      next[i] = sum / (neighbours[i]!.size + 1);
    }
    depth = next;
  }
  const sorted = Float32Array.from(depth).sort();
  const deep = Math.max(sorted[Math.floor(count * 0.97)]!, 1e-6);
  const high = Math.max(-sorted[Math.floor(count * 0.03)]!, 1e-6);
  const crease = new Float32Array(count);
  const ridge = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    crease[i] = Math.min(1, Math.max(0, depth[i]! / deep));
    ridge[i] = Math.min(1, Math.max(0, -depth[i]! / high));
  }
  return { crease, ridge };
}

const cache = new Map<Sex, BufferGeometry>();

/** The figure as three.js geometry, with smooth normals and its creases; made once per sex and kept. */
export function figureGeometry(sex: Sex): BufferGeometry {
  let geometry = cache.get(sex);
  if (!geometry) {
    geometry = new BufferGeometry();
    const positions = positionsOf(sex);
    const indices = triangles();
    geometry.setAttribute("position", new BufferAttribute(positions, 3));
    geometry.setIndex(new BufferAttribute(indices, 1));
    geometry.computeVertexNormals();
    const { crease, ridge } = creasesOf(positions, geometry.getAttribute("normal").array, indices);
    geometry.setAttribute("crease", new BufferAttribute(crease, 1));
    geometry.setAttribute("ridge", new BufferAttribute(ridge, 1));
    geometry.computeBoundingSphere();
    cache.set(sex, geometry);
  }
  return geometry;
}
