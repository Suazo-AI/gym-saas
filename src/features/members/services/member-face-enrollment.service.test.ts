import { describe, expect, it } from "vitest";

import { parseFaceImageDataUrl } from "./member-face-enrollment.service";

describe("parseFaceImageDataUrl", () => {
  it("parses allowed image data urls", () => {
    const parsed = parseFaceImageDataUrl("data:image/webp;base64,aGVsbG8=");

    expect(parsed.mimeType).toBe("image/webp");
    expect(Buffer.from(parsed.bytes).toString("utf8")).toBe("hello");
  });

  it("rejects unsupported MIME types", () => {
    expect(() => parseFaceImageDataUrl("data:image/gif;base64,aGVsbG8=")).toThrow(
      "La foto debe ser WebP, JPEG o PNG.",
    );
  });
});
