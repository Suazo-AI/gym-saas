import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("../actions/membership-plan.actions", () => ({
  createMembershipPlanAction: vi.fn(),
  updateMembershipPlanAction: vi.fn(),
  retireMembershipPlanAction: vi.fn(),
  restoreMembershipPlanAction: vi.fn(),
  createMembershipPlanBenefitAction: vi.fn(),
  retireMembershipPlanBenefitAction: vi.fn(),
}));

import { MembershipPlanManagement } from "./membership-plan-management";

describe("MembershipPlanManagement", () => {
  it("muestra creación, edición, duración, retiro y papelera con lenguaje operativo", () => {
    const html = renderToStaticMarkup(createElement(MembershipPlanManagement, {
      plans: [{
        id: "p1", code: "MENSUAL", name: "Mensual", description: "Acceso general",
        price: "900.00", currency: "NIO", billingCycleMonths: 1, durationCount: 1,
        durationUnit: "month", graceDays: 3, autoRenew: true, isActive: true,
        benefits: [{ id: "b1", benefitCode: "SAUNA", description: "Uso de sauna" }],
      }],
      deletedPlans: [{ id: "p2", label: "DIARIO - Diario", deletedAt: "2026-08-04T00:00:00Z", reason: "Descontinuado" }],
    }));

    expect(html).toContain("Crear plan");
    expect(html).toContain("Guardar cambios");
    expect(html).toContain("1 mes");
    expect(html).toContain("Retirar plan");
    expect(html).toContain("Restaurar");
    expect(html).not.toMatch(/RPC|RLS|Supabase|CRUD|lectura directa/i);
  });

  it("oculta acciones administrativas sin permiso", () => {
    const html = renderToStaticMarkup(createElement(MembershipPlanManagement, { plans: [], deletedPlans: [], canManage: false }));
    expect(html).not.toContain("Crear plan");
    expect(html).not.toContain("Papelera");
    expect(html).toContain("No hay planes disponibles");
  });
});
