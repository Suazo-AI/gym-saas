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
});
