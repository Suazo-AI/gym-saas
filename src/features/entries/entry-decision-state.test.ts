import { describe, expect, it } from "vitest";

import { getEntryDecisionState } from "./entry-decision-state";

describe("getEntryDecisionState", () => {
  it("labels allowed entries as Permitida", () => {
    expect(getEntryDecisionState({ decision: "allowed" }).label).toBe("Permitida");
  });

  it("labels manual reviews as Permitida and keeps the reason", () => {
    expect(getEntryDecisionState({
      decision: "manual_review",
      decisionReason: "Autorizado por gerencia",
    })).toMatchObject({
      label: "Permitida",
      description: "Autorizado por gerencia",
    });
  });

  it("labels denied overdue memberships as Morosa", () => {
    expect(getEntryDecisionState({
      decision: "denied",
      hasOverdueCharges: true,
    }).label).toBe("Morosa");
  });

  it("labels denied expired memberships as Vencida", () => {
    expect(getEntryDecisionState({
      decision: "denied",
      membershipStatus: "expired",
    }).label).toBe("Vencida");
  });

  it("labels no matches as Bloqueada", () => {
    expect(getEntryDecisionState({ decision: "no_match" }).label).toBe("Bloqueada");
  });
});
