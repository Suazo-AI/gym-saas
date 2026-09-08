import { describe, expect, it } from "vitest";

import { describeEffectivePermissions, describeRoleLimits, displayRoleName } from "./permission-presentation";

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

  it("keeps SaaS subscription permissions out of the gym staff view", () => {
    expect(describeEffectivePermissions(["billing.read", "billing.manage", "members.read"])).toEqual([
      { group: "Miembros", items: [{ code: "members.read", label: "Ver miembros" }] },
    ]);
  });

  it("localizes system role names", () => {
    expect(displayRoleName("owner", "Owner", "es")).toBe("Dueño");
    expect(displayRoleName("owner", "Dueño", "en")).toBe("Owner");
  });
});
