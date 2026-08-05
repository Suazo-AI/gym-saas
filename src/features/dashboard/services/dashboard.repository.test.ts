import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

import { mapOwnerDashboard } from "./dashboard.repository";

describe("owner dashboard repository", () => {
  it("mapea métricas sin mezclar monedas", () => {
    expect(mapOwnerDashboard({ activeMembers: 40, expiringMemberships: 3, overdueMembers: 2, income: { today: { USD: "10.00", NIO: "366.00" }, month: { USD: "90.00", NIO: "3294.00" } }, entriesToday: 18, openAlerts: 1 })).toMatchObject({
      activeMembers: 40,
      income: { today: { USD: "10.00", NIO: "366.00" } },
    });
  });

  it("conserva métricas restringidas como null", () => {
    expect(mapOwnerDashboard({ activeMembers: null, income: null })).toMatchObject({ activeMembers: null, income: null });
  });
});
