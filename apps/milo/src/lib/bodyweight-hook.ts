"use client";

import { useEffect, useState } from "react";

import type { BodyWeight } from "./bodyweight";
import { useAppLinks } from "./links";

const KEY = "milo.bodyweights";

export type BodyWeights = {
  weights: BodyWeight[];
  /** fresh: read from Hygeia now; saved: this device's last copy (Hygeia couldn't be reached); none: never read. */
  status: "loading" | "fresh" | "saved" | "none" | "no-hygeia";
  fetchedAt: number | null;
};

function saved(): { weights: BodyWeight[]; fetchedAt: number } | null {
  try {
    const value = JSON.parse(localStorage.getItem(KEY) ?? "null") as { weights: BodyWeight[]; fetchedAt: number } | null;
    return value && Array.isArray(value.weights) ? value : null;
  } catch {
    return null;
  }
}

/**
 * Your body weight from Hygeia. The browser asks Hygeia at its own address
 * (as Atlas's Today does), and keeps the answer on this device, so Progress
 * shows it offline too.
 */
export function useBodyWeights(): BodyWeights {
  const hygeia = useAppLinks()?.hygeia ?? null;
  const [state, setState] = useState<BodyWeights>({ weights: [], status: "loading", fetchedAt: null });

  useEffect(() => {
    const copy = saved();
    if (copy) setState({ weights: copy.weights, status: "saved", fetchedAt: copy.fetchedAt });
    if (!hygeia) {
      if (!copy) setState({ weights: [], status: "no-hygeia", fetchedAt: null });
      return;
    }
    let cancelled = false;
    fetch(`${hygeia}/api/atlas/weights`, { cache: "no-store", signal: AbortSignal.timeout(8000) })
      .then((response) => (response.ok ? (response.json() as Promise<{ weights: BodyWeight[] }>) : Promise.reject(new Error(String(response.status)))))
      .then(({ weights }) => {
        const clean = weights.filter((reading) => Number.isFinite(reading.at) && Number.isFinite(reading.kg) && reading.kg > 0);
        const fetchedAt = Date.now();
        try {
          localStorage.setItem(KEY, JSON.stringify({ weights: clean, fetchedAt }));
        } catch {
          // A private window may not keep it; it's only a copy.
        }
        if (!cancelled) setState({ weights: clean, status: "fresh", fetchedAt });
      })
      .catch(() => {
        if (!cancelled && !copy) setState({ weights: [], status: "none", fetchedAt: null });
      });
    return () => {
      cancelled = true;
    };
  }, [hygeia]);

  return state;
}
