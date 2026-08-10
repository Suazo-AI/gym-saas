import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));

import { createPlatformGymWithOwner } from "./platform.repository";

const input = {
  legalName: "Gimnasio Central, S.A.",
  tradeName: "Gimnasio Central",
  slug: "gimnasio-central",
  taxIdentifier: null,
  defaultCurrency: "NIO" as const,
  timezone: "America/Managua" as const,
  ownerName: "Ana Lopez",
  ownerEmail: "ana@example.com",
};

describe("createPlatformGymWithOwner", () => {
  it("invites the owner and provisions the database contract", async () => {
    const inviteUserByEmail = vi.fn().mockResolvedValue({ data: { user: { id: "auth-owner" } }, error: null });
    const deleteUser = vi.fn();
    const rpc = vi.fn().mockResolvedValue({ data: { gymId: "gym-1" }, error: null });

    await expect(createPlatformGymWithOwner(input, { inviteUserByEmail, deleteUser, rpc })).resolves.toMatchObject({ gymId: "gym-1" });
    expect(inviteUserByEmail).toHaveBeenCalledWith("ana@example.com", expect.objectContaining({ data: { name: "Ana Lopez" } }));
    expect(rpc).toHaveBeenCalledWith("create_platform_gym_with_owner", {
      p_owner_auth_user_id: "auth-owner",
      p_legal_name: "Gimnasio Central, S.A.",
      p_trade_name: "Gimnasio Central",
      p_slug: "gimnasio-central",
      p_tax_identifier: null,
      p_default_currency: "NIO",
      p_timezone: "America/Managua",
    });
    expect(deleteUser).not.toHaveBeenCalled();
  });

  it("removes the invited auth user when database provisioning fails", async () => {
    const inviteUserByEmail = vi.fn().mockResolvedValue({ data: { user: { id: "auth-owner" } }, error: null });
    const deleteUser = vi.fn().mockResolvedValue({ data: {}, error: null });
    const rpc = vi.fn().mockResolvedValue({ data: null, error: { code: "23505", message: "duplicate key" } });

    await expect(createPlatformGymWithOwner(input, { inviteUserByEmail, deleteUser, rpc })).rejects.toThrow("El registro ya existe.");
    expect(deleteUser).toHaveBeenCalledWith("auth-owner");
  });

  it("preserves the invited user when the database outcome is ambiguous", async () => {
    const inviteUserByEmail = vi.fn().mockResolvedValue({ data: { user: { id: "auth-owner" } }, error: null });
    const deleteUser = vi.fn();
    const rpc = vi.fn().mockResolvedValue({ data: null, error: { code: "PGRST000", message: "connection failure" } });

    await expect(createPlatformGymWithOwner(input, { inviteUserByEmail, deleteUser, rpc })).rejects.toThrow();
    expect(deleteUser).not.toHaveBeenCalled();
  });
});
