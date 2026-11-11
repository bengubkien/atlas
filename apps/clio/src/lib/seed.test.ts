import { describe, expect, it } from "vitest";

import { SEEDED } from "@atlas/sync/device";

import { textSchema, type Text } from "./model";
import { SAMPLE_TEXTS, SAMPLES_VERSION } from "./samples";
import { MAX_SAMPLES_VERSION, retiredSamples, sampleRecords, seedVersion } from "./seed";

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

  it("seeds each samples version above a plain seed and below any real change", () => {
    expect(seedVersion(1)).toBeGreaterThan(SEEDED);
    expect(seedVersion(2)).toBeGreaterThan(seedVersion(1));
    expect(seedVersion(SAMPLES_VERSION)).toBeLessThan(MAX_SAMPLES_VERSION);
    expect(() => seedVersion(0)).toThrow();
  });

  it("ships samples that are valid texts with sample IDs", () => {
    for (const text of SAMPLE_TEXTS) {
      expect(text.id).toMatch(/^sample-/);
      expect(() => textSchema.parse(text)).not.toThrow();
    }
  });
});
