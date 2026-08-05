import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getActiveGym: vi.fn(),
  createMembershipPlan: vi.fn(),
  updateMembershipPlan: vi.fn(),
  createMembershipPlanBenefit: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/features/gyms/services/get-active-gym", () => ({ getActiveGym: mocks.getActiveGym }));
vi.mock("../services/membership.repository", () => ({
  createMembershipPlan: mocks.createMembershipPlan,
  updateMembershipPlan: mocks.updateMembershipPlan,
  retireMembershipPlan: vi.fn(),
  restoreMembershipPlan: vi.fn(),
  createMembershipPlanBenefit: mocks.createMembershipPlanBenefit,
  retireMembershipPlanBenefit: vi.fn(),
}));

import { createMembershipPlanAction, createMembershipPlanBenefitAction, updateMembershipPlanAction } from "./membership-plan.actions";

const gymId = "20000000-0000-4000-8000-000000000001";
const planId = "40000000-0000-4000-8000-000000000001";

function validForm() {
  const form = new FormData();
  form.set("gymId", "90000000-0000-4000-8000-000000000009");
  form.set("code", "mensual");
  form.set("name", "Mensual");
  form.set("description", "Acceso general");
  form.set("price", "900.00");
  form.set("currency", "NIO");
  form.set("durationCount", "1");
  form.set("durationUnit", "month");
  form.set("graceDays", "3");
  form.set("autoRenew", "true");
  form.set("isActive", "true");
  return form;
}

describe("membership plan actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getActiveGym.mockResolvedValue({ gymId });
  });

  it("ignora el gimnasio enviado por el navegador al crear", async () => {
    await expect(createMembershipPlanAction({ ok: false }, validForm())).resolves.toMatchObject({ ok: true });
    expect(mocks.createMembershipPlan).toHaveBeenCalledWith(expect.objectContaining({ gymId, code: "MENSUAL", price: "900.00" }));
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/memberships");
  });

  it("limita la actualización al gimnasio activo", async () => {
    const form = validForm();
    form.set("planId", planId);
    await updateMembershipPlanAction({ ok: false }, form);
    expect(mocks.updateMembershipPlan).toHaveBeenCalledWith(expect.objectContaining({ gymId, planId }));
  });

  it("crea beneficios usando el gimnasio activo", async () => {
    const form = new FormData();
    form.set("planId", planId);
    form.set("benefitCode", "sauna");
    form.set("description", "Uso de sauna");
    await createMembershipPlanBenefitAction({ ok: false }, form);
    expect(mocks.createMembershipPlanBenefit).toHaveBeenCalledWith({ gymId, planId, benefitCode: "SAUNA", description: "Uso de sauna" });
  });
});
