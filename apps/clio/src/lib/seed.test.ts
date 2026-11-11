import { describe, expect, it } from "vitest";

import { SEEDED } from "@atlas/sync/device";

import { textSchema, type Text } from "./model";
import { fingerprint, MAX_SAMPLES_VERSION, retiredSamples, sampleRecords, SAMPLES_FINGERPRINT, SAMPLES_VERSION } from "./seed";
import { SAMPLE_TEXTS } from "./samples";

const sample = (id: string, title = "我"): Text =>
  textSchema.parse({
    id,
    updatedAt: 0,
    deleted: false,
    kind: "story",
    band: 4,
    topic: "test",
    title: { zh: title, pinyin: "wǒ", en: "Me" },
    sentences: [{ id: "s1", tokens: [{ t: "我", w: "我" }], en: "Me." }],
    origin: "sample",
    createdAt: 1,
  });

describe("seeding the samples", () => {
  it("marks them as samples, alive and seeded", () => {
    const [record] = sampleRecords([{ ...sample("sample-a"), origin: "generated", deleted: true }]);
    expect(record).toMatchObject({ origin: "sample", deleted: false, updatedAt: SEEDED });
    expect(() => sampleRecords([sample("other")])).toThrow(/sample-/);
  });

  it("retires samples no longer shipped, not other texts", () => {
    const have = [sample("sample-a"), sample("sample-gone"), { ...sample("t-1"), origin: "generated" as const }];
    expect(retiredSamples(have, [sample("sample-a")]).map((text) => [text.id, text.deleted])).toEqual([["sample-gone", true]]);
  });

  it("notices a change in the samples", () => {
    expect(fingerprint([sample("sample-a")])).toBe(fingerprint([{ ...sample("sample-a"), updatedAt: 9 }]));
    expect(fingerprint([sample("sample-a")])).not.toBe(fingerprint([sample("sample-a", "你")]));
  });

  it("keeps the version between a seed and any real change", () => {
    expect(SAMPLES_VERSION).toBeGreaterThan(SEEDED);
    expect(SAMPLES_VERSION).toBeLessThan(MAX_SAMPLES_VERSION);
  });

  it("has a new version whenever the shipped samples change", () => {
    // If this fails, the samples changed: raise SAMPLES_VERSION in seed.ts by one and set SAMPLES_FINGERPRINT to this value.
    expect(fingerprint(SAMPLE_TEXTS), "Raise SAMPLES_VERSION and update SAMPLES_FINGERPRINT in src/lib/seed.ts").toBe(SAMPLES_FINGERPRINT);
  });

  it("ships samples that are valid texts with sample IDs", () => {
    for (const text of SAMPLE_TEXTS) {
      expect(text.id).toMatch(/^sample-/);
      expect(() => textSchema.parse(text)).not.toThrow();
    }
  });
});
