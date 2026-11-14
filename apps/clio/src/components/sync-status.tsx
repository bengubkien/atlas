"use client";

import { SyncStatus as Status } from "@atlas/sync/react";

import { useSync } from "@/lib/local/hooks";
import { useLocale } from "@/lib/locale";

/** "Up to date", or how many changes wait on this device for the server. */
export function SyncStatus({ className = "" }: { className?: string }) {
  return <Status sync={useSync()} locale={useLocale()} className={className} />;
}
