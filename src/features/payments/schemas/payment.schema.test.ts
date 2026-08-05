import { describe, expect, it } from "vitest";

import { registerPaymentSchema } from "./payment.schema";

const baseInput = {
  gymId: "11111111-1111-4111-8111-111111111111",
  gymMemberId: "22222222-2222-4222-8222-222222222222",
  paymentMethodId: "33333333-3333-4333-8333-333333333333",
  amount: "900.00",
  currency: "NIO" as const,
  allocations: [
    {
      chargeId: "44444444-4444-4444-8444-444444444444",
      amount: "900.00",
    },
  ],
};

describe("registerPaymentSchema", () => {
  it("acepta montos decimales y asignaciones que suman el pago", () => {
    expect(registerPaymentSchema.parse(baseInput)).toEqual(baseInput);
  });

  it("rechaza cuando la suma de asignaciones no coincide con el pago", () => {
    const result = registerPaymentSchema.safeParse({
      ...baseInput,
      allocations: [{ ...baseInput.allocations[0], amount: "899.99" }],
    });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe(
      "El total asignado no coincide con el monto del pago.",
    );
  });

  it("rechaza montos con tres decimales", () => {
    const result = registerPaymentSchema.safeParse({ ...baseInput, amount: "900.001" });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe("El monto debe ser decimal.");
  });
});
