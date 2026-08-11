import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("../actions/active-gym.actions", () => ({
  switchActiveGymAction: vi.fn(),
}));

import { ActiveGymSwitcher } from "./active-gym-switcher";

const gyms = [
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

describe("ActiveGymSwitcher", () => {
  it("keeps a single authorized gym as non-interactive text", () => {
    const html = renderToStaticMarkup(createElement(ActiveGymSwitcher, {
      activeGym: { ...gyms[0], selectionSource: "single_membership" },
      availableGyms: [gyms[0]],
    }));

    expect(html).toContain("Gym Norte");
    expect(html).not.toContain("<select");
  });

  it("renders only authorized gyms and marks the current selection", () => {
    const html = renderToStaticMarkup(createElement(ActiveGymSwitcher, {
      activeGym: { ...gyms[1], selectionSource: "cookie" },
      availableGyms: gyms,
    }));

    expect(html).toContain("Gym Norte");
    expect(html).toContain("Gym Sur");
    expect(html).toContain(`value="${gyms[1].gymId}" selected=""`);
    expect(html).not.toContain("gym-secret");
    expect(html).toContain('aria-live="polite"');
  });

  it("implements pending and error feedback in the client component", () => {
    const source = readFileSync(
      "src/features/gyms/components/active-gym-switcher.tsx",
      "utf8",
    );

    expect(source).toContain("useFormStatus");
    expect(source).toContain("Cambiando gimnasio...");
    expect(source).toContain('role="alert"');
  });
});
