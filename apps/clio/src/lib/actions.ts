"use client";

import type { Change } from "@atlas/sync/records";

import { dayOf } from "./dates";
import { deviceKey, thisDevice } from "./local/device";
import { DEFAULT_SETTINGS, dayId, type Day, type Reading, type SCHEMAS, type Settings, type Word, type WordStatus } from "./model";

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

/** Sets many words at once (Words' select-many), in one save: each keeps what the patch doesn't name. */
export async function saveWords(headwords: readonly string[], patch: Fields<Word> & Pick<Word, "source">): Promise<void> {
  const device = thisDevice();
  const saved = await device.table("word").bulkGet([...headwords]);
  await device.save(
    headwords.map((headword, i) => {
      const start: Word = { id: headword, updatedAt: 0, deleted: false, status: "new", saved: false, source: patch.source, context: null, card: null };
      const had = saved[i];
      return { kind: "word" as const, record: { ...start, ...(had && !had.deleted ? had : {}), ...patch, id: headword, deleted: false } };
    }),
  );
}

/** Takes words back to "no record": known or new by their band again. Their schedule goes with them. */
export async function forgetWords(headwords: readonly string[]): Promise<void> {
  await thisDevice().remove("word", [...headwords]);
}

// --- Reading -----------------------------------------------------------------

type Context = NonNullable<Word["context"]>;

/**
 * Tapping a word in a text, to look it up. A word that counts as new goes
 * into review: it becomes `learning`, from `tapped`, with the sentence it
 * was met in, and the sheet says "Saved for review". That's what the
 * model's sources say a tap is (a word "looked up in a text"), and it's
 * what makes the finish rule fair: a word you tapped has a record, so
 * finishing never marks it known. Known, learning and ignored words are
 * only looked up, never changed by a tap. Returns whether it was saved.
 */
export async function tapWord(headword: string, status: WordStatus, context: Context): Promise<boolean> {
  if (status !== "new") return false;
  await saveWord(headword, { status: "learning", source: "tapped", context });
  return true;
}

/** "I know this", "Learning", "Ignore" in the word sheet: set by hand. */
export async function setWordStatus(headword: string, status: WordStatus, context: Context): Promise<void> {
  const saved = await thisDevice().table("word").get(headword);
  await saveWord(headword, { status, source: "marked", context: saved && !saved.deleted && saved.context ? saved.context : context });
}

/** Opening a text: starts its reading record, or notes that you had it open now. */
export async function openReading(textId: string, now = Date.now()): Promise<void> {
  const device = thisDevice();
  const saved = await device.table("reading").get(textId);
  if (saved && !saved.deleted) await device.put("reading", { ...saved, lastReadAt: now });
  else await device.put("reading", { id: textId, updatedAt: 0, deleted: false, startedAt: now, lastReadAt: now, finishedAt: null, furthest: 0, quiz: null });
}

/** Remembers the furthest sentence reached (by its place in the text). Never goes back. */
export async function saveFurthest(textId: string, furthest: number, now = Date.now()): Promise<void> {
  const device = thisDevice();
  const saved = await device.table("reading").get(textId);
  if (!saved || saved.deleted || saved.furthest >= furthest) return;
  await device.put("reading", { ...saved, furthest, lastReadAt: now });
}

/**
 * Finishing a text: marks `known` (each still without a record: see
 * `wordsToMarkKnown`) as known, and the reading as finished, in one save.
 * The first finish is kept as `finishedAt`; reading it again doesn't move it.
 */
export async function finishReading(textId: string, last: number, known: readonly string[], now = Date.now()): Promise<void> {
  const device = thisDevice();
  const saved = await device.table("reading").get(textId);
  const reading: Reading =
    saved && !saved.deleted ? saved : { id: textId, updatedAt: 0, deleted: false, startedAt: now, lastReadAt: now, finishedAt: null, furthest: 0, quiz: null };
  const changes: Change<typeof SCHEMAS>[] = [
    { kind: "reading", record: { ...reading, lastReadAt: now, finishedAt: reading.finishedAt ?? now, furthest: Math.max(reading.furthest, last) } },
    ...known.map((headword) => ({
      kind: "word" as const,
      record: { id: headword, updatedAt: 0, deleted: false, status: "known" as const, saved: false, source: "marked" as const, context: null, card: null },
    })),
  ];
  await device.save(changes);
}

/** Undoes the finish's marks: the words go back to having no record, so they count by their band again. */
export async function unmarkKnown(headwords: readonly string[]): Promise<void> {
  const device = thisDevice();
  const words = await device.table("word").bulkGet([...headwords]);
  // Only those still as finishing left them: one marked otherwise since keeps its mark.
  const untouched = words.filter((word) => word && !word.deleted && word.status === "known" && word.source === "marked" && word.context === null);
  await device.remove("word", untouched.map((word) => word!.id));
}
