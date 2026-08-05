"use client";

import { useActionState } from "react";

import { registerDayPassAction, type DayPassActionState } from "../actions/day-pass.actions";
import type { MemberDayPassDto, PaymentMethodDto } from "../types/payment.dto";

const initial: DayPassActionState = { ok: false };
const input = "mt-1 min-h-11 w-full rounded-md border border-gray px-3 text-ink outline-none focus:border-brand-green focus:ring-2 focus:ring-brand-green";

export function RegisterDayPassForm({ gymMemberId, defaultCurrency, paymentMethods, passes }: {
  gymMemberId: string; defaultCurrency: string; paymentMethods: PaymentMethodDto[]; passes: MemberDayPassDto[];
}) {
  const [state, action, pending] = useActionState(registerDayPassAction, initial);
  const today = new Date().toISOString().slice(0, 10);
  return <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
    <section className="rounded-lg border border-charcoal bg-paper p-5 shadow-sm">
      <p className="text-xs font-black uppercase tracking-[0.18em] text-brand-green">Cobro independiente</p>
      <h2 className="mt-2 text-2xl font-black text-ink">Registrar pase diario</h2>
      <p className="mt-2 text-sm text-charcoal">Cobra una fecha concreta, aunque el miembro no tenga una membresía pendiente.</p>
      <form action={action} className="mt-5 grid gap-4">
        <input name="gymMemberId" type="hidden" value={gymMemberId} />
        <label className="text-sm font-bold text-ink">Fecha de acceso<input className={input} defaultValue={today} min={today} name="serviceDate" required type="date" /></label>
        <label className="text-sm font-bold text-ink">Monto<input className={input} inputMode="decimal" name="amount" required step="0.01" type="number" /></label>
        <label className="text-sm font-bold text-ink">Moneda<select className={input} defaultValue={defaultCurrency === "USD" ? "USD" : "NIO"} name="currency"><option value="NIO">NIO</option><option value="USD">USD</option></select></label>
        <label className="text-sm font-bold text-ink">Método<select className={input} name="paymentMethodId" required>{paymentMethods.map((method) => <option key={method.id} value={method.id}>{method.name}</option>)}</select></label>
        <label className="text-sm font-bold text-ink">Notas<input className={input} maxLength={500} name="notes" /></label>
        {state.message ? <p className={state.ok ? "rounded-md bg-green-100 p-3 text-sm font-bold text-green-900" : "rounded-md bg-red-100 p-3 text-sm font-bold text-red-900"} role="status">{state.message}</p> : null}
        <button className="min-h-11 rounded-md bg-brand-green px-4 font-black text-white hover:bg-brand-green/90 disabled:opacity-60" disabled={pending} type="submit">{pending ? "Registrando…" : "Registrar pase y generar recibo"}</button>
      </form>
    </section>
    <section className="rounded-lg border border-charcoal bg-paper p-5 shadow-sm">
      <h2 className="text-xl font-black text-ink">Pases del miembro</h2>
      {passes.length === 0 ? <p className="mt-4 text-sm text-charcoal">Todavía no hay pases registrados.</p> : <ul className="mt-4 divide-y divide-gray">{passes.map((pass) => <li className="flex items-center justify-between gap-3 py-3" key={pass.id}><div><strong className="block text-ink">{pass.serviceDate}</strong><span className="text-sm text-charcoal">{pass.currency} {pass.amount} · {pass.receiptNumber ?? "Sin recibo"}</span></div><span className={pass.status === "paid" ? "text-sm font-black text-brand-green" : "text-sm font-black text-red-700"}>{pass.status === "paid" ? "Pagado" : "Anulado"}</span></li>)}</ul>}
    </section>
  </div>;
}
