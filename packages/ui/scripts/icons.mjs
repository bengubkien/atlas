// Draws every app's icons from its mark: the lucide icon from src/apps.ts in
// white on the app's accent colour from src/styles.css. Writes, into each app
// folder that exists:
//
//   src/app/icon.svg            the browser tab's icon (Kairos too: only these first two)
//   src/app/apple-icon.png      the iPhone home screen's (180px, square: iOS rounds it)
//   public/icon-192.png         the PWA manifest's
//   public/icon-512.png
//   public/icon-maskable-512.png  for Android's shaped icons (the mark inside the safe zone)
//
// Run after changing an app's icon or colour: `pnpm --filter @atlas/ui icons`.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import * as icons from "lucide-react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import sharp from "sharp";

const root = path.join(import.meta.dirname, "../../..");
const css = readFileSync(path.join(import.meta.dirname, "../src/styles.css"), "utf8");
const apps = readFileSync(path.join(import.meta.dirname, "../src/apps.ts"), "utf8");

/** The app's accent from styles.css, as `oklch(L C h)`. */
function accentOf(id) {
  const match = new RegExp(`--color-accent-${id}:\\s*oklch\\(([\\d.]+) ([\\d.]+) ([\\d.]+)\\)`).exec(css);
  if (!match) throw new Error(`No --color-accent-${id} in styles.css`);
  return match.slice(1).map(Number);
}

/** The lucide icon named for the app in apps.ts. */
function iconOf(id) {
  const match = new RegExp(`${id}: \\{[^}]*?icon: (\\w+),`, "s").exec(apps);
  if (!match) throw new Error(`No icon for ${id} in apps.ts`);
  return icons[match[1]];
}

/** OKLCH to sRGB (Björn Ottosson's matrices), clamped, as #rrggbb, with its linear values. */
function oklchToSrgb([L, C, h]) {
  const hr = (h * Math.PI) / 180;
  const a = C * Math.cos(hr);
  const b = C * Math.sin(hr);
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const linear = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ].map((x) => Math.min(1, Math.max(0, x)));
  const gamma = (x) => (x <= 0.0031308 ? 12.92 * x : 1.055 * x ** (1 / 2.4) - 0.055);
  const hex = `#${linear.map((x) => Math.round(gamma(x) * 255).toString(16).padStart(2, "0")).join("")}`;
  return { hex, linear };
}

/** White on the colour, as a WCAG contrast ratio. */
function contrastWithWhite(linear) {
  const luminance = 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
  return 1.05 / (luminance + 0.05);
}

/** The icon's 24×24 drawing, without its <svg> wrapper. */
function iconPaths(Icon) {
  const svg = renderToStaticMarkup(createElement(Icon, { size: 24 }));
  return svg.replace(/^<svg[^>]*>/, "").replace(/<\/svg>$/, "");
}

/** The mark on a canvas of `size`, the icon `scale` of it, the corners rounded by `radius` (a share of size). */
function markSvg({ fill, paths, size, scale, radius }) {
  const iconSize = size * scale;
  const offset = (size - iconSize) / 2;
  const factor = iconSize / 24;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${size * radius}" fill="${fill}"/>
  <g transform="translate(${offset} ${offset}) scale(${factor})" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${paths}</g>
</svg>
`;
}

const png = (svg, file) => sharp(Buffer.from(svg)).png().toFile(file);

// Every app in apps.ts's APP_IDS, so a new app gets its icons without editing this list.
const ids = [...(/APP_IDS = \[([^\]]*)\]/.exec(apps)?.[1] ?? "").matchAll(/"(\w+)"/g)].map((m) => m[1]);
if (ids.length === 0) throw new Error("No APP_IDS in apps.ts");

for (const id of ids) {
  const { hex, linear } = oklchToSrgb(accentOf(id));
  const ratio = contrastWithWhite(linear);
  const paths = iconPaths(iconOf(id));
  console.log(`${id.padEnd(7)} ${hex}  white on it ${ratio.toFixed(2)}:1${ratio < 3 ? "  (below 3:1)" : ""}`);

  const dir = path.join(root, "apps", id);
  if (!existsSync(dir)) continue;
  mkdirSync(path.join(dir, "src/app"), { recursive: true });

  writeFileSync(path.join(dir, "src/app/icon.svg"), markSvg({ fill: hex, paths, size: 64, scale: 0.6, radius: 0.22 }));
  await png(markSvg({ fill: hex, paths, size: 180, scale: 0.56, radius: 0 }), path.join(dir, "src/app/apple-icon.png"));
  // Kairos (Dossier) is a desktop app with no install manifest: the tab's and the iPhone's icons are enough.
  if (id === "kairos") {
    console.log(`        → apps/${id}: icon.svg, apple-icon.png`);
    continue;
  }
  mkdirSync(path.join(dir, "public"), { recursive: true });
  await png(markSvg({ fill: hex, paths, size: 192, scale: 0.56, radius: 0.22 }), path.join(dir, "public/icon-192.png"));
  await png(markSvg({ fill: hex, paths, size: 512, scale: 0.56, radius: 0.22 }), path.join(dir, "public/icon-512.png"));
  await png(markSvg({ fill: hex, paths, size: 512, scale: 0.42, radius: 0 }), path.join(dir, "public/icon-maskable-512.png"));
  console.log(`        → apps/${id}: icon.svg, apple-icon.png, icon-192/512.png, icon-maskable-512.png`);
}
