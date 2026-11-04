"use client";

import { Cloud, CloudOff, RefreshCw, TriangleAlert } from "lucide-react";

import { formatRelativeDays } from "@atlas/ui/format";

import { useSync } from "@/lib/local/hooks";
import { useLocale } from "@/lib/locale";

/** "Up to date", or how many changes wait on this phone for the server. */
export function SyncStatus({ className = "" }: { className?: string }) {
  const sync = useSync();
  const locale = useLocale();
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
    const minutes = Math.round((Date.now() - sync.lastSyncAt) / 60_000);
    text = minutes < 1 ? "Up to date with the server." : `Up to date with the server as of ${minutes < 60 ? `${minutes} min ago` : formatRelativeDays(-Math.round(minutes / 1440), locale)}.`;
  } else {
    text = "Not synced with the server yet.";
  }

  return (
    <p role="status" className={`flex items-start gap-2 text-meta text-muted ${className}`}>
      <span className="mt-0.5 shrink-0">{icon}</span>
      <span>{text}</span>
    </p>
  );
}
