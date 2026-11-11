// Builds public/data/hsk.json, the HSK 3.0 (2021 standard) word list.
//
// Source: https://github.com/drkameleon/complete-hsk-vocabulary (MIT licence,
// (c) 2026 Yanis Zafiropulos), file complete.json, pinned to the commit below
// so a re-run gives the same data. Its HSK 3.0 levels are the fields "new-1"
// to "new-7" ("new-7" means bands 7-9 together). The "newest-*" fields are a
// later revision and are not used. Its glosses come from CC-CEDICT (CC BY-SA
// 4.0); see the root NOTICE.
//
// Run: node apps/clio/scripts/build-hsk.mjs
//
// Output: { "source": {...}, "words": [[word, pinyin, band, gloss?], ...] }
// Band is 1 to 6, or 7 for "7-9". One word per line so diffs stay readable.

import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const COMMIT = "7ac65bf1a6387d35f1ade478906172a19311c7f9";
const URL_ = `https://raw.githubusercontent.com/drkameleon/complete-hsk-vocabulary/${COMMIT}/complete.json`;
const OUT = fileURLToPath(new URL("../public/data/hsk.json", import.meta.url));

// The standard's cumulative totals. The source dedupes words that appear
// twice in the standard (same characters, different reading or part of
// speech), so its counts run a little under these. The check below only
// guards against a broken download.
const STANDARD_CUMULATIVE = [500, 1272, 2245, 3245, 4316, 5456, 11092];

const res = await fetch(URL_);
if (!res.ok) throw new Error(`Download failed: ${res.status} ${URL_}`);
const source = await res.json();

// The gloss is the first meaning, cut at the first ";" and kept short. It is
// a hint beside the word, not a dictionary entry.
function shortGloss(meanings) {
  const first = (meanings ?? []).find((m) => m && m.trim());
  if (!first) return undefined;
  let g = first.split(";")[0].trim();
  if (g.length > 48) g = g.slice(0, 47).trimEnd() + "…";
  return g || undefined;
}

const words = [];
for (const e of source) {
  const bands = (e.level ?? []).map((l) => /^new-(\d)$/.exec(l)).filter(Boolean).map((m) => Number(m[1]));
  if (bands.length === 0) continue;
  const band = Math.min(...bands);
  // A word with a surname reading ("白" Bái / bái) lists both. Use the
  // everyday one: the first form that doesn't start with a capital, or the
  // first form if all do (real proper nouns such as 北京).
  const forms = e.forms ?? [];
  const form = forms.find((f) => !/^\p{Lu}/u.test(f.transcriptions.pinyin)) ?? forms[0];
  if (!form) continue;
  // The source writes erhua as "r5", ü as "u:" in places and a dot before
  // some neutral-tone syllables. Tone-marked pinyin has none of those.
  const pinyin = form.transcriptions.pinyin.normalize("NFC").trim().replace(/r5/g, "r").replace(/u:/g, "ü").replace(/˙/g, "");
  const gloss = shortGloss(form.meanings);
  words.push(gloss ? [e.simplified, pinyin, band, gloss] : [e.simplified, pinyin, band]);
}
words.sort((a, b) => a[2] - b[2]);

const counts = Array(7).fill(0);
for (const w of words) counts[w[2] - 1]++;
let running = 0;
const cumulative = counts.map((n) => (running += n));

const data = {
  source: {
    name: "complete-hsk-vocabulary",
    url: "https://github.com/drkameleon/complete-hsk-vocabulary",
    commit: COMMIT,
    licence: "MIT",
    standard: "HSK 3.0 (2021); band 7 means bands 7-9",
  },
  counts,
  words: "@@WORDS@@",
};
const text = JSON.stringify(data, null, 1).replace(
  '"@@WORDS@@"',
  "[\n" + words.map((w) => JSON.stringify(w)).join(",\n") + "\n ]",
);

await mkdir(new URL("../public/data/", import.meta.url), { recursive: true });
await writeFile(OUT, text + "\n");

console.log(`Wrote ${words.length} words to ${OUT}`);
console.log("Per band:      ", counts.join(" / "));
console.log("Cumulative:    ", cumulative.join(" / "));
console.log("Standard:      ", STANDARD_CUMULATIVE.join(" / "));
const off = cumulative.findIndex((n, i) => Math.abs(n - STANDARD_CUMULATIVE[i]) > STANDARD_CUMULATIVE[i] * 0.05);
if (off >= 0) throw new Error(`Band ${off + 1} is more than 5% away from the standard. Check the source.`);
