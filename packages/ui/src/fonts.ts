import localFont from "next/font/local";

// The suite's three typefaces, as in Dossier, shipped with the apps so nothing
// is fetched from a font CDN. Each sets a --typeface-* variable on <html>;
// styles.css maps them to Tailwind's font-sans, font-serif and font-mono.

/** UI text. */
export const geist = localFont({
  src: "../fonts/geist/Geist-Variable.woff2",
  weight: "100 900",
  variable: "--typeface-geist",
  fallback: ["Helvetica", "Arial", "sans-serif"],
});

/** Page and section titles. */
export const newsreader = localFont({
  src: [
    { path: "../fonts/newsreader/Newsreader-Variable.woff2", weight: "200 800", style: "normal" },
    { path: "../fonts/newsreader/Newsreader-Italic-Variable.woff2", weight: "200 800", style: "italic" },
  ],
  variable: "--typeface-newsreader",
  fallback: ["Georgia", "serif"],
  adjustFontFallback: "Times New Roman",
});

/** Figures that should line up: weights, readings, amounts. Loaded when a page uses it. */
export const plexMono = localFont({
  src: [
    { path: "../fonts/ibm-plex-mono/IBMPlexMono-Regular.woff2", weight: "400", style: "normal" },
    { path: "../fonts/ibm-plex-mono/IBMPlexMono-Medium.woff2", weight: "500", style: "normal" },
  ],
  variable: "--typeface-plex-mono",
  fallback: ["ui-monospace", "monospace"],
  adjustFontFallback: false,
  preload: false,
});

/** The classes that set every --typeface-* variable, for <html>. */
export const fontVariables = [geist, newsreader, plexMono].map((font) => font.variable).join(" ");
