import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { OwnerDashboard } from "./owner-dashboard";

describe("OwnerDashboard", () => {
  it("muestra indicadores definidos y accesos de seguimiento", () => {
    const html = renderToStaticMarkup(createElement(OwnerDashboard, { dashboard: { activeMembers: 40, expiringMemberships: 3, overdueMembers: 2, income: { today: { USD: "10.00", NIO: "366.00" }, month: { USD: "90.00", NIO: "3294.00" } }, entriesToday: 18, openAlerts: 1 } }));
    expect(html).toContain("Miembros activos");
    expect(html).toContain("Próximos 7 días");
    expect(html).toContain("USD 10.00");
    expect(html).toContain("NIO 366.00");
    expect(html).toContain("Revisar miembros");
    expect(html).toContain("bg-[#111814]");
    expect(html).toContain("text-[#dce7df]");
  });

  it("explica cuando una métrica está restringida", () => {
    const html = renderToStaticMarkup(createElement(OwnerDashboard, { dashboard: { activeMembers: null, expiringMemberships: null, overdueMembers: null, income: null, entriesToday: null, openAlerts: null } }));
    expect(html).toContain("Sin permiso");
  });

  it("ofrece el acceso a ingresos solo a quien puede leerlos", () => {
    const conPermiso = renderToStaticMarkup(createElement(OwnerDashboard, { dashboard: { activeMembers: 40, expiringMemberships: 3, overdueMembers: 2, income: { today: { USD: "10.00", NIO: "366.00" }, month: { USD: "90.00", NIO: "3294.00" } }, entriesToday: 18, openAlerts: 1 } }));
    expect(conPermiso).toContain('href="/income"');

    // Recepcion no tiene income.read, asi que dashboard.income llega nulo. Con el
    // boton visible terminaba en /income, que la RPC rechaza con 42501: una
    // pantalla sin salida ofrecida por el propio panel.
    const sinPermiso = renderToStaticMarkup(createElement(OwnerDashboard, { dashboard: { activeMembers: 4, expiringMemberships: 0, overdueMembers: 1, income: null, entriesToday: 0, openAlerts: 0 } }));
    expect(sinPermiso).not.toContain('href="/income"');
    expect(sinPermiso).toContain('href="/members"');
    expect(sinPermiso).toContain('href="/entries"');
  });
});
