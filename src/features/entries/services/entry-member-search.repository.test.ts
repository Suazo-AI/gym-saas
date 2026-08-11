import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

import { searchEntryMembers } from "./entry-member-search.repository";

describe("searchEntryMembers", () => {
  it("returns only the minimum entry candidate fields", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [{
        gym_id: "gym-1",
        gym_member_id: "member-1",
        member_code: "M-001",
        full_name: "Ana Pérez",
        status: "active",
        membership_status: "active",
        has_overdue_charges: false,
        financial_access_status: "grace",
      }],
      error: null,
    });

    const result = await searchEntryMembers({
      gymId: "gym-1",
      search: "  8888-0001  ",
    }, rpc);

    expect(rpc).toHaveBeenCalledWith("search_entry_members", {
      p_gym_id: "gym-1",
      p_search: "8888-0001",
      p_limit: 10,
    });
    expect(result).toEqual([{
      gymMemberId: "member-1",
      memberCode: "M-001",
      fullName: "Ana Pérez",
      status: "active",
      membershipStatus: "active",
      hasOverdueCharges: false,
      financialAccessStatus: "grace",
    }]);
    expect(result[0]).not.toHaveProperty("phone");
  });

  it("does not call Supabase for an empty term", async () => {
    const rpc = vi.fn();

    await expect(searchEntryMembers({ gymId: "gym-1", search: "   " }, rpc))
      .resolves.toEqual([]);
    expect(rpc).not.toHaveBeenCalled();
  });
});
