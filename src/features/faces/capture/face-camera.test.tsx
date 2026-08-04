import { describe, expect, it, vi } from "vitest";

import {
  CAMERA_CONSTRAINTS,
  attachMediaStream,
  drawCoverFrame,
  hasMinimumCameraResolution,
  stopMediaStream,
} from "./face-camera";

describe("face camera", () => {
  it("requests a front-facing 720p-or-better camera", () => {
    expect(CAMERA_CONSTRAINTS).toEqual({
      video: {
        facingMode: "user",
        width: { ideal: 1280 },
        height: { ideal: 720 },
      },
      audio: false,
    });
  });

  it("rejects a camera whose real frame is below 720p", () => {
    expect(hasMinimumCameraResolution(1280, 720)).toBe(true);
    expect(hasMinimumCameraResolution(1920, 1080)).toBe(true);
    expect(hasMinimumCameraResolution(640, 480)).toBe(false);
    expect(hasMinimumCameraResolution(0, 0)).toBe(false);
  });

  it("draws the exact centered region represented by object-cover", () => {
    const drawImage = vi.fn();
    const context = { drawImage } as unknown as CanvasRenderingContext2D;
    const video = {} as HTMLVideoElement;

    drawCoverFrame(context, video, 1280, 720, 960, 720);

    expect(drawImage).toHaveBeenCalledWith(video, 160, 0, 960, 720, 0, 0, 960, 720);
  });

  it("stops every camera track", () => {
    const first = { stop: vi.fn() };
    const second = { stop: vi.fn() };
    const stream = {
      getTracks: () => [first, second],
    } as unknown as MediaStream;

    stopMediaStream(stream);

    expect(first.stop).toHaveBeenCalledOnce();
    expect(second.stop).toHaveBeenCalledOnce();
  });

  it("attaches and starts an acquired stream without waiting for another render", async () => {
    const play = vi.fn().mockResolvedValue(undefined);
    const video = { play, srcObject: null } as unknown as HTMLVideoElement;
    const stream = {} as MediaStream;

    await attachMediaStream(video, stream);

    expect(video.srcObject).toBe(stream);
    expect(play).toHaveBeenCalledOnce();
  });
});
