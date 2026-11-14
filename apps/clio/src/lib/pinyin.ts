// Pinyin helpers: numbered ("ni3 hao3") <-> tone marks ("nǐ hǎo"), and a
// plain form for search ("ni hao").
//
// The build scripts under apps/clio/scripts import this file too, so keep it
// free of imports and of syntax that Node's type stripping can't handle (no
// enums, no parameter properties).
//
// Input is one syllable per space-separated word, as in CC-CEDICT. A word
// with two syllables run together ("nǐhǎo") is not split.

// Combining marks, tone 1 to 4. Tone 5 (neutral) has no mark.
const TONE_MARKS = ["\u0304", "\u0301", "\u030c", "\u0300"] as const;
const MARK_CHARS = /[\u0304\u0301\u030c\u0300]/g;

const VOWELS = /[aeiouüêAEIOUÜÊ]/;

// Where the tone mark goes. a and e always take it. In "ou" it is the o.
// Otherwise it is the last vowel (so "iu" marks the u and "ui" marks the i).
// A syllable with no vowel at all ("n", "ng", "m", "hm") marks its first
// letter.
function markIndex(syllable: string): number {
  const lower = syllable.toLowerCase();
  const a = lower.search(/[aê]/);
  if (a >= 0) return a;
  const e = lower.indexOf("e");
  if (e >= 0) return e;
  const ou = lower.indexOf("ou");
  if (ou >= 0) return ou;
  for (let i = lower.length - 1; i >= 0; i--) {
    if (VOWELS.test(lower.charAt(i))) return i;
  }
  return 0;
}

/** One numbered syllable ("lu:4", "Bei3", "r5") to tone marks. Anything that isn't a syllable comes back as it was. */
export function markSyllable(syllable: string): string {
  const m = /^([A-Za-zÜüÊê:]+?)([1-5])$/.exec(syllable);
  if (!m) return syllable;
  const letters = (m[1] ?? "").replace(/u:/g, "ü").replace(/U:/g, "Ü").replace(/[vV]/g, (c) => (c === "v" ? "ü" : "Ü"));
  const tone = Number(m[2]);
  if (letters.includes(":")) return syllable;
  if (tone === 5) return letters.normalize("NFC");
  const i = markIndex(letters);
  const mark = TONE_MARKS[tone - 1] ?? "";
  return (letters.slice(0, i + 1) + mark + letters.slice(i + 1)).normalize("NFC");
}

/** "ni3 hao3" to "nǐ hǎo". Handles u: (and v) as ü, tone 5 as no mark, and r5 (erhua). Other text passes through. */
export function numberedToMarks(text: string): string {
  return text.replace(/[A-Za-zÜüÊê:]+[1-5](?![0-9])/g, (s) => markSyllable(s));
}

/**
 * Rewrites pinyin in square brackets, as CC-CEDICT uses it in definitions:
 * "variant of 你[ni3]" becomes "variant of 你[nǐ]". Brackets that hold
 * anything else are left alone.
 */
export function markBracketedPinyin(text: string): string {
  return text.replace(/\[([^\]]*)\]/g, (whole, inner: string) =>
    /^[A-Za-zÜüÊê:0-9 ,·]+$/.test(inner) && /[1-5]/.test(inner) ? `[${numberedToMarks(inner)}]` : whole,
  );
}

/**
 * "nǐ hǎo" to "ni3 hao3". ü becomes "u:" as CC-CEDICT writes it. A syllable
 * with no mark gets 5 (neutral) unless `neutral` is false.
 */
export function marksToNumbered(text: string, options: { neutral?: boolean } = {}): string {
  const neutral = options.neutral ?? true;
  return text.normalize("NFD").replace(/[A-Za-z\u0300-\u036f]+/g, (token) => {
    let tone = 0;
    let out = "";
    for (const ch of token) {
      const at = TONE_MARKS.indexOf(ch as (typeof TONE_MARKS)[number]);
      if (at >= 0) tone = at + 1;
      else if (ch === "\u0308") out += ":";
      else out += ch;
    }
    out = out.normalize("NFC");
    return out + (tone || (neutral ? 5 : ""));
  });
}

/** Removes tones, numbers and marks: "nǐ hǎo" and "ni3 hao3" both give "ni hao". Keeps ü and case. */
export function stripTones(text: string): string {
  return text
    .replace(/u:/g, "ü")
    .replace(/U:/g, "Ü")
    .replace(/([A-Za-zÜüÊê])[1-5](?![0-9])/g, "$1")
    .normalize("NFD")
    .replace(MARK_CHARS, "")
    .normalize("NFC");
}

/**
 * The form used to match a search: no tones, lower case, ü/v/u: as plain u,
 * and only a to z left, so "nǐ hǎo", "ni3 hao3", "Ni Hao" and "nihao" all
 * give "nihao". Han characters are dropped, so don't use it on those.
 */
export function searchKey(text: string): string {
  return stripTones(text)
    .toLowerCase()
    .replace(/[üv]/g, "u")
    .replace(/[^a-z]/g, "");
}
