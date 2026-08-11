import { describe, expect, it, vi } from "vitest";

vi.mock("../services/get-user-gyms", () => ({ getUserGyms: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));

import { switchActiveGymAction } from "./active-gym.actions";

const authorizedGym = {
  gymId: "11111111-1111-4111-8111-111111111111",
  tradeName: "Gym Norte",
  legalName: "Gym Norte, S.A.",
  slug: "gym-norte",
  defaultCurrency: "NIO",
  timezone: "America/Managua",
  userGymId: "user-gym-1",
  userStatus: "active",
};

function formData(gymId: string) {
  const data = new FormData();
  data.set("gymId", gymId);
  return data;
}

describe("switchActiveGymAction", () => {
  it("writes a secure session cookie only for an authorized gym", async () => {
    const setCookie = vi.fn();
    const revalidate = vi.fn();
    const redirect = vi.fn();

    await switchActiveGymAction(null, formData(authorizedGym.gymId), {
      getUserGyms: vi.fn().mockResolvedValue([authorizedGym]),
      getCookieStore: vi.fn().mockResolvedValue({ set: setCookie }),
      revalidate,
      redirect,
      isProduction: true,
    });

    expect(setCookie).toHaveBeenCalledWith("fitmanager-active-gym", authorizedGym.gymId, {
      httpOnly: true,
      sameSite: "lax",
      secure: true,
      path: "/",
    });
    expect(revalidate).toHaveBeenCalledWith("/", "layout");
    expect(redirect).toHaveBeenCalledWith("/dashboard");
  });

  it.each([
    "not-a-uuid",
    "22222222-2222-4222-8222-222222222222",
  ])("rejects an invalid or unauthorized gym id: %s", async (gymId) => {
    const setCookie = vi.fn();
    const redirect = vi.fn();

    const result = await switchActiveGymAction(null, formData(gymId), {
      getUserGyms: vi.fn().mockResolvedValue([authorizedGym]),
      getCookieStore: vi.fn().mockResolvedValue({ set: setCookie }),
      revalidate: vi.fn(),
      redirect,
      isProduction: false,
    });

    expect(result).toEqual({ error: "No pudimos cambiar el gimnasio activo." });
    expect(setCookie).not.toHaveBeenCalled();
    expect(redirect).not.toHaveBeenCalled();
  });
});
