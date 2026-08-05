import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getActiveGym: vi.fn(),
  inviteStaffUser: vi.fn(),
  updateStaffUser: vi.fn(),
  deleteStaffUser: vi.fn(),
  restoreStaffUser: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/features/gyms/services/get-active-gym", () => ({ getActiveGym: mocks.getActiveGym }));
vi.mock("../services/staff.repository", () => ({
  inviteStaffUser: mocks.inviteStaffUser,
  updateStaffUser: mocks.updateStaffUser,
  deleteStaffUser: mocks.deleteStaffUser,
  restoreStaffUser: mocks.restoreStaffUser,
}));

import { inviteStaffAction, updateStaffAction } from "./staff.actions";

const gymId = "20000000-0000-4000-8000-000000000001";
const gymUserId = "30000000-0000-4000-8000-000000000001";
const roleId = "40000000-0000-4000-8000-000000000001";

describe("staff actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getActiveGym.mockResolvedValue({ gymId });
  });

  it("derives the invitation gym from the authenticated session", async () => {
    const form = new FormData();
    form.set("email", "staff@gym.com");
    form.set("roleIds", roleId);
    await expect(inviteStaffAction({ ok: false }, form)).resolves.toMatchObject({ ok: true });
    expect(mocks.inviteStaffUser).toHaveBeenCalledWith({ gymId, email: "staff@gym.com", employeeCode: null, roleIds: [roleId] });
  });

  it("updates lifecycle and roles in one operation", async () => {
    const form = new FormData();
    form.set("gymUserId", gymUserId);
    form.set("status", "suspended");
    form.set("roleIds", roleId);
    await expect(updateStaffAction({ ok: false }, form)).resolves.toMatchObject({ ok: true });
    expect(mocks.updateStaffUser).toHaveBeenCalledWith({ gymId, gymUserId, employeeCode: null, status: "suspended", roleIds: [roleId] });
  });
});
