export type MemberOperationalState = {
  label: string;
  description: string;
  tone: "success" | "warning" | "danger" | "neutral";
};

type MemberOperationalStateInput = {
  memberStatus: string;
  membershipStatus: string | null;
  hasOverdueCharges: boolean;
};

export function getMemberOperationalState(
  input: MemberOperationalStateInput,
): MemberOperationalState {
  if (input.memberStatus === "blocked") {
    return {
      label: "Miembro bloqueado",
      description: "Requiere revisión autorizada antes de continuar.",
      tone: "danger",
    };
  }

  if (input.memberStatus === "inactive") {
    return {
      label: "Miembro inactivo",
      description: "El perfil del miembro está inactivo.",
      tone: "warning",
    };
  }

  if (input.hasOverdueCharges || input.membershipStatus === "past_due") {
    return {
      label: "Membresía en mora",
      description: "Tiene cargos vencidos. Revisa su estado de cuenta.",
      tone: "warning",
    };
  }

  if (input.membershipStatus === "active" || input.membershipStatus === "trialing") {
    return {
      label: "Membresía vigente",
      description: "Tiene una membresía activa o en período de prueba.",
      tone: "success",
    };
  }

  return {
    label: "Sin membresía activa",
    description: "No tiene una membresía activa o en período de prueba.",
    tone: "neutral",
  };
}
