"use client";

import { useActionState } from "react";

import { ActionFeedback } from "@/features/app/components/action-feedback";

import { registerDayPassAction, type DayPassActionState } from "../actions/day-pass.actions";
import type { MemberDayPassDto, PaymentMethodDto } from "../types/payment.dto";

const initial: DayPassActionState = { ok: false };
const input = "field min-w-0";
const statusLabels: Record<string, string> = {
  paid: "Pagado", settled: "Pagado", void: "Anulado", failed: "Fallido",
  refunded: "Reembolsado", partially_refunded: "Reembolso parcial",
  pending: "Pendiente", processing: "Procesando",
};
const statusChips: Record<string, string> = {
  paid: "chip-ok", settled: "chip-ok", void: "chip-stop", failed: "chip-stop",
  refunded: "chip-stop", partially_refunded: "chip-wait", pending: "chip-wait", processing: "chip-wait",
};

export function RegisterDayPassForm({ gymMemberId, defaultCurrency, paymentMethods, passes }: {
  gymMemberId: string; defaultCurrency: string; paymentMethods: PaymentMethodDto[]; passes: MemberDayPassDto[];
}) {
  const [state, action, pending] = useActionState(registerDayPassAction, initial);
  const today = new Date().toISOString().slice(0, 10);
  return <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
    <section className="panel min-w-0 self-start p-5">
      <p className="type-eyebrow">Cobro independiente</p>
      <h2 className="type-heading mt-1">Registrar pase diario</h2>
      <p className="mt-2 text-sm text-muted">Cobra una fecha concreta, aunque el miembro no tenga una membresía pendiente.</p>
      <form action={action} className="mt-5 grid gap-4">
        <input name="gymMemberId" type="hidden" value={gymMemberId} />
        <label className="field-label">Fecha de acceso<input className={`${input} tabular`} defaultValue={today} min={today} name="serviceDate" required type="date" /></label>
        <div className="grid grid-cols-[minmax(0,1fr)_6.5rem] gap-3">
          <label className="field-label min-w-0">Monto<input className={`${input} tabular`} inputMode="decimal" name="amount" required step="0.01" type="number" /></label>
          <label className="field-label min-w-0">Moneda<select className={`${input} tabular`} defaultValue={defaultCurrency === "USD" ? "USD" : "NIO"} name="currency"><option value="NIO">NIO</option><option value="USD">USD</option></select></label>
        </div>
        <label className="field-label">Método<select className={input} name="paymentMethodId" required>{paymentMethods.map((method) => <option key={method.id} value={method.id}>{method.name}</option>)}</select></label>
        <label className="field-label">Notas<input className={input} maxLength={500} name="notes" /></label>
        <ActionFeedback state={state} />
        <button className="btn btn-lg btn-primary whitespace-normal" disabled={pending} type="submit">{pending ? "Registrando…" : "Registrar pase y generar recibo"}</button>
      </form>
    </section>
    <section className="panel min-w-0 self-start overflow-hidden">
      <div className="panel-head"><h2 className="type-heading">Pases del miembro</h2></div>
      {passes.length === 0 ? <p className="p-5 text-sm text-muted">Todavía no hay pases registrados.</p> : (
        <>
          <div aria-hidden="true" className="type-eyebrow hidden grid-cols-[minmax(0,1fr)_auto_auto] gap-3 border-b border-line bg-fill px-5 py-3 sm:grid"><span>Fecha y recibo</span><span className="w-28 text-right">Monto</span><span className="w-36 text-right">Estado</span></div>
          <ul className="divide-y divide-line">
            {passes.map((pass) => (
              <li className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 px-5 py-3 sm:grid-cols-[minmax(0,1fr)_auto_auto]" key={pass.id}>
                <strong className="tabular hidden text-sm font-semibold text-ink sm:block">{pass.serviceDate}</strong>
                <strong className="tabular font-semibold text-ink sm:w-28 sm:text-right">{pass.currency} {pass.amount}</strong>
                <span className="flex justify-end sm:w-36"><span className={`chip ${statusChips[pass.status] ?? "chip-neutral"}`}>{statusLabels[pass.status] ?? pass.status}</span></span>
                <p className="tabular col-span-2 break-words text-sm text-muted sm:col-span-3"><span className="sm:hidden">Fecha {pass.serviceDate} · </span>Recibo {pass.receiptNumber ?? "Sin recibo"}</p>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  </div>;
}
