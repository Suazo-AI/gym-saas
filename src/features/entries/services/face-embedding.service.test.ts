import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const mocks = vi.hoisted(() => ({
  getFaceServiceEnv: vi.fn(),
}));

vi.mock("@/lib/env.server", () => ({
  getFaceServiceEnv: mocks.getFaceServiceEnv,
}));

import { generateFaceEmbedding } from "./face-embedding.service";

describe("generateFaceEmbedding", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mocks.getFaceServiceEnv.mockReturnValue({
      FACE_RECOGNITION_SERVICE_URL: "http://face-service:8010",
      FACE_RECOGNITION_SERVICE_TOKEN: "face-service-test-token-1234567890",
    });
  });

  it("sends the shared token and accepts a 128 dimension embedding", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({
      embedding: Array.from({ length: 128 }, () => 0.01),
      faceCount: 1,
      qualityScore: 0.9,
      modelCode: "opencv-sface",
      processingMs: 25,
    }), { status: 200, headers: { "content-type": "application/json" } }));

    const result = await generateFaceEmbedding("base64-image");

    expect(result.embedding).toHaveLength(128);
    expect(fetchMock).toHaveBeenCalledWith(
      new URL("http://face-service:8010/embed"),
      expect.objectContaining({
        headers: expect.objectContaining({
          authorization: "Bearer face-service-test-token-1234567890",
        }),
      }),
    );
  });
});
