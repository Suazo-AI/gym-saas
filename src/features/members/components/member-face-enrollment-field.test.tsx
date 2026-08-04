import { describe, expect, it } from "vitest";

import { FACE_IMAGE_PREVIEW_CLASS } from "./member-face-enrollment-field";

describe("MemberFaceEnrollmentField image presentation", () => {
  it("shows the complete camera frame instead of cropping it", () => {
    expect(FACE_IMAGE_PREVIEW_CLASS).toContain("object-contain");
    expect(FACE_IMAGE_PREVIEW_CLASS).not.toContain("object-cover");
  });
});
