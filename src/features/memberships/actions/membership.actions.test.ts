import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  cancelMemberSubscription: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("../services/membership.repository", () => ({
  assignMemberSubscription: vi.fn(),
  cancelMemberSubscription: mocks.cancelMemberSubscription,
}));

import { cancelMembershipAction } from "./membership.actions";

describe("membership actions", () => {
  beforeEach(() => vi.clearAllMocks());

  it("cancels immediately and revalidates member surfaces", async () => {
    const form = new FormData();
    form.set("gymMemberId", "60000000-0000-4000-8000-000000000001");
    form.set("subscriptionId", "50000000-0000-4000-8000-000000000001");
    form.set("reason", "Solicitud del miembro");

    await expect(cancelMembershipAction({ ok: false }, form)).resolves.toMatchObject({
      ok: true,
      message: "Membresía cancelada.",
    });
    expect(mocks.cancelMemberSubscription).toHaveBeenCalledWith(expect.objectContaining({
      cancelAtPeriodEnd: false,
    }));
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/members/60000000-0000-4000-8000-000000000001");
  });
});
