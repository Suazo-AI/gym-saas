import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getActiveGym: vi.fn(),
  updateMember: vi.fn(),
  deleteMember: vi.fn(),
  restoreMember: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/features/gyms/services/get-active-gym", () => ({ getActiveGym: mocks.getActiveGym }));
vi.mock("../services/member.repository", () => ({
  createMember: vi.fn(), updateMember: mocks.updateMember, deleteMember: mocks.deleteMember, restoreMember: mocks.restoreMember,
}));
vi.mock("../services/member-face-enrollment.service", () => ({ enrollMemberFaceFromForm: vi.fn() }));

import { deleteMemberAction, restoreMemberAction, updateMemberAction } from "./member.actions";

const gymId = "20000000-0000-4000-8000-000000000001";
const gymMemberId = "60000000-0000-4000-8000-000000000001";

describe("member administration actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getActiveGym.mockResolvedValue({ gymId });
  });

  it("ignora el gimnasio enviado por el navegador al editar", async () => {
    const form = new FormData();
    form.set("gymId", "20000000-0000-4000-8000-000000000002");
    form.set("gymMemberId", gymMemberId);
    form.set("firstName", "Ana");
    form.set("lastName", "Martínez");
    await updateMemberAction({ ok: false }, form);
    expect(mocks.updateMember).toHaveBeenCalledWith(expect.objectContaining({ gymId, gymMemberId }));
  });

  it("permite limpiar sucursal y contactos opcionales", async () => {
    const form = new FormData();
    form.set("gymMemberId", gymMemberId);
    form.set("firstName", "Ana");
    form.set("lastName", "MartÃ­nez");
    form.set("branchId", "");
    form.set("phone", "");
    form.set("email", "");
    await updateMemberAction({ ok: false }, form);
    expect(mocks.updateMember).toHaveBeenCalledWith(expect.objectContaining({ branchId: null, phone: "", email: "" }));
  });

  it("retira con motivo y revalida las superficies de miembros", async () => {
    const form = new FormData();
    form.set("gymMemberId", gymMemberId);
    form.set("reason", "Se retiró del gimnasio");
    await expect(deleteMemberAction({ ok: false }, form)).resolves.toMatchObject({ ok: true });
    expect(mocks.deleteMember).toHaveBeenCalledWith({ gymMemberId, reason: "Se retiró del gimnasio" });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/members");
  });

  it("restaura un miembro mediante estado serializable", async () => {
    const form = new FormData();
    form.set("gymMemberId", gymMemberId);
    await expect(restoreMemberAction({ ok: false }, form)).resolves.toMatchObject({ ok: true });
  });
});
