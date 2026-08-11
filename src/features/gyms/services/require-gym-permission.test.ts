import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api/api-error";

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({ rpc: mocks.rpc }),
}));

import { hasGymPermission, requireGymPermission } from "./require-gym-permission";

const gymId = "20000000-0000-4000-8000-000000000001";

describe("gym permission guard", () => {
  beforeEach(() => {
    mocks.rpc.mockReset();
  });

  it.each([true, false])("returns %s from the permission RPC", async (allowed) => {
    mocks.rpc.mockResolvedValue({ data: allowed, error: null });

    await expect(hasGymPermission(gymId, "faces.read")).resolves.toBe(allowed);
    expect(mocks.rpc).toHaveBeenCalledWith("current_user_has_gym_permission", {
      p_gym_id: gymId,
      p_permission_code: "faces.read",
    });
  });

  it("maps errors returned by the permission RPC", async () => {
    mocks.rpc.mockResolvedValue({
      data: null,
      error: { code: "42501", message: "permission denied" },
    });

    await expect(hasGymPermission(gymId, "faces.read")).rejects.toBeInstanceOf(ApiError);
  });

  it("keeps requireGymPermission as a forbidden guard", async () => {
    mocks.rpc.mockResolvedValue({ data: false, error: null });

    await expect(requireGymPermission(gymId, "faces.read")).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });
});
