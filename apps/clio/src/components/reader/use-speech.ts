"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

// Reading aloud, for now with the browser's own voices (speechSynthesis).
// Step 7d swaps the source for the text's recorded audio (`text.audio`,
// with word timings) behind this same hook: screens only ask whether it
// can play, what it's playing, and to play or stop.

export type SpeechItem = { id: string; text: string };

export type Speech = {
  /** Whether there's a Chinese voice to read with. Hide the controls when not. */
  available: boolean;
  /** The ID of the item being read now, or null. */
  speaking: string | null;
  /** Reads the items one after another, from the first. Stops anything already playing. */
  play: (items: readonly SpeechItem[]) => void;
  stop: () => void;
};

const hasSpeech = () => typeof window !== "undefined" && "speechSynthesis" in window;

/** Mainland Mandarin first; any other Chinese voice (Taiwan, Hong Kong) only if there's none. */
function chineseVoice(): SpeechSynthesisVoice | null {
  if (!hasSpeech()) return null;
  const voices = speechSynthesis.getVoices();
  const lang = (voice: SpeechSynthesisVoice) => voice.lang.replace("_", "-").toLowerCase();
  return (
    voices.find((voice) => lang(voice) === "zh-cn") ??
    voices.find((voice) => lang(voice).startsWith("cmn")) ??
    voices.find((voice) => lang(voice).startsWith("zh") && !lang(voice).includes("hk")) ??
    null
  );
}

function subscribe(listener: () => void) {
  if (!hasSpeech()) return () => {};
  // Voices load late in Chrome: the list is empty until this fires.
  speechSynthesis.addEventListener("voiceschanged", listener);
  return () => speechSynthesis.removeEventListener("voiceschanged", listener);
}

/** `rate` is the audio speed from Settings (1 as recorded). */
export function useSpeech(rate: number): Speech {
  const voice = useSyncExternalStore(subscribe, chineseVoice, () => null);
  const [speaking, setSpeaking] = useState<string | null>(null);
  // Each play gets a number, so the end of an utterance from an earlier one doesn't move the highlight.
  const run = useRef(0);

  const stop = useCallback(() => {
    run.current++;
    if (hasSpeech()) speechSynthesis.cancel();
    setSpeaking(null);
  }, []);

  const play = useCallback(
    (items: readonly SpeechItem[]) => {
      if (!voice || items.length === 0) return;
      speechSynthesis.cancel();
      const mine = ++run.current;
      const say = (at: number) => {
        const item = items[at];
        if (!item || run.current !== mine) {
          if (run.current === mine) setSpeaking(null);
          return;
        }
        const utterance = new SpeechSynthesisUtterance(item.text);
        utterance.voice = voice;
        utterance.lang = voice.lang;
        utterance.rate = rate;
        utterance.onstart = () => run.current === mine && setSpeaking(item.id);
        utterance.onend = () => say(at + 1);
        utterance.onerror = () => run.current === mine && setSpeaking(null);
        speechSynthesis.speak(utterance);
      };
      say(0);
    },
    [voice, rate],
  );

  // Leaving the screen stops it.
  useEffect(
    () => () => {
      run.current++;
      if (hasSpeech()) speechSynthesis.cancel();
    },
    [],
  );

  return { available: voice !== null, speaking, play, stop };
}
