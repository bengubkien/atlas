"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";

import { useAppLinks } from "./links";

export type FromHygeia<T> = {
  value: T | null;
  /**
   * fresh: read from Hygeia now; loading: asking (the value, if any, is this
   * device's last copy); saved: Hygeia couldn't be reached, so it's the last
   * copy; none: never read; no-hygeia: Hygeia isn't set up here.
   */
  status: "loading" | "fresh" | "saved" | "none" | "no-hygeia";
};

const onStorage = (changed: () => void) => {
  window.addEventListener("storage", changed);
  return () => window.removeEventListener("storage", changed);
};

function stored(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null; // a private window may not allow it
  }
}

/**
 * Something Hygeia shares with Milo (your weight, what's been sore). The
 * browser asks Hygeia at its own address, as Atlas's Today does, and keeps
 * the answer on this device, so Milo shows it offline too. `read` checks an
 * answer's shape; give a function that doesn't change between renders.
 */
export function useFromHygeia<T>(path: string, key: string, read: (answer: unknown) => T | null): FromHygeia<T> {
  const hygeia = useAppLinks()?.hygeia ?? null;
  const raw = useSyncExternalStore(onStorage, () => stored(key), () => null);
  const saved = useMemo(() => {
    try {
      return raw ? read(JSON.parse(raw)) : null;
    } catch {
      return null;
    }
  }, [raw, read]);
  const [fetched, setFetched] = useState<{ value: T | null } | null>(null);

  useEffect(() => {
    if (!hygeia) return;
    let cancelled = false;
    fetch(`${hygeia}${path}`, { cache: "no-store", signal: AbortSignal.timeout(8000) })
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error(String(response.status)))))
      .then((answer: unknown) => {
        const value = read(answer);
        if (value === null) throw new Error("unexpected answer");
        try {
          localStorage.setItem(key, JSON.stringify(answer));
        } catch {
          // A private window may not keep it; it's only a copy.
        }
        if (!cancelled) setFetched({ value });
      })
      .catch(() => {
        if (!cancelled) setFetched({ value: null });
      });
    return () => {
      cancelled = true;
    };
  }, [hygeia, path, key, read]);

  if (fetched?.value) return { value: fetched.value, status: "fresh" };
  if (!hygeia) return saved ? { value: saved, status: "saved" } : { value: null, status: "no-hygeia" };
  if (!fetched) return { value: saved, status: "loading" };
  return saved ? { value: saved, status: "saved" } : { value: null, status: "none" };
}
