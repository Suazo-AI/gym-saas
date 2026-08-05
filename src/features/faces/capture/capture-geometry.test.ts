import { describe, expect, it } from "vitest";

import { coverCrop } from "./capture-geometry";

describe("coverCrop", () => {
  it("returns the centered 4:3 source region shown inside a 4:3 capture", () => {
    expect(coverCrop(1280, 720, 640, 480)).toEqual({
      sx: 160,
      sy: 0,
      sw: 960,
      sh: 720,
    });
  });

  it("keeps portrait video centered without reading outside the source", () => {
    expect(coverCrop(720, 1280, 640, 480)).toEqual({
      sx: 0,
      sy: 370,
      sw: 720,
      sh: 540,
    });
  });

  it("rejects invalid dimensions before drawing a frame", () => {
    expect(() => coverCrop(0, 720, 640, 480)).toThrow(
      "Capture dimensions must be positive finite numbers.",
    );
  });
});
