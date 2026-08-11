import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getActiveGym: vi.fn(),
  hasGymPermission: vi.fn(),
  redirect: vi.fn(),
  requireGymPermission: vi.fn(),
}));

vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/features/gyms/services/get-active-gym", () => ({
  getActiveGym: mocks.getActiveGym,
}));
vi.mock("@/features/gyms/services/require-gym-permission", () => ({
  hasGymPermission: mocks.hasGymPermission,
  requireGymPermission: mocks.requireGymPermission,
}));
vi.mock("@/features/faces/components/facial-access-panel", () => ({
  FacialAccessPanel: ({ canVerify }: { canVerify: boolean }) => (
    <div>{canVerify ? "Cámara autorizada" : "Solo lectura"}</div>
  ),
}));
vi.mock("@/features/app/components/module-header", () => ({
  ModuleHeader: ({ title }: { title: string }) => <h1>{title}</h1>,
}));

import FacialAccessPage from "./page";

const activeGym = {
  gymId: "20000000-0000-4000-8000-000000000001",
  tradeName: "Impulso Fitness",
};

describe("FacialAccessPage", () => {
  beforeEach(() => {
    mocks.getActiveGym.mockReset();
    mocks.hasGymPermission.mockReset();
    mocks.redirect.mockReset();
    mocks.requireGymPermission.mockReset();
  });

  it("redirects to login without an active gym", async () => {
    mocks.getActiveGym.mockResolvedValue(null);
    mocks.redirect.mockImplementation(() => {
      throw new Error("NEXT_REDIRECT");
    });

    await expect(FacialAccessPage()).rejects.toThrow("NEXT_REDIRECT");
    expect(mocks.redirect).toHaveBeenCalledWith("/login");
  });

  it.each([
    [true, "Cámara autorizada"],
    [false, "Solo lectura"],
  ])("requires faces.read and passes faces.verify=%s to the panel", async (canVerify, text) => {
    mocks.getActiveGym.mockResolvedValue(activeGym);
    mocks.hasGymPermission.mockResolvedValue(canVerify);

    const html = renderToStaticMarkup(await FacialAccessPage());

    expect(mocks.requireGymPermission).toHaveBeenCalledWith(activeGym.gymId, "faces.read");
    expect(mocks.hasGymPermission).toHaveBeenCalledWith(activeGym.gymId, "faces.verify");
    expect(html).toContain("Acceso facial");
    expect(html).toContain(text);
  });
});
