import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api/api-error";

const mocks = vi.hoisted(() => ({
  requireApiUser: vi.fn(),
  getActiveGym: vi.fn(),
  generateFaceEmbedding: vi.fn(),
  verifyFaceAccessWithEmbedding: vi.fn(),
  getMember: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock("@/lib/env", () => ({
  env: {
    NEXT_PUBLIC_SITE_URL: "http://localhost:3000",
    NEXT_PUBLIC_SUPABASE_URL: "http://localhost:54321",
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "test-key",
  },
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    rpc: mocks.rpc,
  })),
}));

vi.mock("@/features/auth/services/auth.service", () => ({
  requireApiUser: mocks.requireApiUser,
}));

vi.mock("@/features/gyms/services/get-active-gym", () => ({
  getActiveGym: mocks.getActiveGym,
}));

vi.mock("@/features/entries/services/face-embedding.service", () => ({
  generateFaceEmbedding: mocks.generateFaceEmbedding,
}));

vi.mock("@/features/entries/services/face-verification.repository", () => ({
  verifyFaceAccessWithEmbedding: mocks.verifyFaceAccessWithEmbedding,
}));

vi.mock("@/features/members/services/member.repository", () => ({
  getMember: mocks.getMember,
}));

import { POST } from "./route";

const gymId = "20000000-0000-4000-8000-000000000001";

function createRequest(body: unknown, headers: HeadersInit = {}) {
  return new Request("http://localhost/api/face/verify", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

describe("POST /api/face/verify", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.requireApiUser.mockResolvedValue({ id: "10000000-0000-4000-8000-000000000001" });
    mocks.getActiveGym.mockResolvedValue({ gymId });
    mocks.rpc.mockResolvedValue({ data: true, error: null });
    mocks.generateFaceEmbedding.mockResolvedValue({
      embedding: Array.from({ length: 128 }, () => 0.1),
      faceCount: 1,
      qualityScore: 0.91,
      modelCode: "test-model",
      processingMs: 10,
    });
    mocks.verifyFaceAccessWithEmbedding.mockResolvedValue({ decision: "allowed" });
    mocks.getMember.mockResolvedValue(null);
  });

  it("returns 401 JSON when there is no authenticated user", async () => {
    mocks.requireApiUser.mockRejectedValue(new ApiError("UNAUTHENTICATED", "Debes iniciar sesion."));

    const response = await POST(createRequest({ imageBase64: "a".repeat(32) }));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({ code: "UNAUTHENTICATED" });
  });

  it("does not send the image for embedding when the user lacks faces.verify", async () => {
    mocks.rpc.mockResolvedValueOnce({ data: false, error: null });

    const response = await POST(createRequest({ imageBase64: "a".repeat(32) }));

    expect(response.status).toBe(403);
    expect(mocks.generateFaceEmbedding).not.toHaveBeenCalled();
  });

  it("rejects requests above the body size limit before parsing JSON", async () => {
    const response = await POST(
      createRequest(
        { imageBase64: "a".repeat(32) },
        { "content-length": String(3 * 1024 * 1024 + 1) },
      ),
    );

    expect(response.status).toBe(413);
    expect(mocks.generateFaceEmbedding).not.toHaveBeenCalled();
  });

  it("rejects requests above the per-user gym rate limit before embedding", async () => {
    mocks.rpc
      .mockResolvedValueOnce({ data: true, error: null })
      .mockResolvedValueOnce({ data: false, error: null });

    const response = await POST(createRequest({ imageBase64: "a".repeat(32) }));

    expect(response.status).toBe(429);
    expect(mocks.generateFaceEmbedding).not.toHaveBeenCalled();
  });

  it("returns the matched member identity from the active gym", async () => {
    const gymMemberId = "30000000-0000-4000-8000-000000000001";
    mocks.verifyFaceAccessWithEmbedding.mockResolvedValue({
      decision: "allowed",
      gymMemberId,
    });
    mocks.getMember.mockResolvedValue({
      gymMemberId,
      fullName: "Ana Martinez",
      memberCode: "M-001",
    });

    const response = await POST(createRequest({ imageBase64: "a".repeat(32) }));

    expect(mocks.getMember).toHaveBeenCalledWith({ gymId, gymMemberId });
    await expect(response.json()).resolves.toMatchObject({
      member: {
        gymMemberId,
        fullName: "Ana Martinez",
        memberCode: "M-001",
      },
    });
  });
});
