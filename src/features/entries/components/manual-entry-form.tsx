"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import {
  registerEntryAction,
  type EntryActionState,
} from "../actions/entry.actions";
import { getEntryDecisionState } from "../entry-decision-state";

type ManualEntryFormProps = {
  gymId: string;
  gymMemberId: string;
  branchId: string | null;
  memberCode: string;
  memberFullName: string;
};

const initialState: EntryActionState = { ok: false };

export function ManualEntryForm({
  gymId,
  gymMemberId,
  branchId,
  memberCode,
  memberFullName,
}: ManualEntryFormProps) {
  const [state, formAction] = useActionState(registerEntryAction, initialState);
  const resultState = state.result ? getEntryDecisionState(state.result) : null;

  return (
    <div className="rounded-lg border border-charcoal bg-paper p-5 shadow-sm">
      <div className="mb-5">
        <p className="text-sm font-bold text-charcoal">Miembro seleccionado</p>
        <h2 className="mt-1 text-xl font-black text-ink">{memberFullName}</h2>
        <p className="mt-1 text-sm text-charcoal">Código {memberCode}</p>
      </div>

      <form action={formAction}>
        <EntryHiddenFields
          branchId={branchId}
          gymId={gymId}
          gymMemberId={gymMemberId}
        />
        <SubmitEntryButton />
      </form>

      {state.message && !state.result ? (
        <p
          className="mt-4 rounded-md border border-brand-red bg-red-50 px-4 py-3 text-sm font-semibold text-brand-red"
          role="alert"
        >
          {state.message}
        </p>
      ) : null}

      {state.result && resultState ? (
        <div
          className={`mt-5 rounded-lg border p-5 ${
            resultState.tone === "success"
              ? "border-green-700 bg-green-50"
              : resultState.tone === "warning"
                ? "border-brand-amber bg-brand-sand"
                : "border-brand-red bg-red-50"
          }`}
          role="status"
        >
          <div className="flex items-center gap-3">
            <span aria-hidden="true" className="text-3xl font-black text-ink">
              {resultState.icon}
            </span>
            <div>
              <p className="text-2xl font-black text-ink">{resultState.label}</p>
              <p className="mt-1 text-sm font-semibold text-charcoal">
                {resultState.description}
              </p>
            </div>
          </div>
        </div>
      ) : null}

      {state.result?.decision === "denied" ? (
        <form action={formAction} className="mt-5 border-t border-gray pt-5">
          <EntryHiddenFields
            branchId={branchId}
            gymId={gymId}
            gymMemberId={gymMemberId}
          />
          <label className="text-sm font-black text-ink" htmlFor="override-reason">
            Motivo para permitir la entrada
          </label>
          <textarea
            className="mt-2 min-h-24 w-full rounded-md border border-gray px-3 py-3 text-sm text-ink outline-none focus:border-brand-orange focus:ring-2 focus:ring-brand-sand"
            id="override-reason"
            maxLength={500}
            name="overrideReason"
            placeholder="Explica por qué se autoriza esta entrada"
            required
          />
          <OverrideButton />
        </form>
      ) : null}
    </div>
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

function SubmitEntryButton() {
  const { pending } = useFormStatus();

  return (
    <button
      className="min-h-11 w-full rounded-md bg-brand-orange px-5 py-3 text-sm font-black text-ink hover:bg-brand-red hover:text-paper disabled:cursor-not-allowed disabled:opacity-60"
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
      className="mt-3 min-h-11 w-full rounded-md border border-charcoal px-5 py-3 text-sm font-black text-ink hover:bg-gray-light disabled:cursor-not-allowed disabled:opacity-60"
      disabled={pending}
      type="submit"
    >
      {pending ? "Registrando..." : "Permitir con motivo"}
    </button>
  );
}
