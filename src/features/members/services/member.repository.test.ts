import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

import { canManageMembers, listDeletedMembers } from "./member.repository";

const gymId = "20000000-0000-4000-8000-000000000001";
const gymMemberId = "60000000-0000-4000-8000-000000000001";

describe("member administration repository", () => {
  it("lista únicamente miembros retirados del gimnasio activo", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [{ id: gymMemberId, label: "M-001 - Ana Martínez", deleted_at: "2026-08-04T00:00:00Z", deletion_reason: "Retiro" }], error: null });
    await expect(listDeletedMembers(gymId, rpc)).resolves.toEqual([{ id: gymMemberId, label: "M-001 - Ana Martínez", deletedAt: "2026-08-04T00:00:00Z", reason: "Retiro" }]);
    expect(rpc).toHaveBeenCalledWith("list_deleted_gym_members", { p_gym_id: gymId, p_limit: 50, p_offset: 0 });
  });

  it("habilita controles solo con members.manage efectivo", async () => {
    const read = vi.fn().mockResolvedValue({ data: true, error: null });
    await expect(canManageMembers(gymId, { read })).resolves.toBe(true);
    expect(read).toHaveBeenCalledWith(gymId);
  });
});
