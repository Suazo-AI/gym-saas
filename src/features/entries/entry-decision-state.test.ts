import { describe, expect, it } from "vitest";

import { getEntryDecisionState } from "./entry-decision-state";

describe("getEntryDecisionState", () => {
  it("labels allowed entries as Permitida", () => {
    expect(getEntryDecisionState({ decision: "allowed" }).label).toBe("Permitida");
  });

  it("shows an allowed renewal in grace as a warning", () => {
    expect(getEntryDecisionState({
      decision: "allowed",
      financialAccessStatus: "grace",
    })).toMatchObject({ label: "En gracia", tone: "warning" });
  });

  it("distinguishes initial payment from overdue renewal", () => {
    expect(getEntryDecisionState({
      decision: "denied",
      financialAccessStatus: "initial_payment_required",
    }).label).toBe("Pago pendiente");
    expect(getEntryDecisionState({
      decision: "denied",
      financialAccessStatus: "overdue",
    }).label).toBe("Morosa");
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

  it("no trata a un prospecto como bloqueado", () => {
    const state = getEntryDecisionState({
      decision: "denied",
      membershipStatus: "prospect",
      decisionReason: "El miembro aún no tiene una membresía.",
    });

    expect(state.label).toBe("Sin membresía");
    expect(state.tone).toBe("warning");
    expect(state.description).toBe("El miembro aún no tiene una membresía.");
  });

  it("no trata a un miembro inactivo como bloqueado", () => {
    expect(getEntryDecisionState({
      decision: "denied",
      membershipStatus: "inactive",
    }).tone).toBe("warning");
  });

  it("mantiene Bloqueada para estados realmente restrictivos", () => {
    for (const membershipStatus of ["suspended", "blocked", "archived"]) {
      expect(getEntryDecisionState({ decision: "denied", membershipStatus }))
        .toMatchObject({ label: "Bloqueada", tone: "danger" });
    }
  });
});
