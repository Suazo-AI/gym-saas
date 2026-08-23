"use client";

import Link from "next/link";
import { useActionState, useState } from "react";

import { ActionFeedback } from "@/features/app/components/action-feedback";

import {
  recordPaymentAction,
  refundPaymentAction,
  voidPaymentAction,
  type PaymentActionState,
} from "../actions/payment.actions";
import type {
  PayableChargeDto,
  PaymentMethodDto,
  PaymentSummaryDto,
} from "../types/payment.dto";

const initial: PaymentActionState = { ok: false };
const input = "min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 py-2";

export function PaymentManagement({
  charges,
  methods,
  payments,
}: {
  charges: PayableChargeDto[];
  methods: PaymentMethodDto[];
  payments: PaymentSummaryDto[];
}) {
  const [selected, setSelected] = useState("");
  const [paymentMethodId, setPaymentMethodId] = useState("");
  const charge = charges.find((candidate) => candidate.chargeId === selected);
  const [state, action, pending] = useActionState(recordPaymentAction, initial);

  return (
    <div className="mt-6 grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <p className="text-xs font-black uppercase tracking-[.16em] text-brand-green">Nuevo cobro</p>
        <h2 className="mt-2 text-xl font-black text-ink">Registrar pago</h2>
        {charges.length === 0 ? (
          <p className="mt-4 text-gray">No hay cargos pendientes por cobrar.</p>
        ) : (
          <form action={action} className="mt-5 grid gap-4">
            <label className="text-sm font-bold">
              Cargo
              <select
                className={input}
                name="chargeId"
                onChange={(event) => {
                  setSelected(event.target.value);
                  setPaymentMethodId("");
                }}
                value={selected}
              >
                <option value="">Selecciona un cargo</option>
                {charges.map((candidate) => (
                  <option key={candidate.chargeId} value={candidate.chargeId}>
                    {candidate.memberLabel} · {candidate.currency} {candidate.amountDue} · vence {candidate.dueDate}
                  </option>
                ))}
              </select>
            </label>
            <input name="gymMemberId" type="hidden" value={charge?.gymMemberId ?? ""} />
            <input name="currency" type="hidden" value={charge?.currency ?? ""} />
            <label className="text-sm font-bold">
              Monto
              <input
                className={input}
                defaultValue={charge?.amountDue ?? ""}
                disabled={!charge}
                inputMode="decimal"
                key={selected || "no-charge"}
                name="amount"
                pattern="^\d+(\.\d{1,2})?$"
                required={Boolean(charge)}
              />
            </label>
            <div
              aria-live="polite"
              className={`rounded-xl border p-4 ${charge ? "border-brand-green bg-green-50" : "border-slate-200 bg-slate-50"}`}
            >
              {charge ? (
                <>
                  <p className="text-xs font-black uppercase tracking-[.16em] text-brand-green">
                    Miembro y cargo seleccionados
                  </p>
                  <strong className="mt-2 block text-lg text-ink">{charge.memberLabel}</strong>
                  <p className="mt-1 text-sm font-semibold text-gray">
                    Vence {charge.dueDate} · Saldo {charge.currency} {charge.amountDue}
                  </p>
                </>
              ) : (
                <>
                  <strong className="block text-ink">No hay cargo seleccionado</strong>
                  <p className="mt-1 text-sm text-gray">Elige el miembro y revisa el saldo antes de cobrar.</p>
                </>
              )}
            </div>
            <label className="text-sm font-bold">
              Método
              <select
                className={input}
                disabled={!charge}
                name="paymentMethodId"
                onChange={(event) => setPaymentMethodId(event.target.value)}
                required
                value={paymentMethodId}
              >
                <option value="">Selecciona un método</option>
                {methods.map((method) => (
                  <option key={method.id} value={method.id}>{method.name}</option>
                ))}
              </select>
            </label>
            <label className="text-sm font-bold">
              Notas
              <input className={input} name="notes" maxLength={500} />
            </label>
            <Message state={state} />
            <button
              className="min-h-11 rounded-lg bg-brand-green px-4 font-black text-white disabled:opacity-60"
              disabled={!charge || !paymentMethodId || pending}
              type="submit"
            >
              {pending ? "Registrando..." : "Registrar pago y generar recibo"}
            </button>
          </form>
        )}
        <p className="mt-4 text-xs text-gray">
          Puedes cobrar un abono o el saldo completo en la moneda del cargo. La tasa vigente queda
          guardada como referencia histórica.
        </p>
      </section>
      <PaymentList payments={payments} />
    </div>
  );
}

function PaymentList({ payments }: { payments: PaymentSummaryDto[] }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="p-5"><h2 className="text-xl font-black text-ink">Pagos recientes</h2></div>
      {payments.length === 0 ? (
        <p className="p-5 text-gray">No hay pagos registrados.</p>
      ) : (
        <div className="divide-y">
          {payments.map((payment) => <PaymentRow key={payment.id} payment={payment} />)}
        </div>
      )}
    </section>
  );
}

function PaymentRow({ payment }: { payment: PaymentSummaryDto }) {
  const [voidState, voidAction, voidPending] = useActionState(voidPaymentAction, initial);
  const [refundState, refundAction, refundPending] = useActionState(
    refundPaymentAction,
    initial,
  );
  const canRefund = payment.status === "settled" || payment.status === "partially_refunded";
  return (
    <article className="p-4">
      <div className="flex flex-wrap justify-between gap-3">
        <div>
          <Link
            className="mb-2 inline-block text-sm font-black text-brand-green underline"
            href={`/payments/${payment.id}/receipt`}
          >
            Recibo
          </Link>
          <strong className="block text-ink">{payment.receiptNumber}</strong>
          <p className="text-sm text-gray">
            {payment.currency} {payment.amount} · {payment.status} · tasa C${payment.appliedNioPerUsd}
          </p>
        </div>
        {payment.status === "settled" ? (
          <details>
            <summary className="inline-flex min-h-11 cursor-pointer items-center rounded-lg bg-amber-50 px-4 py-3 text-sm font-black text-amber-900">
              Anular
            </summary>
            <form action={voidAction} className="mt-2 flex gap-2">
              <input name="paymentId" type="hidden" value={payment.id} />
              <input className={input} name="reason" placeholder="Motivo" required />
              <button className="rounded-lg bg-red-700 px-3 text-sm font-black text-white" disabled={voidPending}>
                Confirmar
              </button>
            </form>
          </details>
        ) : null}
        {canRefund ? (
          <details>
            <summary className="inline-flex min-h-11 cursor-pointer items-center rounded-lg bg-amber-50 px-4 py-3 text-sm font-black text-amber-900">
              Reembolsar
            </summary>
            <form action={refundAction} className="mt-2 grid gap-2 sm:grid-cols-2">
              <input name="paymentId" type="hidden" value={payment.id} />
              <input
                className={input}
                inputMode="decimal"
                max={payment.amount}
                name="amount"
                pattern="^\d+(\.\d{1,2})?$"
                placeholder="Monto"
                required
              />
              <input className={input} name="reason" placeholder="Motivo" required />
              <button
                className="rounded-lg bg-amber-700 px-3 py-2 text-sm font-black text-white disabled:opacity-60 sm:col-span-2"
                disabled={refundPending}
              >
                {refundPending ? "Registrando..." : "Confirmar reembolso"}
              </button>
            </form>
          </details>
        ) : null}
      </div>
      <Message state={voidState} />
      <Message state={refundState} />
    </article>
  );
}

function Message({ state }: { state: PaymentActionState }) {
  return <ActionFeedback state={state} />;
}
