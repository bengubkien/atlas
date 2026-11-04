"use client";

import { useSyncRuntime } from "@atlas/sync/react";

import { thisDevice } from "@/lib/local/device";

/** The screens the offline copy keeps (detail views are these pages with ?e=, ?w=, ?r=, ?m=). */
const PAGES = ["/", "/workout", "/history", "/muscles", "/exercises", "/routines", "/progress", "/settings"];

/** Keeps this device in step with the server, and installs the offline copy (see @atlas/sync). */
export function Runtime() {
  useSyncRuntime(thisDevice, { build: process.env.NEXT_PUBLIC_MILO_BUILD ?? "dev", pages: PAGES });
  return null;
}
