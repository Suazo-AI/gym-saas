import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { EntryAccessNotice } from "./entry-access-notice";

describe("EntryAccessNotice", () => {
  it("shows a clear allowed status without exposing member details", () => {
    const member = {
      status: "active",
      membershipStatus: "active",
      hasOverdueCharges: false,
      phone: "8888-0001",
      email: "ana@example.com",
      overdueAmount: "900.00",
      nextPaymentDate: "2026-08-15",
    };

    const html = renderToStaticMarkup(createElement(EntryAccessNotice, { member }));

    expect(html).toContain('role="status"');
    expect(html).toContain("Acceso permitido");
    expect(html).not.toContain("8888-0001");
    expect(html).not.toContain("ana@example.com");
    expect(html).not.toContain("900.00");
    expect(html).not.toContain("2026-08-15");
  });

  it.each([
    ["blocked", "active", false],
    ["active", "past_due", false],
    ["active", "expired", false],
    ["active", "active", true],
    ["active", null, false],
  ])("shows private denial guidance for %s/%s/overdue=%s", (
    status,
    membershipStatus,
    hasOverdueCharges,
  ) => {
    const html = renderToStaticMarkup(createElement(EntryAccessNotice, {
      member: { status, membershipStatus, hasOverdueCharges },
    }));

    expect(html).toContain('role="alert"');
    expect(html).toContain("Acceso no permitido");
    expect(html).toContain("Revisar membresía en recepción");
    expect(html).not.toContain("saldo");
    expect(html).not.toContain("vencida");
    expect(html).not.toContain("morosa");
  });

  it("allows grace with a clear warning and no financial details", () => {
    const html = renderToStaticMarkup(createElement(EntryAccessNotice, {
      member: {
        status: "active",
        membershipStatus: "active",
        hasOverdueCharges: true,
        financialAccessStatus: "grace",
      },
    }));

    expect(html).toContain('role="status"');
    expect(html).toContain("Acceso permitido");
    expect(html).toContain("Período de gracia");
    expect(html).not.toContain("saldo");
  });
});
