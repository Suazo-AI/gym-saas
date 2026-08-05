import { describe, expect, it } from "vitest";

import { mapAssignedSubscription } from "./membership.mapper";

describe("mapAssignedSubscription", () => {
  it("maps the RPC result and keeps money as decimal text", () => {
    const result = mapAssignedSubscription({
      subscriptionId: "70000000-0000-4000-8000-000000000004",
      gymMemberId: "60000000-0000-4000-8000-000000000004",
      membershipPlanId: "40000000-0000-4000-8000-000000000001",
      planName: "Mensual",
      status: "active",
      startDate: "2026-07-30",
      endDate: null,
      billingCycleMonths: 1,
      recurringAmount: "900.00",
      currency: "NIO",
      chargeId: "80000000-0000-4000-8000-000000000004",
      chargeAmountDue: "900.00",
      chargeDueDate: "2026-07-30",
    });

    expect(result.recurringAmount).toBe("900.00");
    expect(result.chargeAmountDue).toBe("900.00");
    expect(result.currency).toBe("NIO");
  });

  it("keeps charge fields null when no first charge was generated", () => {
    const result = mapAssignedSubscription({
      subscriptionId: "70000000-0000-4000-8000-000000000004",
      gymMemberId: "60000000-0000-4000-8000-000000000004",
      membershipPlanId: "40000000-0000-4000-8000-000000000001",
      planName: "Mensual",
      status: "active",
      startDate: "2026-07-30",
      endDate: null,
      billingCycleMonths: 1,
      recurringAmount: "900.00",
      currency: "NIO",
      chargeId: null,
      chargeAmountDue: null,
      chargeDueDate: null,
    });

    expect(result.chargeId).toBeNull();
    expect(result.chargeAmountDue).toBeNull();
    expect(result.chargeDueDate).toBeNull();
  });
});
