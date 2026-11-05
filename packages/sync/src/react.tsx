"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { Cloud, CloudOff, RefreshCw, TriangleAlert } from "lucide-react";
import { useEffect } from "react";

import { formatRelativeDays } from "@atlas/ui/format";

import type { Device, SyncState } from "./device";
import type { Schemas } from "./records";
import { useNow } from "@atlas/ui/use-now";

export type SyncInfo = SyncState & { pending: number };

/** The device's sync state and how many changes wait, live. */
export function useSyncInfo<S extends Schemas>(device: () => Device<S>): SyncInfo | undefined {
  return useLiveQuery(async () => {
    const current = device();
    return { ...(await current.syncState()), pending: await current.pendingCount() };
  }, []);
}

/**
 * Keeps the device in step with the server: syncs when the app opens, when
 * the connection comes back, when you return to it, every 30 seconds while
 * it's on screen, and a moment after you change something. Also installs the
 * offline copy (in a production build) and asks the browser to keep the data.
 */
export function useSyncRuntime<S extends Schemas>(device: () => Device<S>, { build, pages }: { build: string; pages: string[] }) {
  useEffect(() => {
    const current = device();
    current.onChange = () => current.syncSoon();
    const sync = () => {
      if (document.visibilityState === "visible") void current.sync();
    };
    sync();
    window.addEventListener("online", sync);
    document.addEventListener("visibilitychange", sync);
    const interval = setInterval(sync, 30_000);

    // Without this, a browser may clear a site's data when space runs low.
    void navigator.storage?.persist?.().catch(() => undefined);

    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      const url = `/sw.js?v=${encodeURIComponent(build)}&pages=${encodeURIComponent(pages.join(","))}`;
      navigator.serviceWorker.register(url, { scope: "/" }).catch((error: unknown) => {
        console.warn("The offline copy didn't install:", error);
      });
    }

    return () => {
      current.onChange = null;
      window.removeEventListener("online", sync);
      document.removeEventListener("visibilitychange", sync);
      clearInterval(interval);
    };
    // The device and its pages are fixed for the app's life.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

/** "Up to date", or how many changes wait on this device for the server. */
export function SyncStatus({ sync, locale, className = "" }: { sync: SyncInfo | undefined; locale: string; className?: string }) {
  const now = useNow();
  if (!sync) return null;

  const waiting = sync.pending > 0 ? `${sync.pending} ${sync.pending === 1 ? "change waits" : "changes wait"} on this device` : null;
  let icon = <Cloud size={15} aria-hidden="true" />;
  let text: string;
  if (sync.status === "syncing") {
    icon = <RefreshCw size={15} aria-hidden="true" className="motion-safe:animate-spin" />;
    text = "Syncing…";
  } else if (sync.status === "offline") {
    icon = <CloudOff size={15} aria-hidden="true" />;
    text = `Offline. ${waiting ?? "Everything's on this device"}; it syncs when the server is back.`;
  } else if (sync.status === "error") {
    icon = <TriangleAlert size={15} aria-hidden="true" />;
    text = `The server refused a change${sync.error ? `: ${sync.error}` : "."} ${waiting ?? ""}`.trim();
  } else if (waiting) {
    text = `${waiting}, to sync shortly.`;
  } else if (sync.lastSyncAt) {
    const minutes = Math.round((now - sync.lastSyncAt) / 60_000);
    text =
      minutes < 1
        ? "Up to date with the server."
        : `Up to date with the server as of ${minutes < 60 ? `${minutes} min ago` : formatRelativeDays(-Math.round(minutes / 1440), locale)}.`;
  } else {
    text = "Not synced with the server yet.";
  }

  return (
    <p data-sync-status className={`flex items-start gap-2 text-meta text-muted ${className}`}>
      <span className="mt-0.5 shrink-0">{icon}</span>
      <span>{text}</span>
    </p>
  );
}
