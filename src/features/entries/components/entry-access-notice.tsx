import type { ReactNode } from "react";

type EntryAccessNoticeMember = {
  status: string;
  membershipStatus: string | null;
  hasOverdueCharges: boolean;
  financialAccessStatus?: "paid" | "initial_payment_required" | "grace" | "overdue" | null;
};

export type AccessPrecheck = "allowed" | "grace" | "denied";

// Lectura previa para recepcion. La decision real la toma la RPC al registrar.
export function getAccessPrecheck(member: EntryAccessNoticeMember): AccessPrecheck {
  const inGrace = member.financialAccessStatus === "grace";
  const allowed = member.status === "active"
    && (member.membershipStatus === "active" || member.membershipStatus === "trialing")
    && (inGrace || !member.hasOverdueCharges)
    && member.financialAccessStatus !== "initial_payment_required"
    && member.financialAccessStatus !== "overdue";
  if (!allowed) return "denied";
  return inGrace ? "grace" : "allowed";
}

export const precheckChip: Record<AccessPrecheck, { label: string; className: string }> = {
  allowed: { label: "Puede entrar", className: "chip chip-ok" },
  grace: { label: "En gracia", className: "chip chip-wait" },
  denied: { label: "No puede entrar", className: "chip chip-stop" },
};

export function EntryAccessNotice({
  member,
  memberName,
  memberCode,
  children,
}: {
  member: EntryAccessNoticeMember;
  memberName?: string;
  memberCode?: string;
  children?: ReactNode;
}) {
  const precheck = getAccessPrecheck(member);
  const allowed = precheck !== "denied";

  return (
    <Verdict
      description={allowed
        ? precheck === "grace"
          ? "Período de gracia activo. Puedes continuar y recordar la renovación."
          : "Puedes continuar con el registro de entrada."
        : "Revisar membresía en recepción."}
      eyebrow={allowed ? "Acceso permitido" : "Acceso no permitido"}
      memberCode={memberCode}
      memberName={memberName}
      role={allowed ? "status" : "alert"}
      tone={precheck === "allowed" ? "ok" : precheck === "grace" ? "wait" : "stop"}
      word={precheck === "allowed" ? "Puede entrar" : precheck === "grace" ? "En gracia" : "No puede entrar"}
    >
      {children}
    </Verdict>
  );
}

export function Verdict({
  tone,
  eyebrow,
  word,
  description,
  memberName,
  memberCode,
  role,
  children,
}: {
  tone: "ok" | "wait" | "stop";
  eyebrow: string;
  word: string;
  description: string;
  memberName?: string;
  memberCode?: string;
  role: "status" | "alert";
  children?: ReactNode;
}) {
  return (
    <div className={`verdict verdict-${tone}`} role={role}>
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-2">
        <strong className="block text-sm font-semibold opacity-90">{eyebrow}</strong>
        {memberName ? (
          <span className="text-right text-sm opacity-90">
            <span className="block font-semibold">{memberName}</span>
            {memberCode ? <span className="tabular block opacity-80">{memberCode}</span> : null}
          </span>
        ) : null}
      </div>
      <p aria-hidden="true" className="verdict-word mt-5">{word}</p>
      <p className="mt-3 max-w-md text-[0.9375rem] font-medium opacity-95">{description}</p>
      {children ? <div className="mt-6">{children}</div> : null}
    </div>
  );
}
