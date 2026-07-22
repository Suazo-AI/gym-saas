import { describe, expect, it, vi } from "vitest";

import { verifyFaceAccessWithEmbedding } from "./face-verification.repository";

describe("verifyFaceAccessWithEmbedding", () => {
  it("rejects embeddings that are not 512 dimensions", async () => {
    await expect(
      verifyFaceAccessWithEmbedding({
        gymId: "20000000-0000-4000-8000-000000000001",
        embedding: [0, 1, 2],
        rpc: vi.fn(),
      }),
    ).rejects.toThrow("El embedding facial debe tener 512 dimensiones.");
  });

  it("calls verify_face_access with a pgvector literal", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: {
        eventId: "event-1",
        decision: "allowed",
        decisionReason: "Active subscription verified.",
        gymMemberId: "member-1",
        personId: "person-1",
        faceEmbeddingId: "embedding-1",
        similarity: 0.91,
        accessAllowed: true,
      },
      error: null,
    });

    const result = await verifyFaceAccessWithEmbedding({
      gymId: "20000000-0000-4000-8000-000000000001",
      branchId: "30000000-0000-4000-8000-000000000001",
      embedding: Array.from({ length: 512 }, () => 0.1),
      processingMs: 25,
      modelCode: "insightface-buffalo-l",
      rpc,
    });

    expect(rpc).toHaveBeenCalledWith("verify_face_access", {
      p_gym_id: "20000000-0000-4000-8000-000000000001",
      p_embedding: `[${Array.from({ length: 512 }, () => 0.1).join(",")}]`,
      p_branch_id: "30000000-0000-4000-8000-000000000001",
      p_device_id: null,
      p_similarity_threshold: 0.75,
      p_processing_ms: 25,
      p_model_code: "insightface-buffalo-l",
    });
    expect(result.accessAllowed).toBe(true);
  });
});
