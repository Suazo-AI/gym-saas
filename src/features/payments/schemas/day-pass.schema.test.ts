import { describe, expect, it } from "vitest";

import { registerDayPassSchema } from "./day-pass.schema";

const valid = {
  gymId: "11111111-1111-4111-8111-111111111111",
  gymMemberId: "22222222-2222-4222-8222-222222222222",
  paymentMethodId: "33333333-3333-4333-8333-333333333333",
  serviceDate: "2026-08-20",
  amount: "120.00",
  currency: "NIO" as const,
};

describe("registerDayPassSchema", () => {
  it("accepts a current or future standalone pass", () => {
    expect(registerDayPassSchema.parse(valid)).toMatchObject(valid);
  });

  it("rejects invalid money and dates", () => {
    expect(() => registerDayPassSchema.parse({ ...valid, amount: "12.999" })).toThrow();
    expect(() => registerDayPassSchema.parse({ ...valid, serviceDate: "20/08/2026" })).toThrow();
  });
});
