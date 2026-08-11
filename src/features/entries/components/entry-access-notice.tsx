type EntryAccessNoticeMember = {
  status: string;
  membershipStatus: string | null;
  hasOverdueCharges: boolean;
  financialAccessStatus?: "paid" | "initial_payment_required" | "grace" | "overdue" | null;
};

export function EntryAccessNotice({ member }: { member: EntryAccessNoticeMember }) {
  const inGrace = member.financialAccessStatus === "grace";
  const allowed = member.status === "active"
    && (member.membershipStatus === "active" || member.membershipStatus === "trialing")
    && (inGrace || !member.hasOverdueCharges)
    && member.financialAccessStatus !== "initial_payment_required"
    && member.financialAccessStatus !== "overdue";

  return (
    <div
      className={allowed
        ? "rounded-lg border border-emerald-300 bg-emerald-50 p-4 text-emerald-900"
        : "rounded-lg border border-brand-red bg-red-50 p-4 text-brand-red"}
      role={allowed ? "status" : "alert"}
    >
      <strong className="block text-base font-black">
        {allowed ? "Acceso permitido" : "Acceso no permitido"}
      </strong>
      <p className="mt-1 text-sm font-semibold">
        {allowed
          ? inGrace
            ? "Período de gracia activo. Puedes continuar y recordar la renovación."
            : "Puedes continuar con el registro de entrada."
          : "Revisar membresía en recepción."}
      </p>
    </div>
  );
}
