import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api/api-error";

const mocks = vi.hoisted(() => ({
  requireApiUser: vi.fn(),
  getActiveGym: vi.fn(),
  requireGymPermission: vi.fn(),
  getFaceServiceEnv: vi.fn(),
  fetch: vi.fn(),
}));

vi.mock("server-only", () => ({}));

vi.mock("@/features/auth/services/auth.service", () => ({
  requireApiUser: mocks.requireApiUser,
}));

vi.mock("@/features/gyms/services/get-active-gym", () => ({
  getActiveGym: mocks.getActiveGym,
}));

vi.mock("@/features/gyms/services/require-gym-permission", () => ({
  requireGymPermission: mocks.requireGymPermission,
}));

vi.mock("@/lib/env.server", () => ({
  getFaceServiceEnv: mocks.getFaceServiceEnv,
}));

import { GET } from "./route";

const gymId = "20000000-0000-4000-8000-000000000001";

describe("GET /api/face/warm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", mocks.fetch);

    mocks.requireApiUser.mockResolvedValue({
      id: "10000000-0000-4000-8000-000000000001",
    });
    mocks.getActiveGym.mockResolvedValue({ gymId });
    mocks.requireGymPermission.mockResolvedValue(undefined);
    mocks.getFaceServiceEnv.mockReturnValue({
      FACE_RECOGNITION_SERVICE_URL: "http://face-service:8010",
      FACE_RECOGNITION_SERVICE_TOKEN: "face-service-test-token-1234567890",
    });
  });

  it("returns ok when the facial service responds", async () => {
    mocks.fetch.mockResolvedValue(new Response(null, { status: 200 }));

    const response = await GET();
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toEqual({ ok: true, ms: expect.any(Number) });
    expect(mocks.requireGymPermission).toHaveBeenCalledWith(gymId, "faces.verify");
    expect(mocks.fetch).toHaveBeenCalledWith(
      new URL("http://face-service:8010/health"),
      expect.objectContaining({
        method: "GET",
        headers: {
          authorization: "Bearer face-service-test-token-1234567890",
        },
        cache: "no-store",
        signal: expect.any(AbortSignal),
      }),
    );
  });

  it("returns a controlled failure when the facial service fails", async () => {
    mocks.fetch.mockResolvedValue(new Response(null, { status: 503 }));

    const response = await GET();

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      ms: expect.any(Number),
    });
  });

  it("rejects a user without faces.verify before calling the service", async () => {
    mocks.requireGymPermission.mockRejectedValue(
      new ApiError("FORBIDDEN", "No tienes permiso para realizar esta accion."),
    );

    const response = await GET();

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({ code: "FORBIDDEN" });
    expect(mocks.fetch).not.toHaveBeenCalled();
  });
});
