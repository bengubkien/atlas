"use client";

import { useCallback, useEffect, useRef } from "react";

import { addActivity } from "@/lib/actions";
import { pause, STOPPED, takeSeconds, tick, type Clock } from "@/lib/reading";

// Counts the time spent reading into today's activity (src/lib/reading.ts
// has the rule: active time, a capped amount for each pause). Saved every
// half minute and whenever the page is hidden or left, so little is lost
// if the phone sleeps.

const SAVE_EVERY_MS = 30_000;

/**
 * Starts counting while the screen is open. Returns `alive`, to call for
 * signs of life the page can't see itself (the audio still playing), and
 * `save`, to save what's counted now (before a summary that shows it).
 */
export function useReadingClock(): { alive: () => void; save: () => Promise<void> } {
  const clock = useRef<Clock>(STOPPED);

  const save = useCallback(async () => {
    const [seconds, rest] = takeSeconds(clock.current);
    clock.current = rest;
    if (seconds > 0) await addActivity({ seconds });
  }, []);

  const alive = useCallback(() => {
    clock.current = tick(clock.current, Date.now());
  }, []);

  useEffect(() => {
    alive();
    let lastScroll = 0;
    const onScroll = () => {
      // Scrolling fires many times a second; one tick a second is plenty.
      const now = Date.now();
      if (now - lastScroll < 1000) return;
      lastScroll = now;
      alive();
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        clock.current = pause(clock.current, Date.now());
        void save();
      } else alive();
    };
    // Time since the last sign of life is counted at the next one, so this saves only what's settled.
    const timer = setInterval(() => void save(), SAVE_EVERY_MS);
    window.addEventListener("pointerdown", alive, { passive: true });
    window.addEventListener("keydown", alive);
    window.addEventListener("scroll", onScroll, { passive: true });
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      clearInterval(timer);
      window.removeEventListener("pointerdown", alive);
      window.removeEventListener("keydown", alive);
      window.removeEventListener("scroll", onScroll);
      document.removeEventListener("visibilitychange", onVisibility);
      clock.current = pause(clock.current, Date.now());
      void save();
    };
  }, [alive, save]);

  return { alive, save };
}
