"use client";

import { useEffect, useState } from "react";

/**
 * The time now, for what a screen shows ("3 days ago", today's date),
 * moving on every `every` milliseconds. Reading the clock while rendering
 * would make what's drawn depend on when React happens to render.
 */
export function useNow(every = 60_000): number {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), every);
    return () => clearInterval(timer);
  }, [every]);
  return now;
}
