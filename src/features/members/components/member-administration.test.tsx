import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("../actions/member.actions", () => ({ updateMemberAction: vi.fn(), deleteMemberAction: vi.fn() }));

import { MemberAdministration } from "./member-administration";

const member = {
  gymMemberId: "60000000-0000-4000-8000-000000000001",
  firstName: "Ana", lastName: "Martínez", memberCode: "M-001",
  branchId: "30000000-0000-4000-8000-000000000001",
  contacts: [
    { id: "c1", type: "phone", value: "8888-0001", isPrimary: true },
    { id: "c2", type: "email", value: "ana@example.com", isPrimary: true },
  ],
};

describe("MemberAdministration", () => {
  it("muestra edición y retiro explícito con conservación histórica", () => {
    const html = renderToStaticMarkup(createElement(MemberAdministration, {
      member: member as never,
      branches: [{ id: member.branchId, code: "CEN", name: "Central", city: "Managua", status: "active" }],
      canManage: true,
    }));
    expect(html).toContain("Editar miembro");
    expect(html).toContain("Guardar cambios");
    expect(html).toContain("Retirar miembro");
    expect(html).toContain("El historial de pagos, membresías y entradas se conservará");
  });

  it("oculta acciones sin members.manage", () => {
    const html = renderToStaticMarkup(createElement(MemberAdministration, { member: member as never, branches: [], canManage: false }));
    expect(html).toBe("");
  });
});
