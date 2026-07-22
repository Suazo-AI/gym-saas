import type { MemberSummaryDto, MemberSummaryRow } from "../types/member.dto";

export function mapMemberSummaryRow(row: MemberSummaryRow): MemberSummaryDto {
  return {
    gymId: row.gym_id,
    gymMemberId: row.gym_member_id,
    personId: row.person_id,
    memberCode: row.member_code,
    firstName: row.first_name,
    lastName: row.last_name,
    fullName: row.full_name,
    status: row.status,
    branchId: row.branch_id,
    branchName: row.branch_name,
    primaryPhotoMediaAssetId: row.primary_photo_media_asset_id,
    membershipStatus: row.membership_status,
    membershipPlanName: row.membership_plan_name,
    nextPaymentDate: row.next_payment_date,
    overdueAmount: row.overdue_amount == null ? "0.00" : String(row.overdue_amount),
    hasOverdueCharges: row.has_overdue_charges ?? false,
    createdAt: row.created_at,
  };
}

export function mapMemberSummaryRows(rows: MemberSummaryRow[]): MemberSummaryDto[] {
  return rows.map(mapMemberSummaryRow);
}
