import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getActiveGym: vi.fn(),
  getPaymentReceipt: vi.fn(),
  requireGymPermission: vi.fn(),
}));

vi.mock("next/navigation", () => ({ notFound: vi.fn(), redirect: vi.fn() }));
vi.mock("@/features/gyms/services/get-active-gym", () => ({
  getActiveGym: mocks.getActiveGym,
}));
vi.mock("@/features/gyms/services/require-gym-permission", () => ({
  requireGymPermission: mocks.requireGymPermission,
}));
vi.mock("@/features/payments/services/receipt.repository", () => ({
  getPaymentReceipt: mocks.getPaymentReceipt,
}));

import ReceiptPage from "./page";

describe("ReceiptPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getActiveGym.mockResolvedValue({
      gymId: "gym-active",
      tradeName: "Impulso Fitness",
      defaultCurrency: "USD",
      timezone: "America/Managua",
    });
    mocks.requireGymPermission.mockResolvedValue(undefined);
    mocks.getPaymentReceipt.mockResolvedValue({
      id: "payment-1",
      gymMemberId: "member-1",
      amount: "900.00",
      currency: "NIO",
      status: "void",
      receiptNumber: "R-ABC1234567",
      paidAt: "2026-08-08T15:00:00.000Z",
      appliedNioPerUsd: "36.600000",
      member: { fullName: "Ana Martinez", memberCode: "M-0001" },
      paymentMethod: { id: "cash", code: "cash", name: "Efectivo" },
    });
  });

  it("muestra el sello ANULADO y exige permiso de lectura del gimnasio activo", async () => {
    const element = await ReceiptPage({ params: Promise.resolve({ paymentId: "payment-1" }) });
    const html = renderToStaticMarkup(element);

    expect(html).toContain("ANULADO");
    expect(html).toContain('aria-label="Estado: ANULADO"');
    expect(mocks.requireGymPermission).toHaveBeenCalledWith("gym-active", "payments.read");
    expect(mocks.getPaymentReceipt).toHaveBeenCalledWith({
      gymId: "gym-active",
      paymentId: "payment-1",
    });
  });
});
