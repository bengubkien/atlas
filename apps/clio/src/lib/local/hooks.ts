"use client";

import { useSyncInfo, type SyncInfo } from "@atlas/sync/react";
import { useLiveQuery } from "dexie-react-hooks";
import { useMemo } from "react";

import { useNow } from "@atlas/ui/use-now";

import { dayOf } from "../dates";
import { DEFAULT_SETTINGS, type Day, type Reading, type Settings, type Text, type Word } from "../model";
import { wordBook } from "../words";
import { thisDevice } from "./device";

// Screens read this device's copy through these hooks; they update by
// themselves when anything changes, here or from a sync. `undefined` means
// still loading (a few milliseconds on first paint).

const alive = <T extends { deleted: boolean }>(records: T[]) => records.filter((record) => !record.deleted);

export function useSettings(): Settings {
  // Defaults first: a record saved before a setting existed doesn't have it.
  const saved = useLiveQuery(() => thisDevice().table("settings").get("settings"), []);
  return { ...DEFAULT_SETTINGS, ...saved };
}

/** The texts in the library, newest first. */
export function useTexts(): Text[] | undefined {
  return useLiveQuery(async () => alive(await thisDevice().table("text").toArray()).sort((a, b) => b.createdAt - a.createdAt), []);
}

/** One text; null when this device doesn't have it. */
export function useText(id: string): Text | null | undefined {
  return useLiveQuery(async () => {
    const text = await thisDevice().table("text").get(id);
    return text && !text.deleted ? text : null;
  }, [id]);
}

/** Every word record. */
export function useWords(): Word[] | undefined {
  return useLiveQuery(async () => alive(await thisDevice().table("word").toArray()), []);
}

/** Your word records by headword, for `statusOf` and `coverage` (src/lib/words.ts). */
export function useWordBook(): Map<string, Word> | undefined {
  const words = useWords();
  return useMemo(() => (words ? wordBook(words) : undefined), [words]);
}

/** How many words are due for review now; it updates every minute. */
export function useDueCount(): number | undefined {
  const now = useNow(60_000);
  return useLiveQuery(
    async () =>
      (await thisDevice().table("word").where("card.due").belowOrEqual(now).toArray()).filter((word) => !word.deleted && word.status === "learning").length,
    [now],
  );
}

/** How far you got in each text, by text ID. */
export function useReadings(): Map<string, Reading> | undefined {
  const readings = useLiveQuery(async () => alive(await thisDevice().table("reading").toArray()), []);
  return useMemo(() => (readings ? new Map(readings.map((reading) => [reading.id, reading])) : undefined), [readings]);
}

/** Every day's activity records, every device's (sum them with src/lib/activity.ts). */
export function useDays(): Day[] | undefined {
  return useLiveQuery(async () => alive(await thisDevice().table("day").toArray()), []);
}

/** Today's date on this device; it changes at midnight while the screen is open. */
export function useToday(): string {
  return dayOf(useNow(60_000));
}

export type { SyncInfo };

/** This device's sync state, live. */
export function useSync(): SyncInfo | undefined {
  return useSyncInfo(thisDevice);
}
