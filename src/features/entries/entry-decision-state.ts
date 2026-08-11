import type { EntryDecision, FinancialAccessStatus } from "./types/entry.dto";

export type EntryDecisionState = {
  label: "Permitida" | "En gracia" | "Pago pendiente" | "Sin membresía" | "Vencida" | "Morosa" | "Bloqueada";
  description: string;
  icon: "✓" | "!" | "×";
  tone: "success" | "warning" | "danger";
};

type EntryDecisionStateInput = {
  decision: EntryDecision;
  decisionReason?: string | null;
  membershipStatus?: string | null;
  hasOverdueCharges?: boolean;
  financialAccessStatus?: FinancialAccessStatus | null;
};

export function getEntryDecisionState(
  input: EntryDecisionStateInput,
): EntryDecisionState {
  if (input.decision === "allowed" && input.financialAccessStatus === "grace") {
    return {
      label: "En gracia",
      description: input.decisionReason ?? "La renovación está pendiente dentro del período de gracia.",
      icon: "!",
      tone: "warning",
    };
  }

  if (input.decision === "allowed" || input.decision === "manual_review") {
    return {
      label: "Permitida",
      description: input.decision === "manual_review"
        ? input.decisionReason ?? "Entrada autorizada después de una revisión."
        : "El miembro puede ingresar.",
      icon: "✓",
      tone: "success",
    };
  }

  if (input.financialAccessStatus === "initial_payment_required") {
    return {
      label: "Pago pendiente",
      description: input.decisionReason ?? "El pago inicial está pendiente.",
      icon: "!",
      tone: "warning",
    };
  }

  if (
    input.financialAccessStatus === "overdue"
    || input.hasOverdueCharges
    || input.membershipStatus === "past_due"
  ) {
    return {
      label: "Morosa",
      description: input.decisionReason ?? "El miembro tiene cargos vencidos.",
      icon: "!",
      tone: "warning",
    };
  }

  // Un prospecto nunca tuvo membresía: decirle "Bloqueada" lo haría pasar por
  // alguien vetado. Es un cliente potencial que todavía no compra.
  if (input.membershipStatus === "prospect") {
    return {
      label: "Sin membresía",
      description: input.decisionReason ?? "El miembro aún no tiene una membresía.",
      icon: "!",
      tone: "warning",
    };
  }

  if (
    input.membershipStatus === "expired"
    || input.membershipStatus === "canceled"
    || input.membershipStatus === "paused"
    || input.membershipStatus === "inactive"
  ) {
    return {
      label: "Vencida",
      description: input.decisionReason ?? "El miembro no tiene una membresía vigente.",
      icon: "!",
      tone: "warning",
    };
  }

  return {
    label: "Bloqueada",
    description: input.decisionReason ?? (
      input.decision === "no_match"
        ? "No se pudo identificar al miembro."
        : "El miembro requiere revisión antes de ingresar."
    ),
    icon: "×",
    tone: "danger",
  };
}
