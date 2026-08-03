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
      membership_status: "active",
      has_overdue_charges: false,
      occurred_at: "2026-07-30T15:00:00.000Z",
    })).toEqual({
      gymId: "gym-1",
      entryId: "entry-1",
      gymMemberId: "member-1",
      source: "manual",
      decision: "allowed",
      decisionReason: null,
      membershipStatus: "active",
      hasOverdueCharges: false,
      occurredAt: "2026-07-30T15:00:00.000Z",
    });
  });

  it("trata como al día lo que la vista no informa (eventos faciales)", () => {
    const mapped = mapMemberEntryRow({
      gym_id: "gym-1",
      entry_id: "face-1",
      gym_member_id: "member-1",
      source: "face",
      decision: "allowed",
      decision_reason: null,
      membership_status: null,
      has_overdue_charges: null,
      occurred_at: "2026-07-30T15:00:00.000Z",
    });

    expect(mapped.membershipStatus).toBeNull();
    expect(mapped.hasOverdueCharges).toBe(false);
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
