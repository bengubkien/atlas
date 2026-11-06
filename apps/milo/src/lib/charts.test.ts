import { describe, expect, it } from "vitest";

import { niceMax, niceRange } from "@atlas/ui/components/charts";

describe("chart axes", () => {
  it("rounds a top from zero up to a clean number", () => {
    expect(niceMax(2)).toBe(2);
    expect(niceMax(13_400)).toBe(20_000);
    expect(niceMax(0)).toBe(1);
  });

  it("fits the axis to the data on round steps", () => {
    expect(niceRange(76, 105)).toEqual([70, 110]);
    expect(niceRange(101.3, 158.3)).toEqual([100, 160]);
    expect(niceRange(50, 50)).toEqual([49, 51]);
    // What's owed on a card goes below zero; data at or above zero never does.
    expect(niceRange(-345000, 0)).toEqual([-400000, 0]);
    expect(niceRange(0.2, 0.9)[0]).toBe(0);
  });
});
