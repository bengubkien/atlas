"use client";

import type { BodyWeight } from "./bodyweight";
import { useFromHygeia } from "./from-hygeia";

export type BodyWeights = { weights: BodyWeight[]; status: "loading" | "fresh" | "saved" | "none" | "no-hygeia" };

const read = (answer: unknown): BodyWeight[] | null => {
  const weights = (answer as { weights?: unknown } | null)?.weights;
  if (!Array.isArray(weights)) return null;
  return weights.filter((reading): reading is BodyWeight => Number.isFinite(reading?.at) && Number.isFinite(reading?.kg) && reading.kg > 0);
};

/** Your body weight from Hygeia (see useFromHygeia). */
export function useBodyWeights(): BodyWeights {
  const { value, status } = useFromHygeia("/api/atlas/weights", "milo.bodyweights.v2", read);
  return { weights: value ?? [], status };
}
