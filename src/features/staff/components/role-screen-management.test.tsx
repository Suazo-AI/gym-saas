import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("../actions/role-screen.actions", () => ({ updateRoleScreenAction: vi.fn() }));

import { RoleScreenManagement } from "./role-screen-management";

const screen = {
  id: "screen-1",
  code: "payments",
  name: "Pagos",
  route: "/payments",
  permissionCodes: ["payments.read"],
};

describe("RoleScreenManagement", () => {
  it("configura pantallas individuales con etiquetas legibles", () => {
    const html = renderToStaticMarkup(createElement(RoleScreenManagement, {
      access: {
        screens: [screen],
        roles: [{ id: "role-1", code: "receptionist", name: "Recepción", isOwner: false, screenIds: [], permissionCodes: [] }],
      },
    }));

    expect(html).toContain("Rol que deseas configurar");
    expect(html).toContain("Ver pagos");
    expect(html).toContain("No puede administrar personal ni configuración del gimnasio.");
    expect(html).toContain("Marcar todas");
    expect(html).toContain("Limpiar selección");
    expect(html).toContain("Guardar 0 pantallas");
  });

  it("mantiene legibles las pantallas seleccionadas en modo oscuro", () => {
    const html = renderToStaticMarkup(createElement(RoleScreenManagement, {
      access: {
        screens: [screen],
        roles: [{ id: "role-1", code: "receptionist", name: "Recepción", isOwner: false, screenIds: [screen.id], permissionCodes: [] }],
      },
    }));

    expect(html).toContain("border-brand-green bg-brand-green text-white");
    expect(html).toContain("Guardar 1 pantallas");
  });
});
