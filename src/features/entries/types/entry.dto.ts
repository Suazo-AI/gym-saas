export type EntryEventDto = {
  id: string;
  gymMemberId: string | null;
  decision: string;
  decisionReason: string | null;
  occurredAt: string;
};
