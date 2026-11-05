// Attached files: what one is, from its first bytes.

/**
 * A file's type, from its first bytes rather than what the browser said:
 * PDFs and the usual pictures, else unknown (it's then only downloaded).
 */
export function sniffType(bytes: Uint8Array): string {
  const ascii = (from: number, to: number) => String.fromCharCode(...bytes.slice(from, to));
  if (ascii(0, 5) === "%PDF-") return "application/pdf";
  if (bytes[0] === 0x89 && ascii(1, 4) === "PNG") return "image/png";
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (ascii(0, 4) === "GIF8") return "image/gif";
  if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return "image/webp";
  if (ascii(4, 8) === "ftyp" && /^(heic|heix|mif1|msf1)$/.test(ascii(8, 12))) return "image/heic";
  return "application/octet-stream";
}
