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
const input = "field min-w-0";
const statusLabels: Record<string, string> = {
  pending: "Pendiente",
  processing: "Procesando",
  settled: "Pagado",
  paid: "Pagado",
  failed: "Fallido",
  refunded: "Reembolsado",
  partially_refunded: "Reembolso parcial",
  void: "Anulado",
};
const statusChips: Record<string, string> = {
  settled: "chip-ok", paid: "chip-ok",
  void: "chip-stop", failed: "chip-stop", refunded: "chip-stop",
  partially_refunded: "chip-wait", pending: "chip-wait", processing: "chip-wait",
};

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
    <div className="mt-6 grid items-start gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
      <section className="panel min-w-0 p-5">
        <p className="type-eyebrow">Nuevo cobro</p>
        <h2 className="type-heading mt-1">Registrar pago</h2>
        {charges.length === 0 ? (
          <p className="mt-4 text-sm text-muted">No hay cargos pendientes por cobrar.</p>
        ) : (
          <form action={action} className="mt-5 grid gap-4">
            <label className="field-label min-w-0">
              Cargo
              <select
                className={`${input} tabular`}
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
            <label className="field-label">
              Monto{charge ? <span className="tabular"> ({charge.currency})</span> : null}
              <input
                className={`${input} tabular`}
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
              className={`rounded-xl border border-line p-4 ${charge ? "bg-accent-tint" : "bg-fill"}`}
            >
              {charge ? (
                <>
                  <p className="type-eyebrow">
                    Miembro y cargo seleccionados
                  </p>
                  <strong className="mt-2 block break-words text-lg text-ink">{charge.memberLabel}</strong>
                  <p className="tabular mt-1 text-sm text-muted">
                    Vence {charge.dueDate} · Saldo {charge.currency} {charge.amountDue}
                  </p>
                </>
              ) : (
                <>
                  <strong className="block text-ink">No hay cargo seleccionado</strong>
                  <p className="mt-1 text-sm text-muted">Elige el miembro y revisa el saldo antes de cobrar.</p>
                </>
              )}
            </div>
            <label className="field-label">
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
            <label className="field-label">
              Notas
              <input className={input} name="notes" maxLength={500} />
            </label>
            <Message state={state} />
            <button
              className="btn btn-lg btn-primary whitespace-normal"
              disabled={!charge || !paymentMethodId || pending}
              type="submit"
            >
              {pending ? "Registrando..." : "Registrar pago y generar recibo"}
            </button>
          </form>
        )}
        <p className="mt-4 text-xs leading-relaxed text-muted">
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
    <section className="panel min-w-0 overflow-hidden">
      <div className="panel-head"><h2 className="type-heading">Pagos recientes</h2></div>
      {payments.length === 0 ? (
        <p className="p-5 text-sm text-muted">No hay pagos registrados.</p>
      ) : (
        <>
          <div aria-hidden="true" className="type-eyebrow hidden grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 border-b border-line bg-fill px-5 py-3 sm:grid"><span>Recibo</span><span className="w-28 text-right">Monto</span><span className="w-36 text-right">Estado</span></div>
          <ul className="divide-y divide-line">
            {payments.map((payment) => <li key={payment.id}><PaymentRow payment={payment} /></li>)}
          </ul>
        </>
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
    <article className="min-w-0 px-5 py-4">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
        <div className="hidden min-w-0 sm:block">
          <Link
            className="row-link tabular block truncate rounded-md text-sm font-semibold text-accent underline underline-offset-4"
            href={`/payments/${payment.id}/receipt`}
          >
            Recibo <span>{payment.receiptNumber}</span>
          </Link>
        </div>
        <strong className="tabular text-ink sm:w-28 sm:text-right">{payment.currency} {payment.amount}</strong>
        <span className="flex justify-end sm:w-36"><span className={`chip ${statusChips[payment.status] ?? "chip-neutral"}`}>{statusLabels[payment.status] ?? payment.status}</span></span>
        <p className="tabular col-span-2 min-w-0 break-words text-sm text-muted sm:col-span-3">
          <Link className="row-link rounded-md text-accent underline underline-offset-4 sm:hidden" href={`/payments/${payment.id}/receipt`}>Recibo {payment.receiptNumber}</Link>
          <span className="sm:hidden"> · </span>Tasa C${payment.appliedNioPerUsd}
        </p>
      </div>
      <div className="mt-3 flex flex-wrap items-start gap-2">
        {payment.status === "settled" ? (
          <details className="min-w-0 max-w-full open:basis-full">
            <summary className="btn btn-secondary cursor-pointer list-none text-stop [&::-webkit-details-marker]:hidden">
              Anular
            </summary>
            <form action={voidAction} className="mt-3 grid gap-3 rounded-xl border border-line bg-fill p-4">
              <input name="paymentId" type="hidden" value={payment.id} />
              <label className="field-label">Motivo<input className={input} name="reason" placeholder="Motivo" required /></label>
              <button className="btn btn-secondary text-stop" disabled={voidPending}>
                Confirmar
              </button>
            </form>
          </details>
        ) : null}
        {canRefund ? (
          <details className="min-w-0 max-w-full open:basis-full">
            <summary className="btn btn-secondary cursor-pointer list-none text-stop [&::-webkit-details-marker]:hidden">
              Reembolsar
            </summary>
            <form action={refundAction} className="mt-3 grid gap-3 rounded-xl border border-line bg-fill p-4 sm:grid-cols-2">
              <input name="paymentId" type="hidden" value={payment.id} />
              <label className="field-label">Monto <span className="tabular">({payment.currency})</span><input
                className={`${input} tabular`}
                inputMode="decimal"
                max={payment.amount}
                name="amount"
                pattern="^\d+(\.\d{1,2})?$"
                placeholder="Monto"
                required
              /></label>
              <label className="field-label">Motivo<input className={input} name="reason" placeholder="Motivo" required /></label>
              <button
                className="btn btn-secondary whitespace-normal text-stop sm:col-span-2"
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
