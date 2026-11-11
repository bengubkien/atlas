"use client";

import { SAMPLE_TEXTS, SAMPLES_VERSION } from "../samples";
import { retiredSamples, sampleRecords, seedVersion } from "../seed";
import { thisDevice } from "./device";

// Puts the sample texts on this device (src/lib/seed.ts says how they're
// versioned). Run on every start: it's a few dozen reads, and a sample
// already there at this version is skipped.

let seeding: Promise<number> | null = null;

export function seedSamples(): Promise<number> {
  seeding ??= (async () => {
    const device = thisDevice();
    const have = await device.table("text").where("id").startsWith("sample-").toArray();
    const records = [...sampleRecords(SAMPLE_TEXTS), ...retiredSamples(have, SAMPLE_TEXTS)];
    return device.seed(
      records.map((record) => ({ kind: "text" as const, record })),
      { at: seedVersion(SAMPLES_VERSION) },
    );
  })().finally(() => {
    seeding = null;
  });
  return seeding;
}
