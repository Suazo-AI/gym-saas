import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("../actions/payment.actions", () => ({
  recordPaymentAction: vi.fn(),
  refundPaymentAction: vi.fn(),
  voidPaymentAction: vi.fn(),
}));

import { PaymentManagement } from "./payment-management";

describe("PaymentManagement", () => {
  it("presenta abonos, recibo y anulación", () => {
    const html = renderToStaticMarkup(createElement(PaymentManagement, {
      charges: [{
        chargeId: "c",
        gymMemberId: "m",
        memberLabel: "M-1 - Ana",
        dueDate: "2026-08-04",
        amountDue: "900.00",
        currency: "NIO",
        status: "overdue",
      }],
      methods: [{ id: "cash", code: "cash", name: "Efectivo", isCash: true }],
      payments: [{
        id: "p",
        gymMemberId: "m",
        amount: "900.00",
        currency: "NIO",
        status: "settled",
        receiptNumber: "R-ABC1234567",
        paidAt: "2026-08-04",
        appliedNioPerUsd: "36.600000",
      }],
    }));

    expect(html).toContain("Registrar pago");
    expect(html).toContain('name="amount"');
    expect(html).toContain("Puedes cobrar un abono");
    expect(html).toContain("generar recibo");
    expect(html).toContain("Anular");
    expect(html).toContain("Reembolsar");
    expect(html).toContain('name="amount"');
    expect(html).toContain("Confirmar reembolso");
    expect(html).toContain("C$36.600000");
    expect(html).toContain('href="/payments/p/receipt"');
    expect(html).toContain("Recibo");
  });

  it("no prepara un cobro hasta que la recepcionista elige el cargo", () => {
    const html = renderToStaticMarkup(createElement(PaymentManagement, {
      charges: [{
        chargeId: "c",
        gymMemberId: "m",
        memberLabel: "M-1 - Ana",
        dueDate: "2026-08-04",
        amountDue: "900.00",
        currency: "NIO",
        status: "overdue",
      }],
      methods: [{ id: "cash", code: "cash", name: "Efectivo", isCash: true }],
      payments: [],
    }));

    const amountInput = html.match(/<input[^>]*name="amount"[^>]*>/)?.[0] ?? "";
    const submitButton = html.match(/<button[^>]*>Registrar pago y generar recibo<\/button>/)?.[0] ?? "";

    expect(html).toContain('<option value="" selected="">Selecciona un cargo</option>');
    expect(html).toContain('<option value="" selected="">Selecciona un método</option>');
    expect(html).toContain("No hay cargo seleccionado");
    expect(amountInput).toContain('disabled=""');
    expect(amountInput).not.toContain('value="900.00"');
    expect(submitButton).toContain('disabled=""');
  });
});
