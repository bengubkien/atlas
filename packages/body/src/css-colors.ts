"use client";

import { useEffect, useState } from "react";

/**
 * Colours from CSS custom properties, as the page shows them now, following
 * light and dark mode (the system's, or the app's own switch). three.js needs
 * plain sRGB, so each is drawn onto a 1×1 canvas and read back, which works
 * for any CSS colour, light-dark() and oklch() included.
 */
export function useCssColors<K extends string>(variables: Record<K, string>): Record<K, string> | null {
  const [colors, setColors] = useState<Record<K, string> | null>(null);
  const key = JSON.stringify(variables);

  useEffect(() => {
    const names = JSON.parse(key) as Record<K, string>;
    const probe = document.createElement("span");
    probe.style.display = "none";
    document.body.append(probe);
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 1;
    const context = canvas.getContext("2d", { willReadFrequently: true });

    const read = () => {
      const result = {} as Record<K, string>;
      for (const [name, variable] of Object.entries(names) as [K, string][]) {
        probe.style.color = `var(${variable})`;
        const css = getComputedStyle(probe).color;
        if (!context) {
          result[name] = css;
          continue;
        }
        context.clearRect(0, 0, 1, 1);
        context.fillStyle = css;
        context.fillRect(0, 0, 1, 1);
        const [r, g, b] = context.getImageData(0, 0, 1, 1).data;
        result[name] = `#${[r, g, b].map((x) => (x ?? 0).toString(16).padStart(2, "0")).join("")}`;
      }
      setColors(result);
    };
    read();

    const scheme = window.matchMedia("(prefers-color-scheme: dark)");
    scheme.addEventListener("change", read);
    const observer = new MutationObserver(read);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "class", "style"] });
    return () => {
      scheme.removeEventListener("change", read);
      observer.disconnect();
      probe.remove();
    };
  }, [key]);

  return colors;
}
