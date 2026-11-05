"use client";

import { useEffect, useState } from "react";

import { useAppLinks } from "./links";

export type FromHygeia<T> = {
  value: T | null;
  /** fresh: read from Hygeia now; saved: this device's last copy (Hygeia couldn't be reached); none: never read. */
  status: "loading" | "fresh" | "saved" | "none" | "no-hygeia";
};

/**
 * Something Hygeia shares with Milo (your weight, what's been sore). The
 * browser asks Hygeia at its own address, as Atlas's Today does, and keeps
 * the answer on this device, so Milo shows it offline too.
 */
export function useFromHygeia<T>(path: string, key: string, read: (answer: unknown) => T | null): FromHygeia<T> {
  const hygeia = useAppLinks()?.hygeia ?? null;
  const [state, setState] = useState<FromHygeia<T>>({ value: null, status: "loading" });

  useEffect(() => {
    let copy: T | null = null;
    try {
      copy = read(JSON.parse(localStorage.getItem(key) ?? "null"));
    } catch {
      copy = null;
    }
    if (copy !== null) setState({ value: copy, status: "saved" });
    if (!hygeia) {
      if (copy === null) setState({ value: null, status: "no-hygeia" });
      return;
    }
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
        if (!cancelled) setState({ value, status: "fresh" });
      })
      .catch(() => {
        if (!cancelled && copy === null) setState({ value: null, status: "none" });
      });
    return () => {
      cancelled = true;
    };
    // `read` is a pure parser given inline; the path and key say what's asked.
  }, [hygeia, path, key]);

  return state;
}
