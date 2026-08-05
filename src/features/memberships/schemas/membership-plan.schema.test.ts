import { describe, expect, it } from "vitest";

import { membershipPlanSchema, membershipPlanBenefitSchema, retireMembershipPlanBenefitSchema } from "./membership-plan.schema";

describe("membership plan schemas", () => {
  it("normaliza un plan sin convertir el precio a number", () => {
    expect(membershipPlanSchema.parse({
      code: " mensual ",
      name: " Plan mensual ",
      description: " Acceso general ",
      price: "900.50",
      currency: "NIO",
      durationCount: "1",
      durationUnit: "month",
      graceDays: "3",
      autoRenew: "true",
      isActive: "true",
    })).toEqual({
      code: "MENSUAL",
      name: "Plan mensual",
      description: "Acceso general",
      price: "900.50",
      currency: "NIO",
      durationCount: 1,
      durationUnit: "month",
      graceDays: 3,
      autoRenew: true,
      isActive: true,
    });
  });

  it.each(["1.001", "-1", "NaN", ""])("rechaza el precio inválido %s", (price) => {
    const result = membershipPlanSchema.safeParse({
      code: "PLAN",
      name: "Plan",
      description: "",
      price,
      currency: "USD",
      durationCount: "1",
      durationUnit: "month",
      graceDays: "0",
      autoRenew: "false",
      isActive: "true",
    });
    expect(result.success).toBe(false);
  });

  it("acepta un beneficio y normaliza su código", () => {
    expect(membershipPlanBenefitSchema.parse({ planId: "40000000-0000-4000-8000-000000000001", benefitCode: " sauna ", description: " Uso de sauna " })).toEqual({
      planId: "40000000-0000-4000-8000-000000000001",
      benefitCode: "SAUNA",
      description: "Uso de sauna",
    });
  });

  it("exige motivo para retirar un beneficio", () => {
    expect(() => retireMembershipPlanBenefitSchema.parse({ benefitId: "60000000-0000-4000-8000-000000000001", reason: "" })).toThrow();
  });
});
