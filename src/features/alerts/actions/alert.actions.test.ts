import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getActiveGym: vi.fn(),
  transitionGymAlert: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/features/gyms/services/get-active-gym", () => ({ getActiveGym: mocks.getActiveGym }));
vi.mock("../services/alert.repository", () => ({ transitionGymAlert: mocks.transitionGymAlert }));

import { acknowledgeAlertAction, resolveAlertAction } from "./alert.actions";

const gymId = "20000000-0000-4000-8000-000000000001";
const alertId = "90000000-0000-4000-8000-000000000001";

describe("alert actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getActiveGym.mockResolvedValue({ gymId });
  });

  it("derives the gym from the authenticated session when acknowledging", async () => {
    const form = new FormData();
    form.set("alertId", alertId);
    await expect(acknowledgeAlertAction({ ok: false }, form)).resolves.toMatchObject({ ok: true });
    expect(mocks.transitionGymAlert).toHaveBeenCalledWith({ gymId, alertId, status: "acknowledged" });
  });

  it("resolves the alert and refreshes alerts and dashboard", async () => {
    const form = new FormData();
    form.set("alertId", alertId);
    await expect(resolveAlertAction({ ok: false }, form)).resolves.toMatchObject({ ok: true });
    expect(mocks.transitionGymAlert).toHaveBeenCalledWith({ gymId, alertId, status: "resolved" });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/alerts");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/dashboard");
  });
});
