import { describe, expect, it, vi } from "vitest";

import { enrollMemberFace } from "./member-face-enrollment.repository";

describe("enrollMemberFace", () => {
  it("rejects embeddings that are not 512 dimensions", async () => {
    await expect(
      enrollMemberFace({
        gymId: "20000000-0000-4000-8000-000000000001",
        gymMemberId: "40000000-0000-4000-8000-000000000001",
        objectPath: "20000000-0000-4000-8000-000000000001/members/photo.webp",
        mimeType: "image/webp",
        sizeBytes: 12,
        embedding: [0, 1, 2],
        biometricConsentGranted: true,
        rpc: vi.fn(),
      }),
    ).rejects.toThrow("El embedding facial debe tener 512 dimensiones.");
  });

  it("calls enroll_member_face with storage metadata and a pgvector literal", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: {
        mediaAssetId: "media-1",
        personPhotoId: "photo-1",
        faceEmbeddingId: "embedding-1",
        consentId: "consent-1",
      },
      error: null,
    });

    const result = await enrollMemberFace({
      gymId: "20000000-0000-4000-8000-000000000001",
      gymMemberId: "40000000-0000-4000-8000-000000000001",
      objectPath: "20000000-0000-4000-8000-000000000001/members/40000000-0000-4000-8000-000000000001/photo.webp",
      mimeType: "image/webp",
      sizeBytes: 12345,
      widthPixels: 320,
      heightPixels: 240,
      sha256Hex: "a".repeat(64),
      embedding: Array.from({ length: 512 }, () => 0.2),
      qualityScore: 0.8,
      biometricConsentGranted: true,
      consentVersion: "2026-07-22",
      modelCode: "insightface-buffalo-l-w600k-r50",
      rpc,
    });

    expect(rpc).toHaveBeenCalledWith("enroll_member_face", {
      p_gym_id: "20000000-0000-4000-8000-000000000001",
      p_gym_member_id: "40000000-0000-4000-8000-000000000001",
      p_object_path: "20000000-0000-4000-8000-000000000001/members/40000000-0000-4000-8000-000000000001/photo.webp",
      p_mime_type: "image/webp",
      p_size_bytes: 12345,
      p_width_pixels: 320,
      p_height_pixels: 240,
      p_sha256_hex: "a".repeat(64),
      p_embedding: `[${Array.from({ length: 512 }, () => 0.2).join(",")}]`,
      p_quality_score: 0.8,
      p_consent_version: "2026-07-22",
      p_model_code: "insightface-buffalo-l-w600k-r50",
    });
    expect(result.faceEmbeddingId).toBe("embedding-1");
  });
});
