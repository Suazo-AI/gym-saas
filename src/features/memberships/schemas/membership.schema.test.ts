import { describe, expect, it } from "vitest";

import { assignSubscriptionSchema } from "./membership.schema";

const validInput = {
  gymId: "20000000-0000-4000-8000-000000000001",
  gymMemberId: "60000000-0000-4000-8000-000000000001",
  membershipPlanId: "40000000-0000-4000-8000-000000000001",
};

describe("assignSubscriptionSchema", () => {
  it("accepts a valid assignment and applies boolean defaults", () => {
    const parsed = assignSubscriptionSchema.parse({
      ...validInput,
      startDate: "2026-07-30",
      recurringAmount: "900.00",
      currency: "NIO",
      billingCycleMonths: "1",
    });

    expect(parsed).toMatchObject({
      ...validInput,
      startDate: "2026-07-30",
      recurringAmount: "900.00",
      currency: "NIO",
      billingCycleMonths: 1,
      autoRenew: true,
      generateFirstCharge: true,
    });
  });

  it("rejects an amount with three decimal places", () => {
    expect(
      assignSubscriptionSchema.safeParse({
        ...validInput,
        recurringAmount: "900.001",
      }).success,
    ).toBe(false);
  });

  it("rejects an unknown currency", () => {
    expect(
      assignSubscriptionSchema.safeParse({
        ...validInput,
        currency: "EUR",
      }).success,
    ).toBe(false);
  });

  it("rejects a malformed uuid", () => {
    expect(
      assignSubscriptionSchema.safeParse({
        ...validInput,
        gymMemberId: "member-1",
      }).success,
    ).toBe(false);
  });
});
