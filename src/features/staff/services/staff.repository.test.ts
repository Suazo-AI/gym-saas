import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));

import { deleteStaffUser, inviteStaffUser, listDeletedStaffUsers, listStaffUsers, restoreStaffUser, updateStaffUser } from "./staff.repository";

const gymId = "20000000-0000-4000-8000-000000000001";
const gymUserId = "30000000-0000-4000-8000-000000000001";
const roleId = "40000000-0000-4000-8000-000000000001";

describe("staff repository", () => {
  it("loads the protected staff directory", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [{ id: gymUserId }], error: null });
    await expect(listStaffUsers(gymId, rpc)).resolves.toEqual([{ id: gymUserId }]);
    expect(rpc).toHaveBeenCalledWith("list_gym_staff", { p_gym_id: gymId });
  });

  it("loads retired staff from the shared recycle-bin RPC", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [{ id: gymUserId, label: "Ana", deleted_at: "2026-08-09T00:00:00Z", deletion_reason: "Fin de contrato" }],
      error: null,
    });
    await expect(listDeletedStaffUsers(gymId, rpc)).resolves.toEqual([{
      id: gymUserId,
      label: "Ana",
      deletedAt: "2026-08-09T00:00:00Z",
      reason: "Fin de contrato",
    }]);
    expect(rpc).toHaveBeenCalledWith("list_deleted_entities", {
      p_gym_id: gymId,
      p_entity: "gym_user",
      p_limit: 50,
      p_offset: 0,
    });
  });

  it("updates staff through the atomic RPC", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: { id: gymUserId }, error: null });
    await updateStaffUser({ gymId, gymUserId, employeeCode: "R-1", status: "active", roleIds: [roleId] }, rpc);
    expect(rpc).toHaveBeenCalledWith("update_gym_staff_user", {
      p_gym_id: gymId,
      p_gym_user_id: gymUserId,
      p_employee_code: "R-1",
      p_status: "active",
      p_role_ids: [roleId],
    });
  });

  it("removes a newly invited auth user when tenant linking fails", async () => {
    const inviteUserByEmail = vi.fn().mockResolvedValue({ data: { user: { id: "auth-1" } }, error: null });
    const deleteUser = vi.fn().mockResolvedValue({ data: {}, error: null });
    const rpc = vi.fn().mockResolvedValue({ data: null, error: { code: "23505" } });

    await expect(inviteStaffUser(
      { gymId, email: "staff@gym.com", employeeCode: null, roleIds: [roleId] },
      { inviteUserByEmail, deleteUser, rpc },
    )).rejects.toThrow();
    expect(deleteUser).toHaveBeenCalledWith("auth-1");
  });

  it("retires staff through the shared soft-delete RPC", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: {}, error: null });
    await deleteStaffUser({ gymUserId, reason: "Fin de contrato" }, rpc);
    expect(rpc).toHaveBeenCalledWith("soft_delete_entity", {
      p_entity: "gym_user",
      p_id: gymUserId,
      p_reason: "Fin de contrato",
    });
  });

  it("restores staff through the shared restore RPC", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: {}, error: null });
    await restoreStaffUser(gymUserId, rpc);
    expect(rpc).toHaveBeenCalledWith("restore_entity", {
      p_entity: "gym_user",
      p_id: gymUserId,
    });
  });
});
