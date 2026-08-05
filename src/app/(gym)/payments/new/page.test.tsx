import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getMember: vi.fn(),
  listMemberPendingCharges: vi.fn(),
  listPaymentMethods: vi.fn(),
}));

vi.mock("next/navigation", () => ({ redirect: vi.fn(), useRouter: () => ({ replace: vi.fn() }), usePathname: () => "/payments/new", useSearchParams: () => new URLSearchParams() }));

vi.mock("@/features/auth/services/auth.service", () => ({
  requireUser: vi.fn().mockResolvedValue({ email: "owner@example.com" }),
}));

vi.mock("@/features/gyms/services/get-active-gym", () => ({
  getActiveGym: vi.fn().mockResolvedValue({
    gymId: "gym-1",
    tradeName: "Impulso Fitness",
    defaultCurrency: "NIO",
  }),
}));

vi.mock("@/features/members/services/member.repository", () => ({
  getMember: mocks.getMember,
  listMembers: vi.fn(),
}));

vi.mock("@/features/payments/services/payment.repository", () => ({
  listMemberPendingCharges: mocks.listMemberPendingCharges,
  listPaymentMethods: mocks.listPaymentMethods,
}));

vi.mock("@/features/app/components/app-shell", () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => <main>{children}</main>,
}));

vi.mock("@/features/app/components/module-header", () => ({
  ModuleHeader: ({ title }: { title: string }) => <h1>{title}</h1>,
}));

vi.mock("@/features/payments/components/register-payment-form", () => ({
  RegisterPaymentForm: ({ charges }: { charges: Array<{
    chargeId: string;
    amountDue: string;
    amountPaid: string;
    amountRemaining: string;
  }> }) => (
    <div>
      Formulario con {charges.length} cargo: {charges[0]?.amountDue} {charges[0]?.amountPaid} {charges[0]?.amountRemaining}
    </div>
  ),
}));

import NewPaymentPage from "./page";

describe("NewPaymentPage", () => {
  const gymMemberId = "2f1a174a-54b0-4c62-aea8-8db35fda743d";

  beforeEach(() => {
    mocks.getMember.mockReset();
    mocks.listMemberPendingCharges.mockReset();
    mocks.listPaymentMethods.mockReset();
    mocks.getMember.mockResolvedValue({
      gymMemberId,
      fullName: "Ana Martínez",
      memberCode: "M-0001",
      status: "active",
    });
    mocks.listPaymentMethods.mockResolvedValue([]);
  });

  it("muestra el estado vacío cuando el miembro no tiene cargos pendientes", async () => {
    mocks.listMemberPendingCharges.mockResolvedValue([]);

    const element = await NewPaymentPage({
      searchParams: Promise.resolve({ gymMemberId }),
    });
    const html = renderToStaticMarkup(element);

    expect(html).toContain("Ana Martínez");
    expect(html).toContain("No hay cargos pendientes.");
  });

  it("muestra los cargos pendientes y el formulario de cobro", async () => {
    mocks.listMemberPendingCharges.mockResolvedValue([
      {
        chargeId: "charge-1",
        periodStart: "2026-07-01",
        periodEnd: "2026-07-31",
        dueDate: "2026-07-01",
        amountDue: "900.00",
        amountPaid: "100.00",
        amountRemaining: "800.00",
        currency: "NIO",
        status: "partial",
      },
    ]);

    const element = await NewPaymentPage({
      searchParams: Promise.resolve({ gymMemberId }),
    });
    const html = renderToStaticMarkup(element);

    expect(mocks.listMemberPendingCharges).toHaveBeenCalledWith({
      gymId: "gym-1",
      gymMemberId,
    });
    expect(html).toContain("900.00");
    expect(html).toContain("100.00");
    expect(html).toContain("800.00");
    expect(html).toContain("Formulario con 1 cargo");
  });
});
