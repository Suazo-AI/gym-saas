export type EntryEventDto = {
  id: string;
  gymMemberId: string | null;
  decision: string;
  decisionReason: string | null;
  occurredAt: string;
};

export type FaceVerificationDecision = "allowed" | "denied" | "manual_review" | "no_match";

export type EntryDecision = "allowed" | "denied" | "manual_review" | "no_match";

export type EntryMemberSearchResultDto = {
  gymMemberId: string;
  memberCode: string;
  fullName: string;
  status: string;
  membershipStatus: string | null;
  hasOverdueCharges: boolean;
};

export type EntrySource = "manual" | "face";

export type MemberEntryDto = {
  gymId: string;
  entryId: string;
  gymMemberId: string | null;
  source: EntrySource;
  decision: EntryDecision;
  decisionReason: string | null;
  membershipStatus: string | null;
  hasOverdueCharges: boolean;
  occurredAt: string;
};

export type RegisterEntryInput = {
  gymId: string;
  gymMemberId: string;
  branchId?: string | null;
  overrideReason?: string | null;
};

export type RegisteredEntryDto = {
  entryId: string;
  gymMemberId: string;
  decision: EntryDecision;
  decisionReason: string | null;
  accessAllowed: boolean;
  occurredAt: string;
  memberCode: string;
  memberFullName: string;
  membershipStatus: string;
  hasOverdueCharges: boolean;
};

export type MemberEntryRow = {
  gym_id: string;
  entry_id: string;
  gym_member_id: string | null;
  source: EntrySource;
  decision: EntryDecision;
  decision_reason: string | null;
  membership_status: string | null;
  has_overdue_charges: boolean | null;
  occurred_at: string;
};

export type RegisteredEntryRow = {
  entryId: string;
  gymMemberId: string;
  decision: EntryDecision;
  decisionReason: string | null;
  accessAllowed: boolean;
  occurredAt: string;
  memberCode: string;
  memberFullName: string;
  membershipStatus: string;
  hasOverdueCharges: boolean;
};

export type FaceVerificationResultDto = {
  eventId: string;
  decision: FaceVerificationDecision;
  decisionReason: string;
  gymMemberId: string | null;
  personId: string | null;
  faceEmbeddingId: string | null;
  similarity: number | null;
  accessAllowed: boolean;
};

export type FaceVerificationResponseDto = FaceVerificationResultDto & {
  member: {
    gymMemberId: string;
    fullName: string;
    memberCode: string;
  } | null;
};
