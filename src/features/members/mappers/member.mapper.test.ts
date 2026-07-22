import { describe, expect, it } from "vitest";

import { mapMemberSummaryRow } from "./member.mapper";

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
