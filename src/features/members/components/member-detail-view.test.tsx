import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { MemberDetailDto } from "../types/member.dto";
import { MemberDetailView } from "./member-detail-view";

const member: MemberDetailDto = {
  gymId: "gym-1",
  gymMemberId: "member-1",
  personId: "person-1",
  memberCode: "M-0001",
  firstName: "Ana",
  lastName: "Martínez",
  fullName: "Ana Martínez",
  status: "active",
  branchId: "branch-1",
  branchName: "Central",
  primaryPhotoMediaAssetId: null,
  membershipStatus: "past_due",
  membershipPlanName: "Mensual",
  nextPaymentDate: "2026-07-01",
  overdueAmount: "900.00",
  hasOverdueCharges: true,
  createdAt: "2026-06-01T10:00:00+00:00",
  middleName: null,
  secondLastName: null,
  birthDate: null,
  sex: null,
  notes: "Prefiere contacto por teléfono.",
  contacts: [{ id: "contact-1", type: "phone", value: "8888-0001", isPrimary: true }],
  primaryAddress: null,
  currentSubscription: {
    id: "subscription-1",
    status: "past_due",
    startDate: "2026-06-01",
    endDate: null,
    billingCycleMonths: 1,
    recurringAmount: "900.00",
    currency: "NIO",
    planId: "plan-1",
    planName: "Mensual",
  },
  pendingCharges: [
    {
      id: "charge-1",
      periodStart: "2026-07-01",
      periodEnd: "2026-07-31",
      dueDate: "2026-07-01",
      amountDue: "900.00",
      currency: "NIO",
      status: "pending",
    },
    {
      id: "charge-2",
      periodStart: "2026-07-01",
      periodEnd: "2026-07-31",
      dueDate: "2026-07-01",
      amountDue: "15.00",
      currency: "USD",
      status: "pending",
    },
  ],
  paymentSummary: {
    settledTotal: "450.00",
    lastPaymentAt: "2026-07-02T10:00:00+00:00",
  },
};

describe("MemberDetailView", () => {
  it("renders observed operational, membership, charge and payment data", () => {
    const html = renderToStaticMarkup(createElement(MemberDetailView, { member }));

    expect(html).toContain("Membresía en mora");
    expect(html).toContain("Ana Martínez");
    expect(html).toContain("NIO 900.00");
    expect(html).toContain("USD 15.00");
    expect(html).toContain("Total pagado registrado");
    expect(html).not.toContain("Acceso permitido");
  });
});
