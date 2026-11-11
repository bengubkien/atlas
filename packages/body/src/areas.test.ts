import { describe, expect, it } from "vitest";

import { MAX_PARTS } from "./body-material";
import { areaFacing, areaName, AREAS, areasFor, isArea, type Area } from "./areas";
import { figureGeometry, jointsOf, type Sex } from "./figure";
import { organsFor } from "./organs";
import { compile, fitted, musclesFor, partAt, type Vec3 } from "./parts";

const SEXES: Sex[] = ["male", "female"];

function owners(sex: Sex) {
  const geometry = figureGeometry(sex);
  const position = geometry.getAttribute("position");
  const normal = geometry.getAttribute("normal");
  const parts = areasFor(jointsOf(sex));
  const compiled = parts.map((part) => compile(part));
  const at = (i: number) => partAt(compiled, [position.getX(i), position.getY(i), position.getZ(i)], [normal.getX(i), normal.getY(i), normal.getZ(i)]);
  return { parts, compiled, position, normal, at };
}

describe("the places on the body", () => {
  it("names each once, head to foot, and says them plainly", () => {
    expect(new Set(AREAS).size).toBe(AREAS.length);
    expect(AREAS.length).toBe(28);
    expect(areaName("knee-left")).toBe("Left knee");
    expect(areaName("hand-right")).toBe("Right wrist and hand");
    expect(areaName("lower-back")).toBe("Lower back");
    expect(isArea("knee-left")).toBe(true);
    expect(isArea("knee")).toBe(false);
    expect(areaName("buttock-left")).toBe("Left buttock");
    expect(areaFacing("lower-back")).toBe("back");
    expect(areaFacing("buttock-right")).toBe("back");
  });

  for (const sex of SEXES) {
    it(`covers the ${sex} figure: every place claims skin, the left on the left`, () => {
      const { parts, position, at } = owners(sex);
      expect(parts.length).toBeLessThanOrEqual(MAX_PARTS);
      expect(new Set(parts.map((p) => p.group))).toEqual(new Set(AREAS));
      const claimed = new Map<Area, number[]>();
      for (let i = 0; i < position.count; i++) {
        const index = at(i);
        if (index >= 0) claimed.set(parts[index]!.group, [...(claimed.get(parts[index]!.group) ?? []), i]);
      }
      for (const area of AREAS) {
        const vertices = claimed.get(area) ?? [];
        expect(vertices.length, area).toBeGreaterThan(20);
        const x = vertices.reduce((sum, i) => sum + position.getX(i), 0) / vertices.length;
        if (area.endsWith("-left")) expect(x, area).toBeGreaterThan(0.03);
        if (area.endsWith("-right")) expect(x, area).toBeLessThan(-0.03);
      }
    });

    it(`gives the skin nearest each joint to the joint, on the ${sex} figure`, () => {
      const { parts, position, at } = owners(sex);
      const j = jointsOf(sex);
      const nearest = (point: readonly [number, number, number]) => {
        let best = 0;
        let distance = Infinity;
        for (let i = 0; i < position.count; i++) {
          const d = Math.hypot(position.getX(i) - point[0], position.getY(i) - point[1], position.getZ(i) - point[2]);
          if (d < distance) [best, distance] = [i, d];
        }
        return best;
      };
      for (const [joint, area] of [["knee", "knee-left"], ["elbow", "elbow-left"], ["shoulder", "shoulder-left"]] as const) {
        const index = at(nearest(j[joint]));
        expect(index >= 0 ? parts[index]!.group : null, joint).toBe(area);
      }
      // The front of the chest and the middle of the back.
      const chestFront: Vec3 = [0.06, j.shoulder[1] - 0.12, 0.3];
      const backMiddle: Vec3 = [0.06, j.shoulder[1] - 0.12, -0.3];
      expect(parts[at(nearest(chestFront))]?.group).toBe("chest");
      expect(parts[at(nearest(backMiddle))]?.group).toBe("upper-back");
      // The small of the back is the lower back; the buttocks below it are their own.
      const behind = (x: number, y: number) => {
        let best = -1;
        for (let i = 0; i < position.count; i++) {
          if (Math.abs(position.getX(i) - x) > 0.015 || Math.abs(position.getY(i) - y) > 0.015) continue;
          if (best < 0 || position.getZ(i) < position.getZ(best)) best = i;
        }
        return best;
      };
      expect(parts[at(behind(0, (j.waist[1] + j.lowback[1]) / 2))]?.group).toBe("lower-back");
      expect(parts[at(behind(j.hip[0] * 0.7, j.pelvis[1]))]?.group).toBe("buttock-left");
      expect(parts[at(behind(j.hip[0] * 0.7, j.pelvis[1] - 0.08))]?.group).toBe("buttock-left");
    });

    it(`fits each place's warmth to its own skin on the ${sex} figure: a core, then room to fade, the two sides alike`, () => {
      const { parts, compiled, position, normal } = owners(sex);
      const fit = fitted(compiled, position.array, normal.array);
      const of = (id: string) => fit[parts.findIndex((part) => part.id === id)]!;
      for (const [index, part] of parts.entries()) {
        const { soft, core, edge } = fit[index]!;
        expect(soft, part.id).toBe(1);
        expect(core, part.id).toBeGreaterThan(0.2);
        expect(edge - core, part.id).toBeGreaterThanOrEqual(0.15);
        // A place's own skin ends inside its volume, or where a nearer place begins.
        expect(edge, part.id).toBeLessThanOrEqual(1);
        if (part.side !== "left") continue;
        const other = of(part.id.replace(/-left$/, "-right"));
        expect(Math.abs(other.core - core), part.id).toBeLessThan(0.05);
        expect(Math.abs(other.edge - edge), part.id).toBeLessThan(0.05);
      }
    });

    it(`leaves the ${sex} figure's muscles and organs crisp`, () => {
      const { position, normal } = owners(sex);
      for (const place of [musclesFor, organsFor]) {
        const compiled = place(jointsOf(sex)).map((part) => compile(part));
        expect(compiled.every((c) => c.soft === 0)).toBe(true);
        // Nothing to fit: the very same parts come back.
        expect(fitted(compiled, position.array, normal.array)).toBe(compiled);
      }
    });

    it(`leaves hardly any of the ${sex} figure out, fingertips and toes included`, () => {
      const { parts, position, at } = owners(sex);
      const j = jointsOf(sex);
      let out = 0;
      // The left hand's farthest skin from the wrist, and the left foot's farthest forward.
      const fromWrist = (i: number) => Math.hypot(position.getX(i) - j.wrist[0], position.getY(i) - j.wrist[1], position.getZ(i) - j.wrist[2]);
      let fingertip = -1;
      let toe = -1;
      for (let i = 0; i < position.count; i++) {
        if (at(i) < 0) out++;
        const hand = fromWrist(i) < 0.3 && position.getY(i) < j.wrist[1] && position.getX(i) > j.wrist[0] - 0.1;
        if (hand && (fingertip < 0 || fromWrist(i) > fromWrist(fingertip))) fingertip = i;
        const foot = position.getX(i) > 0.05 && position.getY(i) < 0.12;
        if (foot && (toe < 0 || position.getZ(i) > position.getZ(toe))) toe = i;
      }
      // What's left is the groin, on purpose, and slivers where places meet.
      expect(out / position.count).toBeLessThan(0.025);
      expect(parts[at(fingertip)]?.group).toBe("hand-left");
      expect(parts[at(toe)]?.group).toBe("foot-left");
    });
  }
});
