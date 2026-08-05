import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

import {
  createMembershipPlan,
  canManageMembershipPlans,
  createMembershipPlanBenefit,
  listDeletedMembershipPlans,
  restoreMembershipPlan,
  retireMembershipPlanBenefit,
  retireMembershipPlan,
  updateMembershipPlan,
} from "./membership.repository";

const gymId = "20000000-0000-4000-8000-000000000001";
const planId = "40000000-0000-4000-8000-000000000001";
const plan = {
  code: "DIARIO",
  name: "Plan diario",
  description: null,
  price: "100.00",
  currency: "NIO" as const,
  durationCount: 1,
  durationUnit: "day" as const,
  graceDays: 0,
  autoRenew: false,
  isActive: true,
};

describe("membership plan repository", () => {
  it("crea el plan con el gimnasio recibido del servidor y dinero decimal textual", async () => {
    const insert = vi.fn().mockResolvedValue({ error: null });
    await createMembershipPlan({ gymId, ...plan }, { insert });
    expect(insert).toHaveBeenCalledWith({
      gym_id: gymId,
      code: "DIARIO",
      name: "Plan diario",
      description: null,
      price: "100.00",
      currency: "NIO",
      duration_count: 1,
      duration_unit: "day",
      billing_cycle_months: 1,
      grace_days: 0,
      auto_renew: false,
      is_active: true,
    });
  });

  it("limita la actualización al plan no retirado del gimnasio activo", async () => {
    const update = vi.fn().mockResolvedValue({ error: null });
    await updateMembershipPlan({ gymId, planId, ...plan }, { update });
    expect(update).toHaveBeenCalledWith(planId, gymId, expect.objectContaining({ code: "DIARIO", price: "100.00" }));
  });

  it("retira y restaura mediante las RPC autorizadas", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: {}, error: null });
    await retireMembershipPlan({ planId, reason: "Plan descontinuado" }, rpc);
    await restoreMembershipPlan(planId, rpc);
    expect(rpc).toHaveBeenNthCalledWith(1, "soft_delete_entity", { p_entity: "membership_plan", p_id: planId, p_reason: "Plan descontinuado" });
    expect(rpc).toHaveBeenNthCalledWith(2, "restore_entity", { p_entity: "membership_plan", p_id: planId });
  });

  it("consulta la papelera del gimnasio activo", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [{ id: planId, label: "DIARIO - Plan diario" }], error: null });
    await expect(listDeletedMembershipPlans(gymId, rpc)).resolves.toHaveLength(1);
    expect(rpc).toHaveBeenCalledWith("list_deleted_entities", { p_gym_id: gymId, p_entity: "membership_plan", p_limit: 50, p_offset: 0 });
  });

  it("habilita administración solo cuando existe el permiso efectivo", async () => {
    const read = vi.fn().mockResolvedValue({ data: { permissions: ["memberships.manage"] }, error: null });
    await expect(canManageMembershipPlans(gymId, { read })).resolves.toBe(true);
    expect(read).toHaveBeenCalledWith(gymId);
  });

  it("crea un beneficio únicamente dentro de un plan visible del gimnasio activo", async () => {
    const insert = vi.fn().mockResolvedValue({ error: null });
    await createMembershipPlanBenefit({ gymId, planId, benefitCode: "SAUNA", description: "Uso de sauna" }, { insert });
    expect(insert).toHaveBeenCalledWith(planId, gymId, { benefit_code: "SAUNA", description: "Uso de sauna" });
  });

  it("retira beneficios mediante borrado lógico", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: {}, error: null });
    await retireMembershipPlanBenefit({ benefitId: "60000000-0000-4000-8000-000000000001", reason: "Ya no se ofrece" }, rpc);
    expect(rpc).toHaveBeenCalledWith("soft_delete_entity", {
      p_entity: "membership_plan_benefit",
      p_id: "60000000-0000-4000-8000-000000000001",
      p_reason: "Ya no se ofrece",
    });
  });
});
