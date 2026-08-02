import { describe, expect, it } from "vitest";

import { mapMemberDetailRow, mapMemberSummaryRow } from "./member.mapper";

describe("mapMemberSummaryRow", () => {
  it("maps snake_case database rows to camelCase DTOs with decimal strings", () => {
    const dto = mapMemberSummaryRow({
      gym_id: "gym-1",
      gym_member_id: "member-1",
      person_id: "person-1",
      member_code: "M-0001",
      first_name: "Ana",
      last_name: "Martinez",
      full_name: "Ana Martinez",
      status: "active",
      branch_id: "branch-1",
      branch_name: "Central",
      primary_photo_media_asset_id: "media-1",
      membership_status: "active",
      membership_plan_name: "Mensual",
      next_payment_date: "2026-08-01",
      overdue_amount: "125.50",
      has_overdue_charges: true,
      created_at: "2026-07-21T10:00:00+00:00",
    });

    expect(dto).toEqual({
      gymId: "gym-1",
      gymMemberId: "member-1",
      personId: "person-1",
      memberCode: "M-0001",
      firstName: "Ana",
      lastName: "Martinez",
      fullName: "Ana Martinez",
      status: "active",
      branchId: "branch-1",
      branchName: "Central",
      primaryPhotoMediaAssetId: "media-1",
      membershipStatus: "active",
      membershipPlanName: "Mensual",
      nextPaymentDate: "2026-08-01",
      overdueAmount: "125.50",
      hasOverdueCharges: true,
      createdAt: "2026-07-21T10:00:00+00:00",
    });
  });
});

describe("mapMemberDetailRow", () => {
  it("maps the operational membership, charge and payment contract", () => {
    const dto = mapMemberDetailRow({
      gym_id: "gym-1",
      gym_member_id: "member-1",
      person_id: "person-1",
      member_code: "M-0001",
      first_name: "Ana",
      last_name: "Martinez",
      full_name: "Ana Martinez",
      status: "active",
      branch_id: "branch-1",
      branch_name: "Central",
      primary_photo_media_asset_id: null,
      membership_status: "past_due",
      membership_plan_name: "Mensual",
      next_payment_date: "2026-07-01",
      overdue_amount: "450.00",
      has_overdue_charges: true,
      created_at: "2026-07-21T10:00:00+00:00",
      middle_name: null,
      second_last_name: null,
      birth_date: null,
      sex: null,
      notes: null,
      contacts: [{ id: "contact-1", type: "phone", value: "8888-0001", isPrimary: true }],
      primary_address: null,
      current_subscription: {
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
      pending_charges: [{
        id: "charge-1",
        periodStart: "2026-07-01",
        periodEnd: "2026-07-31",
        dueDate: "2026-07-01",
        amountDue: "900.00",
        currency: "NIO",
        status: "partial",
      }],
      payment_summary: { settledTotal: "450.00", lastPaymentAt: "2026-07-02T10:00:00+00:00" },
    });

    expect(dto.currentSubscription?.planName).toBe("Mensual");
    expect(dto.pendingCharges[0]?.currency).toBe("NIO");
    expect(dto.paymentSummary?.settledTotal).toBe("450.00");
  });
});
