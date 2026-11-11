"use client";

import { useEffect, useMemo } from "react";

import { useNow } from "@atlas/ui/use-now";

import { Loading } from "@/components/loading";
import { giveMissingCards } from "@/lib/actions";
import { useDictionary, useDictionaryOnPhone, useHsk } from "@/lib/local/data";
import { useReviewsSince, useSettings, useTexts, useWords } from "@/lib/local/hooks";
import { newLeftToday, newStartedSince, startOfDay } from "@/lib/review";
import { isNewCard } from "@/lib/words";

import type { Lookup } from "./face";
import { ReviewSession } from "./session";

// The Review screen: the words you're learning, each back just before
// you'd forget it (FSRS, src/lib/review.ts). Everything comes from the
// phone's copy, so it works offline like every screen.

export default function ReviewPage() {
  const words = useWords();
  const texts = useTexts();
  const settings = useSettings();
  const hsk = useHsk();
  // The dictionary only if it's on the phone already: reviewing doesn't start a 9 MB download.
  const onPhone = useDictionaryOnPhone();
  const dictionary = useDictionary(onPhone.cached === true);
  // When the screen opened: the session's queue is made once, from then.
  const startedAt = useNow(24 * 60 * 60_000);
  const today = useReviewsSince(startOfDay(startedAt));

  // Words put in review before cards existed get theirs now (the queue counts them as new either way).
  useEffect(() => {
    void giveMissingCards();
  }, []);

  const lookups = useMemo(() => {
    const list: Lookup | undefined = hsk
      ? (word) => {
          const entry = hsk.entry(word);
          return entry && { pinyin: entry.pinyin, defs: entry.gloss ? [entry.gloss] : [] };
        }
      : undefined;
    const fromDictionary: Lookup | undefined = dictionary
      ? (word) => {
          const readings = dictionary.lookup(word)?.readings;
          const reading = readings?.find((r) => !r.proper) ?? readings?.[0];
          return reading && { pinyin: reading.pinyin, defs: reading.definitions };
        }
      : undefined;
    return { list, dictionary: fromDictionary };
  }, [hsk, dictionary]);

  // Wait for the word list too, so a word with no text behind it still has its meaning on the first card.
  if (!words || !texts || !today || !hsk) return <Loading />;

  const newLeft = newLeftToday(settings.newPerDay, newStartedSince(today, startOfDay(startedAt)));
  const fresh = words.filter((word) => word.status === "learning" && isNewCard(word)).length;

  return (
    <ReviewSession
      words={words}
      texts={texts}
      newLeft={newLeft}
      startedAt={startedAt}
      audioSpeed={settings.audioSpeed}
      lookups={lookups}
      waiting={Math.max(0, fresh - newLeft)}
    />
  );
}
