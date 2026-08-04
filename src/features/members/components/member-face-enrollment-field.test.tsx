import { describe, expect, it, vi } from "vitest";

import {
  drawScaledCameraFrame,
  FACE_IMAGE_PREVIEW_CLASS,
} from "./member-face-enrollment-field";

describe("MemberFaceEnrollmentField image presentation", () => {
  it("shows the complete camera frame instead of cropping it", () => {
    expect(FACE_IMAGE_PREVIEW_CLASS).toContain("object-contain");
    expect(FACE_IMAGE_PREVIEW_CLASS).not.toContain("object-cover");
  });

  it("scales the complete camera frame into the smaller canvas", () => {
    const drawImage = vi.fn();
    const context = { drawImage } as unknown as CanvasRenderingContext2D;
    const video = {} as HTMLVideoElement;

    drawScaledCameraFrame(context, video, 1280, 720, 480, 270);

    expect(drawImage).toHaveBeenCalledWith(video, 0, 0, 1280, 720, 0, 0, 480, 270);
  });
});
