import { describe, expect, it } from "vitest";

import { MAX_PARTS } from "./body-material";
import { figureGeometry, heightOf, jointsOf, positionsOf, triangles, type Sex } from "./figure";
import { compile, GROUP_FACING, MUSCLE_GROUPS, partAt, partsFor, reach, type Vec3 } from "./parts";

const SEXES: Sex[] = ["male", "female"];

/** Which part each vertex of a figure belongs to, by the same rule the shader paints with. */
function painted(sex: Sex) {
  const geometry = figureGeometry(sex);
  const position = geometry.getAttribute("position");
  const normal = geometry.getAttribute("normal");
  const parts = partsFor(jointsOf(sex));
  const compiled = parts.map((part) => compile(part));
  const owner: number[] = [];
  for (let i = 0; i < position.count; i++) {
    owner.push(partAt(compiled, [position.getX(i), position.getY(i), position.getZ(i)], [normal.getX(i), normal.getY(i), normal.getZ(i)]));
  }
  return { parts, owner, position, normal };
}

describe("the figure", () => {
  it("unpacks MakeHuman's body for both sexes", () => {
    const quads = triangles();
    expect(quads.length).toBe(13378 * 6);
    for (const sex of SEXES) {
      const positions = positionsOf(sex);
      expect(positions.length).toBe(13380 * 3);
      expect(Math.max(...quads)).toBeLessThan(13380);
      const ys = positions.filter((_, i) => i % 3 === 1);
      expect(Math.min(...ys)).toBeCloseTo(0, 3);
      expect(Math.max(...ys)).toBeCloseTo(heightOf(sex), 3);
    }
    expect(heightOf("male")).toBeGreaterThan(heightOf("female"));
  });

  it("faces +z with its left at +x, and its normals point outwards", () => {
    const j = jointsOf("male");
    expect(j.toe[2]).toBeGreaterThan(j.ankle[2]);
    expect(j.shoulder[0]).toBeGreaterThan(0);
    // The tip of the nose is the frontmost point of the head, and its normal points forward.
    const { position, normal } = painted("male");
    let front = 0;
    for (let i = 0; i < position.count; i++) if (position.getY(i) > 1.5 && position.getZ(i) > position.getZ(front)) front = i;
    expect(normal.getZ(front)).toBeGreaterThan(0.5);
  });
});

describe("the muscles", () => {
  it("fit in the shader, each group present, each part named once", () => {
    for (const sex of SEXES) {
      const parts = partsFor(jointsOf(sex));
      expect(parts.length).toBeLessThanOrEqual(MAX_PARTS);
      expect(new Set(parts.map((p) => p.group))).toEqual(new Set(MUSCLE_GROUPS));
      expect(new Set(parts.map((p) => p.id)).size).toBe(parts.length);
    }
  });

  it("measure distance as 0 at a part's centre and 1 at its edge", () => {
    const part = partsFor(jointsOf("male"))[0]!;
    const c = compile(part);
    expect(reach(c, part.center)).toBeCloseTo(0);
    const up = c.matrix[1].map((k) => k * part.radii[1] ** 2) as unknown as Vec3; // along the part's own y, one radius out
    expect(reach(c, [part.center[0] + up[0], part.center[1] + up[1], part.center[2] + up[2]])).toBeCloseTo(1, 5);
  });

  for (const sex of SEXES) {
    // The mesh is densest on the face and hands, so a calf holds a few dozen
    // vertices (the paint itself is per pixel); and it isn't quite mirrored, so
    // the sides differ a little.
    it(`each claims real skin on the ${sex} figure, about the same on both sides`, () => {
      const { parts, owner } = painted(sex);
      const count = (index: number) => owner.filter((o) => o === index).length;
      for (const [index, part] of parts.entries()) {
        expect(count(index), part.id).toBeGreaterThan(25);
        if (part.side === "left") {
          const twin = parts.findIndex((p) => p.id === part.id.replace(/-left$/, "-right"));
          expect(Math.abs(count(index) - count(twin)) / count(index), part.id).toBeLessThan(0.2);
        }
      }
    });

    it(`puts front muscles on the front and back ones behind, on the ${sex} figure`, () => {
      const { parts, owner, normal } = painted(sex);
      for (const [index, part] of parts.entries()) {
        if (["shoulders", "forearms", "core"].includes(part.group)) continue; // round the limb, or round the waist
        let z = 0;
        let n = 0;
        owner.forEach((o, i) => {
          if (o !== index) return;
          z += normal.getZ(i);
          n += 1;
        });
        if (GROUP_FACING[part.group] === "front") expect(z / n, part.id).toBeGreaterThan(0.3);
        else expect(z / n, part.id).toBeLessThan(-0.3);
      }
    });
  }
});
