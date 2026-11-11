// Builds src/lib/samples/texts.json, the sample texts the app ships, from
// their authoring form in src/lib/samples/source/ (see build.ts there for
// how a sample is written). It reads the dictionary and the HSK list from
// public/data, so the app itself never has to load them for the samples.
//
// Run: node apps/clio/scripts/build-samples.mjs
//      node apps/clio/scripts/build-samples.mjs --check     builds and prints, writes nothing
//      node apps/clio/scripts/build-samples.mjs --draft     the same, with missing definitions as "?"
//      node apps/clio/scripts/build-samples.mjs --bands 词 词…  prints each word's band and readings
//
// The tests rebuild the samples the same way and fail if texts.json is out
// of date, so run this after changing a sample, and bump SAMPLES_VERSION in
// src/lib/samples/index.ts so devices that have the old ones get the new.

import { readdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";

import { buildSample, sampleStats } from "../src/lib/samples/build.ts";
import { formatTexts } from "../src/lib/samples/format.ts";
import { GLOSSES } from "../src/lib/samples/glosses.ts";

const root = new URL("../", import.meta.url);
const SOURCE = new URL("src/lib/samples/source/", root);
const OUT = fileURLToPath(new URL("src/lib/samples/texts.json", root));

const read = async (path) => JSON.parse(await readFile(new URL(path, root), "utf8"));
const [dict, hsk] = await Promise.all([read("public/data/dictionary.json"), read("public/data/hsk.json")]);
const bands = new Map();
for (const [word, , band] of hsk.words) if (!bands.has(word) || bands.get(word) > band) bands.set(word, band);
const lookup = {
  readings: (w) => (Object.hasOwn(dict.entries, w) ? dict.entries[w].map((r) => r[0]) : undefined),
  band: (w) => bands.get(w),
};

const args = process.argv.slice(2);
if (args[0] === "--bands") {
  for (const w of args.slice(1)) console.log(w, bands.get(w) ?? "-", (lookup.readings(w) ?? ["not in CC-CEDICT"]).join(" / "));
  process.exit(0);
}

const files = (await readdir(SOURCE)).filter((f) => f.endsWith(".ts")).sort();
const sources = [];
for (const f of files) sources.push((await import(pathToFileURL(fileURLToPath(new URL(f, SOURCE))).href)).default);
sources.sort((a, b) => a.order - b.order);

const texts = [];
let failed = false;
for (const source of sources) {
  try {
    const text = buildSample(source, { lookup, glosses: GLOSSES, draft: args.includes("--draft") });
    texts.push(text);
    const s = sampleStats(text, new Set(Object.keys(source.names ?? {})));
    const fresh = [...s.newWords].map(([w, n]) => `${w}(${bands.get(w) ?? "-"})×${n}`).join(" ");
    console.log(`${source.name.padEnd(16)} ${source.kind.padEnd(8)} band ${source.band}  ${String(s.chars).padStart(3)} chars  ${String(s.words).padStart(3)} words  ${(s.coverage * 100).toFixed(1)}%  ${fresh}`);
  } catch (e) {
    failed = true;
    console.error(e.message);
  }
}
if (failed) process.exit(1);
if (!args.includes("--check") && !args.includes("--draft")) {
  await writeFile(OUT, formatTexts(texts));
  console.log(`Wrote ${texts.length} texts to ${OUT}`);
}
