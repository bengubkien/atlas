import { SEEDED } from "@atlas/sync/device";

import type { Text } from "./model";

// The sample texts that ship with the app, put on each device with
// `Device.seed` (src/lib/local/seed.ts). Seeded, not saved, so they're the
// oldest version there is: a text you delete stays deleted.
//
// When the samples change, their SAMPLES_VERSION (src/lib/samples) goes up.
// Each device seeds them at `seedVersion(SAMPLES_VERSION)` (`seed(…, { at })`),
// which replaces the copies it seeded at an older version; the server and
// other devices take the new copy by the usual newer-wins rule. The
// version stays tiny next to a real change's time, so nothing you did is
// ever overwritten.

/** Stays well below any real time in milliseconds, so a sample can never beat a change you made. */
export const MAX_SAMPLES_VERSION = 1_000_000;

/** The `updatedAt` to seed the samples at: above SEEDED from version 1, so version 1 already replaces a plain seed. */
export function seedVersion(samplesVersion: number): number {
  if (!Number.isInteger(samplesVersion) || samplesVersion < 1 || samplesVersion >= MAX_SAMPLES_VERSION) throw new Error(`A samples version is a whole number from 1: ${samplesVersion}`);
  return SEEDED + samplesVersion;
}

/** The samples as records to seed: marked as samples, alive. */
export function sampleRecords(texts: readonly Text[]): Text[] {
  return texts.map((text) => {
    if (!text.id.startsWith("sample-")) throw new Error(`A sample text's ID starts with "sample-": ${text.id}`);
    return { ...text, origin: "sample", deleted: false, updatedAt: SEEDED };
  });
}

/**
 * Samples a device has that the app no longer ships, as deleted copies to
 * seed: they leave the library, unless they were changed for real (then
 * the seed doesn't replace them).
 */
export function retiredSamples(have: readonly Text[], shipped: readonly Text[]): Text[] {
  const ids = new Set(shipped.map((text) => text.id));
  return have.filter((text) => text.origin === "sample" && text.id.startsWith("sample-") && !ids.has(text.id) && !text.deleted).map((text) => ({ ...text, deleted: true }));
}
