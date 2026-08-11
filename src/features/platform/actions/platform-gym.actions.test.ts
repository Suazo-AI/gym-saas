import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireUser: vi.fn(),
  createPlatformGymWithOwner: vi.fn(),
  revalidatePath: vi.fn(),
  redirect: vi.fn(),
}));

vi.mock("@/features/auth/services/auth.service", () => ({ requireUser: mocks.requireUser }));
vi.mock("../services/platform.repository", () => ({ createPlatformGymWithOwner: mocks.createPlatformGymWithOwner }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));

import { createPlatformGymAction } from "./platform-gym.actions";

function validForm() {
  const form = new FormData();
  form.set("legalName", "Gimnasio Central, S.A.");
  form.set("tradeName", "Gimnasio Central");
  form.set("slug", "gimnasio-central");
  form.set("taxIdentifier", "");
  form.set("defaultCurrency", "NIO");
  form.set("timezone", "America/Managua");
  form.set("ownerName", "Ana Lopez");
  form.set("ownerEmail", "ana@example.com");
  return form;
}

describe("createPlatformGymAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.redirect.mockImplementation(() => undefined);
  });

  it("rejects a non-platform user before provisioning auth", async () => {
    mocks.requireUser.mockResolvedValue({ app_metadata: {} });
    await expect(createPlatformGymAction({ ok: false }, validForm())).resolves.toEqual({ ok: false, message: "No tienes permiso." });
    expect(mocks.createPlatformGymWithOwner).not.toHaveBeenCalled();
  });

  it("creates and redirects an authenticated platform admin", async () => {
    mocks.requireUser.mockResolvedValue({ app_metadata: { platform_role: "admin" } });
    mocks.createPlatformGymWithOwner.mockResolvedValue({ gymId: "20000000-0000-4000-8000-000000000099" });

    await createPlatformGymAction({ ok: false }, validForm());

    expect(mocks.createPlatformGymWithOwner).toHaveBeenCalledWith(expect.objectContaining({
      slug: "gimnasio-central",
      ownerEmail: "ana@example.com",
      defaultCurrency: "NIO",
    }));
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/platform/gyms");
    expect(mocks.redirect).toHaveBeenCalledWith("/platform/gyms/20000000-0000-4000-8000-000000000099?created=1");
  });
});
