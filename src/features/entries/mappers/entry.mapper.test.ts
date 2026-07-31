import { describe, expect, it } from "vitest";

import { mapMemberEntryRow, mapRegisteredEntry } from "./entry.mapper";

describe("entry mapper", () => {
  it("maps unified entry rows to camelCase", () => {
    expect(mapMemberEntryRow({
      gym_id: "gym-1",
      entry_id: "entry-1",
      gym_member_id: "member-1",
      source: "manual",
      decision: "allowed",
      decision_reason: null,
      occurred_at: "2026-07-30T15:00:00.000Z",
    })).toEqual({
      gymId: "gym-1",
      entryId: "entry-1",
      gymMemberId: "member-1",
      source: "manual",
      decision: "allowed",
      decisionReason: null,
      occurredAt: "2026-07-30T15:00:00.000Z",
    });
  });

  it("keeps the RPC result contract intact", () => {
    const row = {
      entryId: "entry-1",
      gymMemberId: "member-1",
      decision: "manual_review" as const,
      decisionReason: "Autorizado por gerencia",
      accessAllowed: false,
      occurredAt: "2026-07-30T15:00:00.000Z",
      memberCode: "M-001",
      memberFullName: "Ana Martínez",
      membershipStatus: "past_due",
      hasOverdueCharges: true,
    };

    expect(mapRegisteredEntry(row)).toEqual(row);
  });
});
