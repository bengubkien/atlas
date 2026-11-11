"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";

import { loadDictionary, type Dictionary } from "../dictionary";
import { loadHsk, type HskList } from "../hsk";

// The word data, loaded once per session.
//
// The HSK list is small (180 KB gzipped): it loads the first time anything
// asks for it. The dictionary is big (3.4 MB gzipped, 9 MB parsed): it loads
// only when something asks for it, and is then kept. Both files are
// /data/*.json; the service worker keeps them for offline (see
// @atlas/sync/service-worker), so "on this phone" means its cache has them.
//
// Screens use the hooks. Code that isn't a component uses the getters.

/** The cache the service worker keeps /data/*.json in. Not named by build: a new build revalidates the files instead. */
export const DATA_CACHE = "atlas-data";

type Status = "idle" | "loading" | "ready" | "error";

type Slot<T> = {
  status: Status;
  value: T | undefined;
  error: Error | undefined;
};

function slot<T>(load: () => Promise<T>) {
  let state: Slot<T> = { status: "idle", value: undefined, error: undefined };
  const listeners = new Set<() => void>();
  const set = (next: Slot<T>) => {
    state = next;
    for (const listener of listeners) listener();
  };
  return {
    get: () => state,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
    /** Starts loading if nothing has; always returns the promise for the value. */
    request(): Promise<T> {
      const promise = load();
      if (state.status === "idle" || state.status === "error") {
        set({ status: "loading", value: undefined, error: undefined });
        promise.then(
          (value) => set({ status: "ready", value, error: undefined }),
          (error: unknown) => set({ status: "error", value: undefined, error: error instanceof Error ? error : new Error(String(error)) }),
        );
      }
      return promise;
    },
  };
}

const hskSlot = slot(() => loadHsk());
// The dictionary ranks HSK words first, so it waits for the list. If the list
// can't load, search still works, only ranked without it.
const dictionarySlot = slot(async () => {
  const hsk = await loadHsk().catch(() => undefined);
  return loadDictionary({ hsk });
});

const serverState = { status: "idle", value: undefined, error: undefined } as const;

function useSlot<T>(source: ReturnType<typeof slot<T>>, enabled: boolean) {
  const state = useSyncExternalStore(source.subscribe, source.get, () => serverState as Slot<T>);
  const { status } = state;
  useEffect(() => {
    if (enabled && status === "idle") source.request().catch(() => undefined);
  }, [enabled, status, source]);
  return state;
}

/** The HSK list, loaded the first time it's asked for; the getter for code outside a component. */
export const getHsk = (): Promise<HskList> => hskSlot.request();

/** The dictionary, loaded the first time it's asked for and then kept. */
export const getDictionary = (): Promise<Dictionary> => dictionarySlot.request();

/** The HSK list, or undefined while it loads. See `useHskState` for failures. */
export function useHsk(): HskList | undefined {
  return useSlot(hskSlot, true).value;
}

/**
 * The dictionary, or undefined while it loads. It loads only when `enabled`
 * (default true): pass false to look without starting a 3 MB download.
 * See `useDictionaryState` for failures.
 */
export function useDictionary(enabled = true): Dictionary | undefined {
  return useSlot(dictionarySlot, enabled).value;
}

export type DataState<T> = {
  data: T | undefined;
  status: Status;
  /** Why it didn't load, in words, when status is "error". */
  error: string | undefined;
  /** Tries again after an error. */
  retry: () => void;
};

export function useHskState(): DataState<HskList> {
  const { value, status, error } = useSlot(hskSlot, true);
  const retry = useCallback(() => void hskSlot.request().catch(() => undefined), []);
  return { data: value, status, error: error?.message, retry };
}

export function useDictionaryState(enabled = true): DataState<Dictionary> {
  const { value, status, error } = useSlot(dictionarySlot, enabled);
  const retry = useCallback(() => void dictionarySlot.request().catch(() => undefined), []);
  return { data: value, status, error: error?.message, retry };
}

/** Whether the service worker's cache holds a data file. Null when the browser can't say (no Cache API, or a private window). */
export async function isCached(url: string): Promise<boolean | null> {
  try {
    if (typeof caches === "undefined") return null;
    return (await caches.match(url, { cacheName: DATA_CACHE })) !== undefined;
  } catch {
    return null;
  }
}

/**
 * Whether the dictionary is on this phone: in memory now or in the offline
 * cache. `cached` is null until the first check, and null in a browser with
 * no cache (then "on this phone" holds only for this session).
 */
export function useDictionaryOnPhone(): { cached: boolean | null; loaded: boolean; status: Status } {
  const status = useSyncExternalStore(dictionarySlot.subscribe, () => dictionarySlot.get().status, () => "idle" as Status);
  const [cached, setCached] = useState<boolean | null>(null);
  useEffect(() => {
    if (status === "loading") return;
    let live = true;
    const check = () =>
      void isCached("/data/dictionary.json").then((found) => {
        if (live) setCached(found);
      });
    check();
    // The worker puts the file away just after the page has it, so look again.
    const later = status === "ready" ? [setTimeout(check, 1500), setTimeout(check, 6000)] : [];
    return () => {
      live = false;
      later.forEach(clearTimeout);
    };
  }, [status]);
  return { cached, loaded: status === "ready", status };
}
