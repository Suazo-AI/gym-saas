import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getActiveGym: vi.fn(), createBranch: vi.fn(), updateBranch: vi.fn(), revalidatePath: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/features/gyms/services/get-active-gym", () => ({ getActiveGym: mocks.getActiveGym }));
vi.mock("../services/branch.repository", () => ({
  createBranch: mocks.createBranch, updateBranch: mocks.updateBranch, retireBranch: vi.fn(), restoreBranch: vi.fn(),
}));

import { createBranchAction, updateBranchAction } from "./branch.actions";

const gymId = "20000000-0000-4000-8000-000000000001";
const branchId = "30000000-0000-4000-8000-000000000001";

describe("branch actions", () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.getActiveGym.mockResolvedValue({ gymId }); });

  it("ignora cualquier gimnasio enviado por el formulario al crear", async () => {
    const form = new FormData();
    form.set("gymId", "90000000-0000-4000-8000-000000000009"); form.set("code", "cen"); form.set("name", "Central"); form.set("city", "Managua"); form.set("status", "active");
    await expect(createBranchAction({ ok: false }, form)).resolves.toMatchObject({ ok: true });
    expect(mocks.createBranch).toHaveBeenCalledWith({ gymId, code: "CEN", name: "Central", city: "Managua", status: "active" });
  });

  it("limita la actualizacion a la sucursal y gimnasio de la sesion", async () => {
    const form = new FormData();
    form.set("branchId", branchId); form.set("code", "norte"); form.set("name", "Norte"); form.set("city", ""); form.set("status", "inactive");
    await updateBranchAction({ ok: false }, form);
    expect(mocks.updateBranch).toHaveBeenCalledWith({ gymId, branchId, code: "NORTE", name: "Norte", city: null, status: "inactive" });
  });
});
