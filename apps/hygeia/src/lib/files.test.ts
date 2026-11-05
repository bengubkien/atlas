import { describe, expect, it } from "vitest";

import { sniffType } from "./files";

const bytes = (text: string, prefix: number[] = []) => new Uint8Array([...prefix, ...[...text].map((c) => c.charCodeAt(0))]);

describe("attached files", () => {
  it("knows a file's type from its first bytes, not its name", () => {
    expect(sniffType(bytes("%PDF-1.7 ..."))).toBe("application/pdf");
    expect(sniffType(bytes("PNG\r\n", [0x89]))).toBe("image/png");
    expect(sniffType(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe("image/jpeg");
    expect(sniffType(bytes("RIFF\0\0\0\0WEBPVP8 "))).toBe("image/webp");
    expect(sniffType(bytes("\0\0\0\x18ftypheic"))).toBe("image/heic");
    expect(sniffType(bytes("<html><script>alert(1)</script>"))).toBe("application/octet-stream");
  });
});
