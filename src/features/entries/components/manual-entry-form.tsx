"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { ActionFeedback } from "@/features/app/components/action-feedback";

import {
  registerEntryAction,
  type EntryActionState,
} from "../actions/entry.actions";
import { getEntryDecisionState } from "../entry-decision-state";
import type { FinancialAccessStatus } from "../types/entry.dto";
import { EntryAccessNotice, getAccessPrecheck, Verdict } from "./entry-access-notice";

type ManualEntryFormProps = {
  gymId: string;
  gymMemberId: string;
  branchId: string | null;
  memberCode: string;
  memberFullName: string;
  access: {
    status: string;
    membershipStatus: string | null;
    hasOverdueCharges: boolean;
    financialAccessStatus?: FinancialAccessStatus | null;
  };
  canCharge?: boolean;
};

const initialState: EntryActionState = { ok: false };

const timeFormatter = new Intl.DateTimeFormat("es-NI", { timeStyle: "short" });

// Una sola superficie para el mostrador: antes de registrar muestra la lectura
// previa; despues, la decision real de la base reemplaza esa lectura.
export function ManualEntryForm({
  gymId,
  gymMemberId,
  branchId,
  memberCode,
  memberFullName,
  access,
  canCharge = false,
}: ManualEntryFormProps) {
  const [state, formAction] = useActionState(registerEntryAction, initialState);
  const result = state.result;
  // Si no puede entrar, lo primero que hace recepcion es cobrar.
  const chargeFirst = canCharge && getAccessPrecheck(access) === "denied";
  const chargeLink = (primary: boolean) => canCharge ? (
    <Link className={`btn ${primary ? "btn-lg btn-on-flood min-w-40" : "btn-flood-ghost"}`} href={`/payments/new?gymMemberId=${gymMemberId}`}>
      Cobrar
    </Link>
  ) : null;
  const profileLink = (
    <Link className="btn btn-flood-ghost" href={`/members/${gymMemberId}`}>
      Ver perfil
    </Link>
  );

  if (!result) {
    return (
      <EntryAccessNotice member={access} memberCode={memberCode} memberName={memberFullName}>
        <form action={formAction} className="flex flex-wrap gap-2">
          <EntryHiddenFields branchId={branchId} gymId={gymId} gymMemberId={gymMemberId} />
          {chargeFirst ? chargeLink(true) : null}
          <SubmitEntryButton primary={!chargeFirst} />
          {chargeFirst ? null : chargeLink(false)}
          {profileLink}
        </form>
        <ActionFeedback className="mt-4" state={state} />
      </EntryAccessNotice>
    );
  }

  const resultState = getEntryDecisionState(result);
  const denied = result.decision === "denied" || result.decision === "no_match";
  const tone = denied ? "stop" : resultState.tone === "warning" ? "wait" : "ok";

  return (
    <Verdict
      description={`${resultState.description} · ${timeFormatter.format(new Date(result.occurredAt))}`}
      eyebrow={denied ? "Entrada denegada" : "Entrada registrada"}
      memberCode={memberCode}
      memberName={memberFullName}
      role="status"
      tone={tone}
      word={resultState.label}
    >
      <div className="flex flex-wrap gap-2">
        {denied ? chargeLink(true) : null}
        <Link className={`btn ${denied && canCharge ? "btn-flood-ghost" : "btn-on-flood"}`} href="/entries">
          Siguiente miembro
        </Link>
        {profileLink}
      </div>

      {result.decision === "denied" ? (
        <form action={formAction} className="flood-plate mt-5 p-4">
          <EntryHiddenFields branchId={branchId} gymId={gymId} gymMemberId={gymMemberId} />
          <label className="block text-sm font-semibold" htmlFor="override-reason">
            Motivo para permitir la entrada
          </label>
          <textarea
            className="field"
            id="override-reason"
            maxLength={500}
            name="overrideReason"
            placeholder="Explica por qué se autoriza esta entrada"
            required
          />
          <OverrideButton />
        </form>
      ) : null}
      <ActionFeedback className="mt-4" state={state} />
    </Verdict>
  );
}

function EntryHiddenFields({
  gymId,
  gymMemberId,
  branchId,
}: Pick<ManualEntryFormProps, "gymId" | "gymMemberId" | "branchId">) {
  return (
    <>
      <input name="gymId" type="hidden" value={gymId} />
      <input name="gymMemberId" type="hidden" value={gymMemberId} />
      {branchId ? <input name="branchId" type="hidden" value={branchId} /> : null}
    </>
  );
}

function SubmitEntryButton({ primary }: { primary: boolean }) {
  const { pending } = useFormStatus();

  return (
    <button
      className={primary ? "btn btn-lg btn-on-flood min-w-48" : "btn btn-flood-ghost"}
      disabled={pending}
      type="submit"
    >
      {pending ? "Registrando..." : "Registrar entrada"}
    </button>
  );
}

function OverrideButton() {
  const { pending } = useFormStatus();

  return (
    <button
      className="btn btn-on-flood mt-3 w-full"
      disabled={pending}
      type="submit"
    >
      {pending ? "Registrando..." : "Permitir con motivo"}
    </button>
  );
}
