// What a review card shows for one word, worked out from what's on the
// phone. Pure, so it's tested.
//
// The meaning comes from the nearest source that has it: the glossary of
// the text you met the word in (what it meant there), any other text that
// explains it, the dictionary if it's on the phone, and last the HSK
// list's short gloss (always there, 180 KB) so reviewing never waits on
// the 9 MB dictionary. The sentence is the one you met it in, else the
// first a text has it in.

import type { GlossEntry, Text, Token, Word } from "@/lib/model";

export type FaceSentence = {
  tokens: Token[];
  en: string;
  /** The places of the word's tokens in `tokens`, to highlight. */
  at: number[];
  glossary: Record<string, GlossEntry>;
  /** The text it's from: its title in Chinese. */
  title: string;
};

export type Face = {
  word: string;
  pinyin: string;
  defs: string[];
  sentence: FaceSentence | null;
  /** Where the meaning came from. */
  from: "context" | "text" | "dictionary" | "list" | "none";
};

/** A word's entry somewhere else: the dictionary or the HSK list. */
export type Lookup = (word: string) => { pinyin: string; defs: string[] } | undefined;

const glossOf = (text: Text, word: string) => (Object.hasOwn(text.glossary, word) ? text.glossary[word] : undefined);

function sentenceIn(text: Text, word: string, sentenceId?: string): FaceSentence | null {
  const has = (s: Text["sentences"][number]) => s.tokens.some((token) => token.w === word);
  // The sentence saved, if it still holds the word (a text can change), else the first that does.
  const saved = sentenceId ? text.sentences.find((s) => s.id === sentenceId) : undefined;
  const sentence = saved && has(saved) ? saved : text.sentences.find(has);
  if (!sentence) return null;
  const at = sentence.tokens.flatMap((token, index) => (token.w === word ? [index] : []));
  return { tokens: sentence.tokens, en: sentence.en, at, glossary: text.glossary, title: text.title.zh };
}

export function faceFor(word: Pick<Word, "id" | "context">, texts: readonly Text[], lookups: { dictionary?: Lookup; list?: Lookup } = {}): Face {
  const id = word.id;
  const home = word.context ? texts.find((text) => text.id === word.context!.textId && !text.deleted) : undefined;
  const homeGloss = home ? glossOf(home, id) : undefined;
  const other = homeGloss ? undefined : texts.find((text) => !text.deleted && glossOf(text, id) !== undefined);
  const sentence = (home && sentenceIn(home, id, word.context!.sentenceId)) || (other && sentenceIn(other, id)) || null;

  const gloss = homeGloss ?? (other ? glossOf(other, id) : undefined);
  if (gloss) return { word: id, pinyin: gloss.pinyin, defs: gloss.defs, sentence, from: homeGloss ? "context" : "text" };
  const dictionary = lookups.dictionary?.(id);
  if (dictionary && dictionary.defs.length > 0) return { word: id, ...dictionary, sentence, from: "dictionary" };
  const list = lookups.list?.(id);
  if (list) return { word: id, ...list, sentence, from: list.defs.length > 0 ? "list" : "none" };
  return { word: id, pinyin: dictionary?.pinyin ?? "", defs: [], sentence, from: "none" };
}

/** The meaning in one line, for the recall card's prompt. */
export const meaningLine = (face: Pick<Face, "defs">, max = 2) =>
  face.defs
    .filter((definition) => !definition.startsWith("CL:"))
    .slice(0, max)
    .join("; ");
