import { describe, expect, it } from "vitest";

import { FIGURE, GROUP_FACING, MUSCLE_GROUPS, MUSCLE_PARTS, partsOf, type Shape, type Vec3 } from "./parts";

/** How far a point is inside an ellipsoid: under 1 inside, 1 on its surface. */
const inside = (point: Vec3, { center, radii }: Shape) =>
  Math.hypot((point[0] - center[0]) / radii[0], (point[1] - center[1]) / radii[1], (point[2] - center[2]) / radii[2]);

/** The closest distance from a point to the figure's rods. */
function toLimbs(point: Vec3): number {
  let best = Infinity;
  for (const { from, to, radius } of FIGURE.limbs) {
    const d: Vec3 = [to[0] - from[0], to[1] - from[1], to[2] - from[2]];
    const p: Vec3 = [point[0] - from[0], point[1] - from[1], point[2] - from[2]];
    const t = Math.max(0, Math.min(1, (p[0] * d[0] + p[1] * d[1] + p[2] * d[2]) / (d[0] ** 2 + d[1] ** 2 + d[2] ** 2)));
    best = Math.min(best, Math.hypot(p[0] - d[0] * t, p[1] - d[1] * t, p[2] - d[2] * t) - radius);
  }
  return best;
}

describe("the figure's muscles", () => {
  it("has every group, each part named once", () => {
    expect(new Set(MUSCLE_PARTS.map((part) => part.group))).toEqual(new Set(MUSCLE_GROUPS));
    expect(new Set(MUSCLE_PARTS.map((part) => part.id)).size).toBe(MUSCLE_PARTS.length);
    for (const group of MUSCLE_GROUPS) expect(GROUP_FACING[group]).toMatch(/^(front|back)$/);
  });

  it("puts paired muscles on both sides, mirrored", () => {
    for (const part of MUSCLE_PARTS.filter((p) => p.side === "left")) {
      const twin = MUSCLE_PARTS.find((p) => p.id === part.id.replace(/-left$/, "-right"));
      expect(twin, part.id).toBeDefined();
      expect(twin!.shape.center[0]).toBeCloseTo(-part.shape.center[0]);
      expect(twin!.shape.center[1]).toBeCloseTo(part.shape.center[1]);
      // The figure faces +z, so its left is at +x.
      expect(part.shape.center[0]).toBeGreaterThan(0);
    }
    expect(partsOf("biceps").map((p) => p.side).sort()).toEqual(["left", "right"]);
  });

  it("sits on the figure: each muscle's centre is within a few centimetres of its surface", () => {
    for (const part of MUSCLE_PARTS) {
      const fromBody = Math.min(...FIGURE.shapes.map((shape) => (inside(part.shape.center, shape) - 1) * Math.min(...shape.radii)));
      expect(Math.min(fromBody, toLimbs(part.shape.center)), part.id).toBeLessThan(0.03);
    }
  });

  it("faces the side it's on: front muscles in front, back ones behind", () => {
    for (const part of MUSCLE_PARTS) {
      if (["shoulders", "forearms"].includes(part.group)) continue; // round the limb, both sides
      const z = part.shape.center[2];
      if (GROUP_FACING[part.group] === "front") expect(z, part.id).toBeGreaterThan(0);
      else expect(z, part.id).toBeLessThan(0);
    }
  });
});
