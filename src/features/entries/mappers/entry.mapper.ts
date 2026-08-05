import type {
  MemberEntryDto,
  MemberEntryRow,
  RegisteredEntryDto,
  RegisteredEntryRow,
} from "../types/entry.dto";

export function mapMemberEntryRow(row: MemberEntryRow): MemberEntryDto {
  return {
    gymId: row.gym_id,
    entryId: row.entry_id,
    gymMemberId: row.gym_member_id,
    source: row.source,
    decision: row.decision,
    decisionReason: row.decision_reason,
    membershipStatus: row.membership_status,
    hasOverdueCharges: row.has_overdue_charges ?? false,
    occurredAt: row.occurred_at,
  };
}

export function mapMemberEntryRows(rows: MemberEntryRow[]): MemberEntryDto[] {
  return rows.map(mapMemberEntryRow);
}

export function mapRegisteredEntry(row: RegisteredEntryRow): RegisteredEntryDto {
  return {
    entryId: row.entryId,
    gymMemberId: row.gymMemberId,
    decision: row.decision,
    decisionReason: row.decisionReason,
    accessAllowed: row.accessAllowed,
    occurredAt: row.occurredAt,
    memberCode: row.memberCode,
    memberFullName: row.memberFullName,
    membershipStatus: row.membershipStatus,
    hasOverdueCharges: row.hasOverdueCharges,
  };
}
