import { describe, expect, it } from "vitest";

import { figureGeometry, jointsOf, type Sex } from "./figure";
import { ORGANS, organsFor } from "./organs";
import { compile, partAt } from "./parts";

describe("the organs on the body", () => {
  for (const sex of ["male", "female"] as Sex[]) {
    it(`places each organ on the ${sex} figure where it is: the heart left, the liver right, the kidneys at the back`, () => {
      const geometry = figureGeometry(sex);
      const position = geometry.getAttribute("position");
      const normal = geometry.getAttribute("normal");
      const parts = organsFor(jointsOf(sex));
      const compiled = parts.map((part) => compile(part));
      const claimed = new Map<string, { x: number; nz: number; n: number }>();
      for (let i = 0; i < position.count; i++) {
        const index = partAt(compiled, [position.getX(i), position.getY(i), position.getZ(i)], [normal.getX(i), normal.getY(i), normal.getZ(i)]);
        if (index < 0) continue;
        const group = parts[index]!.group;
        const sum = claimed.get(group) ?? { x: 0, nz: 0, n: 0 };
        claimed.set(group, { x: sum.x + position.getX(i), nz: sum.nz + normal.getZ(i), n: sum.n + 1 });
      }
      for (const organ of ORGANS) expect(claimed.get(organ)?.n ?? 0, organ).toBeGreaterThan(10);
      const mean = (organ: string) => ({ x: claimed.get(organ)!.x / claimed.get(organ)!.n, nz: claimed.get(organ)!.nz / claimed.get(organ)!.n });
      expect(mean("heart").x).toBeGreaterThan(0.01); // the person's left
      expect(mean("liver").x).toBeLessThan(-0.01);
      expect(mean("kidneys").nz).toBeLessThan(-0.5); // facing back
      expect(mean("thyroid").nz).toBeGreaterThan(0.5);
    });
  }
});
