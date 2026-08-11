import { describe, expect, it, vi } from "vitest";

vi.mock("./get-user-gyms", () => ({ getUserGyms: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: vi.fn() }));

import { resolveActiveGym } from "./get-active-gym";
import type { UserGymDto } from "../types/gym.dto";

const gyms: UserGymDto[] = [
  {
    gymId: "11111111-1111-4111-8111-111111111111",
    tradeName: "Gym Norte",
    legalName: "Gym Norte, S.A.",
    slug: "gym-norte",
    defaultCurrency: "NIO",
    timezone: "America/Managua",
    userGymId: "user-gym-1",
    userStatus: "active",
  },
  {
    gymId: "22222222-2222-4222-8222-222222222222",
    tradeName: "Gym Sur",
    legalName: "Gym Sur, S.A.",
    slug: "gym-sur",
    defaultCurrency: "USD",
    timezone: "America/Managua",
    userGymId: "user-gym-2",
    userStatus: "active",
  },
];

describe("resolveActiveGym", () => {
  it("uses a selected gym only when it belongs to the authorized list", () => {
    expect(resolveActiveGym(gyms, gyms[1].gymId)).toEqual({
      ...gyms[1],
      selectionSource: "cookie",
    });
  });

  it("falls back to the first authorized gym for a manipulated id", () => {
    expect(resolveActiveGym(gyms, "33333333-3333-4333-8333-333333333333")).toEqual({
      ...gyms[0],
      selectionSource: "first_membership",
    });
  });

  it("marks a single membership without depending on a stored selection", () => {
    expect(resolveActiveGym([gyms[0]], gyms[0].gymId)).toEqual({
      ...gyms[0],
      selectionSource: "single_membership",
    });
  });

  it("returns null without authorized gyms", () => {
    expect(resolveActiveGym([], gyms[0].gymId)).toBeNull();
  });
});
