"use client";

import { useFromHygeia } from "./from-hygeia";
import { recentSoreness, type Soreness } from "./soreness";

const read = (answer: unknown): Soreness[] | null => {
  const list = (answer as { symptoms?: unknown } | null)?.symptoms;
  if (!Array.isArray(list)) return null;
  return list.filter(
    (each): each is Soreness => typeof each?.area === "string" && typeof each?.kind === "string" && Number.isFinite(each?.severity) && Number.isFinite(each?.at),
  );
};

/** What's been sore in the last week, from Hygeia's body map (see useFromHygeia). */
export function useSoreness(): Soreness[] {
  const { value } = useFromHygeia("/api/atlas/symptoms", "milo.soreness", read);
  return recentSoreness(value ?? []);
}
