import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getActiveGym: vi.fn(),
  getUserGyms: vi.fn(),
}));

vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/features/auth/services/auth.service", () => ({
  requireUser: vi.fn().mockResolvedValue({ email: "owner@example.com" }),
}));
vi.mock("@/features/gyms/services/get-active-gym", () => ({
  getActiveGym: mocks.getActiveGym,
}));
vi.mock("@/features/gyms/services/get-user-gyms", () => ({
  getUserGyms: mocks.getUserGyms,
}));
vi.mock("@/features/app/components/app-shell", () => ({
  AppShell: ({ availableGyms, children }: {
    availableGyms: Array<{ tradeName: string }>;
    children: React.ReactNode;
  }) => <main>{availableGyms.map((gym) => gym.tradeName).join("|")}{children}</main>,
}));

import GymLayout from "./layout";

describe("GymLayout", () => {
  it("passes only the server-authorized gyms into the app shell", async () => {
    const gyms = [
      { gymId: "gym-1", tradeName: "Gym Norte" },
      { gymId: "gym-2", tradeName: "Gym Sur" },
    ];
    mocks.getActiveGym.mockResolvedValue({ ...gyms[0], selectionSource: "cookie" });
    mocks.getUserGyms.mockResolvedValue(gyms);

    const element = await GymLayout({ children: <p>Contenido</p> });
    const html = renderToStaticMarkup(element);

    expect(html).toContain("Gym Norte|Gym Sur");
    expect(mocks.getUserGyms).toHaveBeenCalledOnce();
  });
});
