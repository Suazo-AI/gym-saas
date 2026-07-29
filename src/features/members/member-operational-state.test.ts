import { describe, expect, it } from "vitest";

import { getMemberOperationalState } from "./member-operational-state";

describe("getMemberOperationalState", () => {
  it("prioritizes a blocked member over membership state", () => {
    expect(getMemberOperationalState({
      memberStatus: "blocked",
      membershipStatus: "active",
      hasOverdueCharges: false,
    })).toEqual({
      label: "Miembro bloqueado",
      description: "Requiere revisión autorizada antes de continuar.",
      tone: "danger",
    });
  });

  it("reports overdue charges without claiming an access decision", () => {
    expect(getMemberOperationalState({
      memberStatus: "active",
      membershipStatus: "past_due",
      hasOverdueCharges: true,
    })).toEqual({
      label: "Membresía en mora",
      description: "Tiene cargos vencidos. Revisa su estado de cuenta.",
      tone: "warning",
    });
  });

  it.each(["active", "trialing"])(
    "reports %s memberships as current without claiming access",
    (membershipStatus) => {
      expect(getMemberOperationalState({
        memberStatus: "active",
        membershipStatus,
        hasOverdueCharges: false,
      })).toEqual({
        label: "Membresía vigente",
        description: "Tiene una membresía activa o en período de prueba.",
        tone: "success",
      });
    },
  );

  it("reports when the member has no active membership", () => {
    expect(getMemberOperationalState({
      memberStatus: "active",
      membershipStatus: null,
      hasOverdueCharges: false,
    })).toEqual({
      label: "Sin membresía activa",
      description: "No tiene una membresía activa o en período de prueba.",
      tone: "neutral",
    });
  });

  it("prioritizes an inactive member over membership and debt state", () => {
    expect(getMemberOperationalState({
      memberStatus: "inactive",
      membershipStatus: "past_due",
      hasOverdueCharges: true,
    })).toEqual({
      label: "Miembro inactivo",
      description: "El perfil del miembro está inactivo.",
      tone: "warning",
    });
  });
});
