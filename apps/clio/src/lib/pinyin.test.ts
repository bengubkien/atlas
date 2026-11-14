import { describe, expect, it } from "vitest";

import { markBracketedPinyin, markSyllable, marksToNumbered, numberedToMarks, searchKey, stripTones } from "./pinyin";

describe("numberedToMarks", () => {
  it("converts plain phrases", () => {
    expect(numberedToMarks("ni3 hao3")).toBe("nǐ hǎo");
    expect(numberedToMarks("zhong1 guo2")).toBe("zhōng guó");
    expect(numberedToMarks("ma1 ma5")).toBe("mā ma");
  });

  it("puts the mark on a or e first", () => {
    expect(numberedToMarks("hao3")).toBe("hǎo");
    expect(numberedToMarks("xian1")).toBe("xiān");
    expect(numberedToMarks("lei2")).toBe("léi");
    expect(numberedToMarks("yue4")).toBe("yuè");
    expect(numberedToMarks("liang3")).toBe("liǎng");
  });

  it("puts the mark on the o in ou", () => {
    expect(numberedToMarks("dou1")).toBe("dōu");
    expect(numberedToMarks("zhou4")).toBe("zhòu");
  });

  it("otherwise marks the last vowel", () => {
    expect(numberedToMarks("liu2")).toBe("liú");
    expect(numberedToMarks("hui4")).toBe("huì");
    expect(numberedToMarks("guo2")).toBe("guó");
    expect(numberedToMarks("ni3")).toBe("nǐ");
    expect(numberedToMarks("wu3")).toBe("wǔ");
  });

  it("writes u: and v as ü", () => {
    expect(numberedToMarks("lu:4")).toBe("lǜ");
    expect(numberedToMarks("lü4")).toBe("lǜ");
    expect(numberedToMarks("nu:3")).toBe("nǚ");
    expect(numberedToMarks("nv3")).toBe("nǚ");
    expect(numberedToMarks("lu:e4")).toBe("lüè");
    expect(numberedToMarks("nu:e4")).toBe("nüè");
    expect(numberedToMarks("yi1 lu:4")).toBe("yī lǜ");
    expect(numberedToMarks("lu:5")).toBe("lü");
  });

  it("handles the neutral tone and erhua", () => {
    expect(numberedToMarks("hua1 r5")).toBe("huā r");
    expect(numberedToMarks("de5")).toBe("de");
    expect(numberedToMarks("er2")).toBe("ér");
    expect(numberedToMarks("er5")).toBe("er");
  });

  it("tells xian1 from xi1 an1", () => {
    expect(numberedToMarks("xian1")).toBe("xiān");
    expect(numberedToMarks("xi1 an1")).toBe("xī ān");
  });

  it("keeps capital letters", () => {
    expect(numberedToMarks("Bei3 jing1")).toBe("Běi jīng");
    expect(numberedToMarks("A1 la1 bo2 yu3")).toBe("Ā lā bó yǔ");
    expect(numberedToMarks("Er2")).toBe("Ér");
    expect(numberedToMarks("NI3 HAO3")).toBe("NǏ HǍO");
    expect(numberedToMarks("Lu:4")).toBe("Lǜ");
    expect(numberedToMarks("LU:4")).toBe("L\u01db");
  });

  it("handles syllables with no vowel", () => {
    expect(numberedToMarks("ng2")).toBe("ńg");
    expect(numberedToMarks("m2")).toBe("ḿ");
    expect(numberedToMarks("hng5")).toBe("hng");
  });

  it("handles e with a circumflex", () => {
    expect(numberedToMarks("ê2")).toBe("ế");
  });

  it("leaves other text alone", () => {
    expect(numberedToMarks("")).toBe("");
    expect(numberedToMarks("ni3 hao3 , ma5")).toBe("nǐ hǎo , ma");
    expect(numberedToMarks("Beijing")).toBe("Beijing");
    expect(numberedToMarks("你好")).toBe("你好");
    expect(numberedToMarks("tian1 an1 men2 · guang3 chang3")).toBe("tiān ān mén · guǎng chǎng");
  });
});

