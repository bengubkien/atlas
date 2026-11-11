// How texts.json is laid out: JSON, with anything short (a token, a
// glossary entry, a list of options) on one line and the rest indented, so
// the file is readable and a changed word shows as a small diff. The tests
// use it too, to check the committed file is what the build makes.

const WIDTH = 120;

function format(value: unknown, indent: string): string {
  const flat = JSON.stringify(value);
  if (value === null || typeof value !== "object" || indent.length * 1 + flat.length <= WIDTH) return flat;
  const inner = `${indent}  `;
  if (Array.isArray(value)) {
    // A sentence's tokens: as many to a line as fit.
    if (value.every((v) => v !== null && typeof v === "object" && !Array.isArray(v) && JSON.stringify(v).length < 60)) {
      const lines: string[] = [];
      let line = "";
      for (const v of value) {
        const item = JSON.stringify(v);
        if (line && inner.length + line.length + item.length + 2 > WIDTH) {
          lines.push(line);
          line = "";
        }
        line += (line ? ", " : "") + item;
      }
      if (line) lines.push(line);
      return `[\n${lines.map((l) => inner + l).join(",\n")}\n${indent}]`;
    }
    return `[\n${value.map((v) => inner + format(v, inner)).join(",\n")}\n${indent}]`;
  }
  const entries = Object.entries(value as Record<string, unknown>);
  return `{\n${entries.map(([k, v]) => `${inner}${JSON.stringify(k)}: ${format(v, inner)}`).join(",\n")}\n${indent}}`;
}

export function formatTexts(texts: readonly unknown[]): string {
  return `${format(texts, "")}\n`;
}
