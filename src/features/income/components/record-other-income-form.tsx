"use client";

import { useActionState } from "react";

import { recordOtherIncomeAction, type IncomeActionState } from "../actions/income.actions";
import type { IncomeBranchDto, IncomeCategoryDto } from "../types/income.dto";

const initialState: IncomeActionState = { ok: false };
const controlClass = "mt-1 min-h-11 w-full rounded-md border border-gray bg-paper px-3 text-ink outline-none focus:border-brand-green focus:ring-2 focus:ring-brand-green";

export function RecordOtherIncomeForm({
  branches,
  categories,
  defaultCurrency,
}: {
  branches: IncomeBranchDto[];
  categories: IncomeCategoryDto[];
  defaultCurrency: string;
}) {
  const [state, action, pending] = useActionState(recordOtherIncomeAction, initialState);

  return (
    <section className="rounded-lg border border-charcoal bg-paper p-5 shadow-sm">
      <p className="text-xs font-black uppercase tracking-[0.18em] text-brand-green">Otros ingresos</p>
      <h2 className="mt-2 text-2xl font-black text-ink">Registrar ingreso</h2>
      <p className="mt-2 text-sm text-charcoal">Registra ventas, inscripciones u otros ingresos que no vienen de un pago de membresía.</p>
      {categories.length === 0 ? (
        <p className="mt-5 rounded-md bg-amber-100 p-3 text-sm font-bold text-amber-900">No hay categorías activas disponibles.</p>
      ) : (
        <form action={action} className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-bold text-ink">
            Categoría
            <select className={controlClass} name="incomeCategoryId" required>
              {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
            </select>
          </label>
          <label className="text-sm font-bold text-ink">
            Sucursal
            <select className={controlClass} defaultValue="" name="branchId">
              <option value="">Sin sucursal</option>
              {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
            </select>
          </label>
          <label className="text-sm font-bold text-ink">
            Monto
            <input className={controlClass} inputMode="decimal" min="0.01" name="amount" required step="0.01" type="number" />
          </label>
          <label className="text-sm font-bold text-ink">
            Moneda
            <select className={controlClass} defaultValue={defaultCurrency === "USD" ? "USD" : "NIO"} name="currency">
              <option value="NIO">NIO</option>
              <option value="USD">USD</option>
            </select>
          </label>
          <label className="text-sm font-bold text-ink sm:col-span-2">
            Referencia
            <input className={controlClass} maxLength={120} name="reference" placeholder="Factura, recibo o referencia opcional" />
          </label>
          <label className="text-sm font-bold text-ink sm:col-span-2">
            Descripción
            <textarea className={`${controlClass} min-h-24 py-3`} maxLength={500} name="description" />
          </label>
          {state.message ? (
            <p className={`rounded-md p-3 text-sm font-bold sm:col-span-2 ${state.ok ? "bg-green-100 text-green-900" : "bg-red-100 text-red-900"}`} role="status">{state.message}</p>
          ) : null}
          <button className="min-h-11 rounded-md bg-brand-green px-4 font-black text-white hover:bg-brand-green/90 disabled:opacity-60 sm:col-span-2" disabled={pending} type="submit">
            {pending ? "Registrando..." : "Registrar ingreso"}
          </button>
        </form>
      )}
    </section>
  );
}
