import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

import { createBranch, listDeletedBranches, restoreBranch, retireBranch, updateBranch } from "./branch.repository";

const gymId = "20000000-0000-4000-8000-000000000001";
const branchId = "30000000-0000-4000-8000-000000000001";

describe("branch repository", () => {
  it("crea la sucursal con el gimnasio de la sesion", async () => {
    const insert = vi.fn().mockResolvedValue({ error: null });
    await createBranch({ gymId, code: "CEN", name: "Central", city: "Managua", status: "active" }, { insert });
    expect(insert).toHaveBeenCalledWith({ gym_id: gymId, code: "CEN", name: "Central", city: "Managua", status: "active" });
  });

  it("actualiza solo una sucursal del gimnasio activo", async () => {
    const update = vi.fn().mockResolvedValue({ error: null });
    await updateBranch({ gymId, branchId, code: "NORTE", name: "Norte", city: null, status: "inactive" }, { update });
    expect(update).toHaveBeenCalledWith(branchId, gymId, { code: "NORTE", name: "Norte", city: null, status: "inactive" });
  });

  it("retira y restaura mediante las operaciones autorizadas", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: {}, error: null });
    await retireBranch({ branchId, reason: "Cierre del local" }, rpc);
    await restoreBranch(branchId, rpc);
    expect(rpc).toHaveBeenNthCalledWith(1, "soft_delete_entity", { p_entity: "gym_branch", p_id: branchId, p_reason: "Cierre del local" });
    expect(rpc).toHaveBeenNthCalledWith(2, "restore_entity", { p_entity: "gym_branch", p_id: branchId });
  });

  it("lista solo sucursales retiradas del gimnasio activo", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [{ entity_type: "gym_branch", id: branchId, label: "CEN - Central" }], error: null });
    await expect(listDeletedBranches(gymId, rpc)).resolves.toHaveLength(1);
    expect(rpc).toHaveBeenCalledWith("list_deleted_entities", { p_gym_id: gymId, p_entity: "gym_branch", p_limit: 50, p_offset: 0 });
  });
});
