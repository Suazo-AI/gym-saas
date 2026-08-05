import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("../actions/staff.actions", () => ({
  inviteStaffAction: vi.fn(),
  updateStaffAction: vi.fn(),
  deleteStaffAction: vi.fn(),
}));

import { StaffManagement } from "./staff-management";

describe("StaffManagement", () => {
  it("renders invitation, roles, lifecycle and logical deletion controls", () => {
    const html = renderToStaticMarkup(createElement(StaffManagement, {
      roles: [{ id: "role-1", code: "receptionist", name: "Recepcionista", description: null }],
      staff: [{
        id: "staff-1",
        authUserId: "auth-1",
        email: "ana@gym.com",
        fullName: "Ana López",
        employeeCode: "R-01",
        status: "active",
        invitedAt: "2026-08-04T00:00:00Z",
        acceptedAt: "2026-08-04T01:00:00Z",
        roles: [{ id: "role-1", code: "receptionist", name: "Recepcionista" }],
        permissions: ["members.read"],
      }],
    }));

    expect(html).toContain("Invitar personal");
    expect(html).toContain("Ana López");
    expect(html).toContain("Recepcionista");
    expect(html).toContain("Suspender");
    expect(html).toContain("Retirar usuario");
    expect(html).toContain("Motivo del retiro");
    expect(html).toMatch(/bg-brand-green[^\"]*text-white[^\"]*\"[^>]*>Guardar cambios/);
  });
});
