"use client";

import { saveWord } from "@/lib/actions";
import { thisDevice } from "@/lib/local/device";
import type { Reading, Text } from "@/lib/model";

// What the quiz writes to the device. Kept apart from the exercises' rules
// (src/lib/quiz.ts, pure) and from the screens.

/**
 * Puts the words you missed into review, unless they already are, or you
 * marked them known or set them aside on purpose. A word with no record
 * (known by its band) or one that's only `new` becomes `learning`, from
 * `reviewed` (changed by a check on it), with the sentence it came from.
 * Returns the words saved, for the feedback to say so.
 */
export async function saveMissedWords(text: Text, words: readonly string[], sentenceId: string | null): Promise<string[]> {
  const device = thisDevice();
  const saved: string[] = [];
  for (const word of words) {
    const record = await device.table("word").get(word);
    if (record && !record.deleted && record.status !== "new") continue;
    const sentence = sentenceId ?? text.sentences.find((s) => s.tokens.some((token) => token.w === word))?.id;
    await saveWord(word, {
      status: "learning",
      source: "reviewed",
      context: record && !record.deleted && record.context ? record.context : sentence ? { textId: text.id, sentenceId: sentence } : null,
    });
    saved.push(word);
  }
  return saved;
}

/** The latest score goes on the text's reading record: a retake replaces it. */
export async function saveQuizScore(textId: string, right: number, of: number, now = Date.now()): Promise<void> {
  const device = thisDevice();
  const saved = await device.table("reading").get(textId);
  const reading: Reading =
    saved && !saved.deleted ? saved : { id: textId, updatedAt: 0, deleted: false, startedAt: now, lastReadAt: now, finishedAt: null, furthest: 0, quiz: null };
  await device.put("reading", { ...reading, quiz: { right, of, at: now } });
}
