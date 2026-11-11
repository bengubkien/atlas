"use client";

import { dayOf } from "./dates";
import { deviceKey, thisDevice } from "./local/device";
import { DEFAULT_SETTINGS, dayId, type Day, type Settings, type Word } from "./model";

// Every change goes through the device's copy (and from there to the server).

type Fields<T> = Partial<Omit<T, "id" | "updatedAt" | "deleted">>;

export async function saveSettings(patch: Fields<Settings>): Promise<void> {
  const device = thisDevice();
  const saved = await device.table("settings").get("settings");
  await device.put("settings", { ...DEFAULT_SETTINGS, ...saved, ...patch, id: "settings", deleted: false });
}

/**
 * Sets a word's state, keeping what the patch doesn't name. A word with no
 * record yet starts as `new`, from wherever the patch says it came from.
 */
export async function saveWord(headword: string, patch: Fields<Word> & Pick<Word, "source">): Promise<void> {
  const device = thisDevice();
  const saved = await device.table("word").get(headword);
  const start: Word = { id: headword, updatedAt: 0, deleted: false, status: "new", saved: false, source: patch.source, context: null, card: null };
  await device.put("word", { ...start, ...(saved && !saved.deleted ? saved : {}), ...patch, id: headword, deleted: false });
}

/** Adds to today's activity on this device: `addActivity({ seconds: 30 })`. */
export async function addActivity(add: Partial<Pick<Day, "seconds" | "reviews" | "textsFinished" | "wordsRead">>, now = Date.now()): Promise<void> {
  const device = thisDevice();
  const date = dayOf(now);
  const key = deviceKey();
  const id = dayId(date, key);
  await device.db.transaction("rw", device.db.tables, async () => {
    const saved = await device.table("day").get(id);
    const day: Day = saved && !saved.deleted ? saved : { id, updatedAt: 0, deleted: false, date, device: key, seconds: 0, reviews: 0, textsFinished: 0, wordsRead: 0 };
    await device.put("day", {
      ...day,
      seconds: day.seconds + (add.seconds ?? 0),
      reviews: day.reviews + (add.reviews ?? 0),
      textsFinished: day.textsFinished + (add.textsFinished ?? 0),
      wordsRead: day.wordsRead + (add.wordsRead ?? 0),
    });
  });
}
