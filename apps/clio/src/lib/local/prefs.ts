"use client";

import { useCallback, useSyncExternalStore } from "react";

// The reader's text size: a per-device convenience, so it lives in
// localStorage, not in the synced settings (a phone and a desktop want
// different sizes, and saving settings from a fresh device would write its
// defaults over the other's choices).

const KEY = "clio-text-size";
const EVENT = "clio-text-size";

/** The sizes offered, in pixels. 22 is the default: large enough for characters to read at a glance on a phone. */
export const TEXT_SIZES = [18, 20, 22, 24, 27, 30] as const;
export const DEFAULT_TEXT_SIZE = 22;

function read(): number {
  try {
    const value = Number(localStorage.getItem(KEY));
    return (TEXT_SIZES as readonly number[]).includes(value) ? value : DEFAULT_TEXT_SIZE;
  } catch {
    return DEFAULT_TEXT_SIZE;
  }
}

let memory: number | null = null;

function subscribe(listener: () => void) {
  window.addEventListener(EVENT, listener);
  window.addEventListener("storage", listener);
  return () => {
    window.removeEventListener(EVENT, listener);
    window.removeEventListener("storage", listener);
  };
}

/** The text size and a way to change it; the change is kept for next time where storage allows. */
export function useTextSize(): [number, (size: number) => void] {
  const size = useSyncExternalStore(subscribe, () => memory ?? read(), () => DEFAULT_TEXT_SIZE);
  const set = useCallback((next: number) => {
    memory = next;
    try {
      localStorage.setItem(KEY, String(next));
    } catch {
      // Blocked storage: it lasts as long as the page (`memory`).
    }
    window.dispatchEvent(new Event(EVENT));
  }, []);
  return [size, set];
}