describe("markSyllable", () => {
  it("converts one syllable", () => {
    expect(markSyllable("shuang1")).toBe("shuāng");
  });
  it("returns anything else unchanged", () => {
    expect(markSyllable("hello")).toBe("hello");
    expect(markSyllable("ni6")).toBe("ni6");
  });
});

describe("markBracketedPinyin", () => {
  it("converts pinyin inside square brackets only", () => {
    expect(markBracketedPinyin("variant of 你[ni3]")).toBe("variant of 你[nǐ]");
    expect(markBracketedPinyin("CL:個|个[ge4], 位[wei4]")).toBe("CL:個|个[gè], 位[wèi]");
    expect(markBracketedPinyin("see 女[nu:3]")).toBe("see 女[nǚ]");
    expect(markBracketedPinyin("a [sic] mistake")).toBe("a [sic] mistake");
    expect(markBracketedPinyin("ni3 hao3")).toBe("ni3 hao3");
  });
});

describe("marksToNumbered", () => {
  it("converts tone marks to numbers", () => {
    expect(marksToNumbered("nǐ hǎo")).toBe("ni3 hao3");
    expect(marksToNumbered("zhōng guó")).toBe("zhong1 guo2");
    expect(marksToNumbered("xiān")).toBe("xian1");
    expect(marksToNumbered("xī ān")).toBe("xi1 an1");
  });

  it("writes ü as u:", () => {
    expect(marksToNumbered("lǜ")).toBe("lu:4");
    expect(marksToNumbered("nǚ")).toBe("nu:3");
    expect(marksToNumbered("lüè")).toBe("lu:e4");
    expect(marksToNumbered("lü")).toBe("lu:5");
  });

  it("gives unmarked syllables the neutral tone", () => {
    expect(marksToNumbered("mā ma")).toBe("ma1 ma5");
    expect(marksToNumbered("huā r")).toBe("hua1 r5");
    expect(marksToNumbered("mā ma", { neutral: false })).toBe("ma1 ma");
  });

  it("keeps capitals", () => {
    expect(marksToNumbered("Běi jīng")).toBe("Bei3 jing1");
    expect(marksToNumbered("Ér")).toBe("Er2");
  });

  it("leaves other text alone", () => {
    expect(marksToNumbered("你好 , 吗")).toBe("你好 , 吗");
  });

  it("round trips", () => {
    for (const p of ["nǐ hǎo", "lǜ sè", "huā r", "Běi jīng", "nǚ ér", "yī lǜ", "dōu", "liú", "ńg", "ê"]) {
      const n = marksToNumbered(p);
      expect(numberedToMarks(n)).toBe(p);
    }
  });
});

describe("stripTones", () => {
  it("strips marks", () => {
    expect(stripTones("nǐ hǎo")).toBe("ni hao");
    expect(stripTones("Běi jīng")).toBe("Bei jing");
    expect(stripTones("huā r")).toBe("hua r");
  });
  it("strips numbers", () => {
    expect(stripTones("ni3 hao3")).toBe("ni hao");
    expect(stripTones("hua1 r5")).toBe("hua r");
  });
  it("keeps ü", () => {
    expect(stripTones("lǜ")).toBe("lü");
    expect(stripTones("lu:4")).toBe("lü");
    expect(stripTones("nǚ")).toBe("nü");
  });
  it("leaves Han characters and spaces", () => {
    expect(stripTones("你 nǐ")).toBe("你 ni");
  });
});

describe("searchKey", () => {
  it("makes every spelling the same", () => {
    for (const q of ["nihao", "ni hao", "nǐ hǎo", "ni3 hao3", "Ni Hao", " NI3  HAO3 ", "ni'hao"]) {
      expect(searchKey(q)).toBe("nihao");
    }
  });
  it("treats ü, u: and v as u", () => {
    expect(searchKey("lǜ")).toBe("lu");
    expect(searchKey("lu:4")).toBe("lu");
    expect(searchKey("lv4")).toBe("lu");
  });
  it("tells xian from xi an only by what you typed", () => {
    expect(searchKey("xian1")).toBe("xian");
    expect(searchKey("xi1 an1")).toBe("xian");
  });
});
