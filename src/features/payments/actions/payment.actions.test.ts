import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getActiveGym: vi.fn(),
  redirect: vi.fn(),
  registerMemberPayment: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/features/gyms/services/get-active-gym", () => ({ getActiveGym: mocks.getActiveGym }));
vi.mock("../services/payment.repository", () => ({
  refundPayment: vi.fn(),
  registerMemberPayment: mocks.registerMemberPayment,
  voidPayment: vi.fn(),
}));

import { registerPaymentAction } from "./payment.actions";

const gymId = "20000000-0000-4000-8000-000000000001";
const gymMemberId = "60000000-0000-4000-8000-000000000001";
const chargeId = "70000000-0000-4000-8000-000000000001";
const paymentId = "90000000-0000-4000-8000-000000000009";

describe("registerPaymentAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getActiveGym.mockResolvedValue({ gymId });
    mocks.registerMemberPayment.mockResolvedValue({
      paymentId,
      receiptNumber: "REC-E2E",
      amount: "900.00",
      currency: "NIO",
      paidAt: "2026-08-09T12:00:00Z",
    });
  });

  it("abre el recibo luego de registrar el pago", async () => {
    const form = new FormData();
    form.set("gymMemberId", gymMemberId);
    form.set("paymentMethodId", "cash");
    form.set("amount", "900.00");
    form.set("currency", "NIO");
    form.append("allocationChargeId", chargeId);
    form.append("allocationAmount", "900.00");

    await registerPaymentAction({ ok: false }, form);

    expect(mocks.registerMemberPayment).toHaveBeenCalledWith(
      expect.objectContaining({ gymId, gymMemberId, amount: "900.00" }),
    );
    expect(mocks.redirect).toHaveBeenCalledWith(`/payments/${paymentId}/receipt`);
  });
});
