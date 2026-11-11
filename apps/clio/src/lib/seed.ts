import { SEEDED } from "@atlas/sync/device";

import type { Text } from "./model";

// The sample texts that ship with the app, put on each device with
// `Device.seed` (src/lib/local/seed.ts). Seeded, not saved, so they're the
// oldest version there is: a text you delete stays deleted.
//
// When the samples change, raise SAMPLES_VERSION. Each device seeds them
// at that version (`seed(…, { at })`), which replaces the copies it seeded
// at an older one; the server and other devices take the new copy by the
// usual newer-wins rule. The version stays tiny next to a real change's
// time, so nothing you did is ever overwritten. A test fails when the
// samples change and the version doesn't (SAMPLES_FINGERPRINT).

/** Raise by one whenever src/lib/samples changes, and update the fingerprint (the test says to what). */
export const SAMPLES_VERSION = 2;
export const SAMPLES_FINGERPRINT = "00000000";

/** Stays well below any real time in milliseconds, so a sample can never beat a change you made. */
export const MAX_SAMPLES_VERSION = 1_000_000;

/** A short hash of the samples' content (FNV-1a over their JSON, `updatedAt` left out), to notice a change. */
export function fingerprint(texts: readonly Text[]): string {
  const json = JSON.stringify([...texts].sort((a, b) => (a.id < b.id ? -1 : 1)).map((text) => ({ ...text, updatedAt: 0 })));
  let hash = 0x811c9dc5;
  for (let i = 0; i < json.length; i++) {
    hash ^= json.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
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
