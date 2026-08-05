import { describe, expect, it } from "vitest";

import { branchSchema, retireBranchSchema } from "./branch.schema";

describe("branch schemas", () => {
  it("normaliza los datos de una sucursal", () => {
    expect(branchSchema.parse({ code: "  cen-1 ", name: "  Central ", city: "  Managua ", status: "active" })).toEqual({
      code: "CEN-1", name: "Central", city: "Managua", status: "active",
    });
  });

  it("exige un motivo para retirar una sucursal", () => {
    expect(() => retireBranchSchema.parse({ branchId: "20000000-0000-4000-8000-000000000001", reason: " " })).toThrow();
  });
});
