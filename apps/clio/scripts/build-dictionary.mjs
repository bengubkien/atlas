// Builds public/data/dictionary.json from CC-CEDICT.
//
// Source: CC-CEDICT, https://cc-cedict.org, (c) MDBG, CC BY-SA 4.0
// (https://creativecommons.org/licenses/by-sa/4.0/). mdbg.net is not
// reachable from every network, so this takes the dictionary from the npm
// package "cedict-json" (https://github.com/matt-tingen/cedict-json, also CC
// BY-SA 4.0), which is a line-for-line JSON copy of the CC-CEDICT export. The
// package is pinned to one version and checked against npm's own hash. Its
// version number ends in the date of the snapshot (20251213, 13 Dec 2025).
// The package tarball is fetched here, not added as a dependency.
//
// Run: node apps/clio/scripts/build-dictionary.mjs
//
// Format (one JSON file, parsed once, then every lookup is a property read):
//   { "source": {...}, "entries": { "你好": [ ["nǐ hǎo", "hello", "hi"] ], ... } }
// Each reading is an array: the pinyin first (tone marks, capital letter
// for proper nouns), then its definitions. One JSON file was chosen over a
// tab-separated text file because JSON.parse is native and fast on phones,
// the service worker caches one URL, and a tab file would still need a
// parsed object for O(1) lookups.
//
// What is trimmed, because a learner doesn't need it:
//  - traditional forms (the app is simplified only),
//  - variant-pointer readings ("old variant of 汝[rǔ]", "erhua variant of
//    花[huā]") when the headword has a real reading,
//  - definitions past MAX_DEFS for one reading,
//  - exact repeats.

import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { gunzipSync } from "node:zlib";

import { markBracketedPinyin, numberedToMarks } from "../src/lib/pinyin.ts";

const NPM = "https://registry.npmjs.org/cedict-json/-/cedict-json-1.3.20251213.tgz";
const INTEGRITY =
  "sha512-RVmJrMNhbPjRSKoP68urEEAr06zKH/Cq/+ABVJ8dIq15rTzW5W25NANVy1RMjU/pwX/eZ+yQ02k5RkXRjj6qgg==";
const SNAPSHOT = "2025-12-13";
const OUT = fileURLToPath(new URL("../public/data/dictionary.json", import.meta.url));

const MAX_DEFS = Number(process.env.MAX_DEFS ?? 12);

// A definition that only points at another word.
const POINTER =
  /^(?:(?:old|archaic|ancient|obsolete|unofficial|erhua|Japanese|Korean|dialectal|nonstandard|incorrect|variant|alternative|Taiwanese|Cantonese)\s+)*(?:variant|form|writing)\s+of\s|^(?:also written|also pr\.|same as|see\s|see also\s|equivalent to)/i;

const res = await fetch(NPM);
if (!res.ok) throw new Error(`Download failed: ${res.status} ${NPM}`);
const tgz = Buffer.from(await res.arrayBuffer());
const hash = "sha512-" + createHash("sha512").update(tgz).digest("base64");
if (hash !== INTEGRITY) throw new Error(`The download doesn't match its published hash (${hash}).`);

// Reads one file out of a tar archive. Enough for this one job.
function untar(tar, wanted) {
  let at = 0;
  while (at + 512 <= tar.length) {
    const name = tar.toString("utf8", at, at + 100).replace(/\0.*$/s, "");
    if (!name) break;
    const size = parseInt(tar.toString("utf8", at + 124, at + 136).replace(/\0.*$/s, "").trim(), 8);
    const body = at + 512;
    if (name === wanted) return tar.subarray(body, body + size);
    at = body + Math.ceil(size / 512) * 512;
  }
  throw new Error(`${wanted} not found in the archive`);
}

const raw = JSON.parse(untar(gunzipSync(tgz), "package/cedict.json").toString("utf8"));

const isPointer = (defs) => defs.every((d) => POINTER.test(d));
const isProper = (pinyin) => /^\p{Lu}/u.test(pinyin);

// headword -> Map(pinyin -> defs[])
const byWord = new Map();
for (const e of raw) {
  const pinyin = numberedToMarks(e.pinyin.trim());
  const defs = e.english.map((d) => markBracketedPinyin(d.trim())).filter(Boolean);
  if (defs.length === 0) continue;
  let readings = byWord.get(e.simplified);
  if (!readings) byWord.set(e.simplified, (readings = new Map()));
  const have = readings.get(pinyin);
  if (have) for (const d of defs) { if (!have.includes(d)) have.push(d); }
  else readings.set(pinyin, [...new Set(defs)]);
}

const entries = {};
let readingCount = 0;
let dropped = 0;
for (const [word, readings] of byWord) {
  let list = [...readings].map(([pinyin, defs]) => ({ pinyin, defs }));
  const real = list.filter((r) => !isPointer(r.defs));
  if (real.length > 0 && real.length < list.length) {
    dropped += list.length - real.length;
    list = real;
  }
  // Everyday readings first, then proper-noun (capitalised) ones. The sort
  // is stable, so CC-CEDICT's own order holds within each group.
  list.sort((a, b) => Number(isProper(a.pinyin)) - Number(isProper(b.pinyin)));
  entries[word] = list.map((r) => [r.pinyin, ...r.defs.slice(0, MAX_DEFS)]);
  readingCount += list.length;
}

const data = {
  source: {
    name: "CC-CEDICT",
    url: "https://cc-cedict.org/",
    copyright: "MDBG",
    licence: "CC BY-SA 4.0",
    licenceUrl: "https://creativecommons.org/licenses/by-sa/4.0/",
    via: "npm cedict-json 1.3.20251213",
    snapshot: SNAPSHOT,
  },
  entries,
};
const text = JSON.stringify(data);

await mkdir(new URL("../public/data/", import.meta.url), { recursive: true });
await writeFile(OUT, text + "\n");

const { gzipSync, brotliCompressSync } = await import("node:zlib");
const mb = (n) => (n / 1024 / 1024).toFixed(2) + " MB";
console.log(`Source lines: ${raw.length}. Headwords: ${byWord.size}. Readings kept: ${readingCount} (dropped ${dropped} pointer readings).`);
console.log(`Wrote ${OUT}`);
console.log(`Raw ${mb(text.length)} (bytes ${Buffer.byteLength(text)}), gzip ${mb(gzipSync(text, { level: 9 }).length)}, brotli ${mb(brotliCompressSync(text).length)}`);
