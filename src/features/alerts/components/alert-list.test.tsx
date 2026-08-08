import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("../actions/alert.actions", () => ({ acknowledgeAlertAction: vi.fn(), resolveAlertAction: vi.fn() }));

import { AlertList } from "./alert-list";

describe("AlertList", () => {
  it("renders severity, status and the next lifecycle action", () => {
    const html = renderToStaticMarkup(createElement(AlertList, { alerts: [{
      id: "90000000-0000-4000-8000-000000000001",
      alertTypeCode: "MEMBERSHIP_UNPAID",
      alertTypeName: "Pago vencido",
      gymMemberId: "60000000-0000-4000-8000-000000000001",
      severity: "critical",
      status: "open",
      title: "Entrada denegada",
      message: "El miembro tiene cargos vencidos.",
      createdAt: "2026-08-07T12:00:00.000Z",
      acknowledgedAt: null,
      resolvedAt: null,
    }] }));
    expect(html).toContain("Critica");
    expect(html).toContain("Abierta");
    expect(html).toContain("Reconocer");
  });

  it("renders the empty state", () => {
    expect(renderToStaticMarkup(createElement(AlertList, { alerts: [] }))).toContain("No hay alertas");
  });
});
