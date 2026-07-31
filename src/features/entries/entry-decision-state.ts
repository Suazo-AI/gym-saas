import type { EntryDecision } from "./types/entry.dto";

export type EntryDecisionState = {
  label: "Permitida" | "Vencida" | "Morosa" | "Bloqueada";
  description: string;
  icon: "✓" | "!" | "×";
  tone: "success" | "warning" | "danger";
};

type EntryDecisionStateInput = {
  decision: EntryDecision;
  decisionReason?: string | null;
  membershipStatus?: string | null;
  hasOverdueCharges?: boolean;
};

export function getEntryDecisionState(
  input: EntryDecisionStateInput,
): EntryDecisionState {
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

  if (input.hasOverdueCharges || input.membershipStatus === "past_due") {
    return {
      label: "Morosa",
      description: input.decisionReason ?? "El miembro tiene cargos vencidos.",
      icon: "!",
      tone: "warning",
    };
  }

  if (
    input.membershipStatus === "expired"
    || input.membershipStatus === "canceled"
    || input.membershipStatus === "paused"
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
