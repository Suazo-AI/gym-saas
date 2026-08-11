import { describe, expect, it } from "vitest";

import { describeEffectivePermissions, describeRoleLimits } from "./permission-presentation";

describe("permission presentation", () => {
  it("translates, groups and sorts effective permission codes", () => {
    expect(describeEffectivePermissions(["payments.create", "members.read"])).toEqual([
      { group: "Miembros", items: [{ code: "members.read", label: "Ver miembros" }] },
      { group: "Cobros", items: [{ code: "payments.create", label: "Registrar pagos" }] },
    ]);
  });

  it("states explicit receptionist limits without granting permissions", () => {
    expect(describeRoleLimits("receptionist", ["members.read", "payments.create"])).toContain(
      "No puede administrar personal ni configuración del gimnasio.",
    );
  });

  it("keeps unknown codes visible instead of silently hiding them", () => {
    expect(describeEffectivePermissions(["future.capability"])[0].items[0]).toEqual({
      code: "future.capability",
      label: "future.capability",
    });
  });
});
