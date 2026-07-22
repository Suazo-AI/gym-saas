export type EntryEventDto = {
  id: string;
  gymMemberId: string | null;
  decision: string;
  decisionReason: string | null;
  occurredAt: string;
};

export type FaceVerificationDecision = "allowed" | "denied" | "manual_review" | "no_match";

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
