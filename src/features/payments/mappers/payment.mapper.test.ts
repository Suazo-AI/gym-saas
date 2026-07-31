import { describe, expect, it } from "vitest";

import { mapPendingChargeRow, mapRegisteredPayment } from "./payment.mapper";

describe("payment mappers", () => {
  it("mapea un cargo pendiente sin convertir montos a number", () => {
    expect(
      mapPendingChargeRow({
        gym_id: "gym-1",
        gym_member_id: "member-1",
        charge_id: "charge-1",
        member_subscription_id: "subscription-1",
        period_start: "2026-07-01",
        period_end: "2026-07-31",
        due_date: "2026-07-01",
        amount_due: 900,
        amount_paid: "125.50",
        amount_remaining: 774.5,
        currency: "NIO",
        status: "partial",
      }),
    ).toEqual({
      gymId: "gym-1",
      gymMemberId: "member-1",
      chargeId: "charge-1",
      memberSubscriptionId: "subscription-1",
      periodStart: "2026-07-01",
      periodEnd: "2026-07-31",
      dueDate: "2026-07-01",
      amountDue: "900",
      amountPaid: "125.50",
      amountRemaining: "774.5",
      currency: "NIO",
      status: "partial",
    });
  });

  it("mapea la respuesta de la RPC y conserva todos los montos como string", () => {
    expect(
      mapRegisteredPayment({
        paymentId: "payment-1",
        receiptNumber: "R-ABC123",
        amount: 125.5,
        currency: "NIO",
        paidAt: "2026-07-30T14:00:00+00:00",
        allocations: [
          { chargeId: "charge-1", amount: 125.5, chargeStatus: "partial" },
        ],
        remainingBalance: 774.5,
      }),
    ).toEqual({
      paymentId: "payment-1",
      receiptNumber: "R-ABC123",
      amount: "125.5",
      currency: "NIO",
      paidAt: "2026-07-30T14:00:00+00:00",
      allocations: [
        { chargeId: "charge-1", amount: "125.5", chargeStatus: "partial" },
      ],
      remainingBalance: "774.5",
    });
  });
});
