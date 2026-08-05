"use client";

import { useActionState, useMemo, useState } from "react";
import { useFormStatus } from "react-dom";

import { registerPaymentAction } from "../actions/payment.actions";
import type {
  PaymentMethodDto,
  PendingChargeDto,
} from "../types/payment.dto";

type RegisterPaymentFormProps = {
  gymId: string;
  gymMemberId: string;
  charges: PendingChargeDto[];
  paymentMethods: PaymentMethodDto[];
  defaultCurrency: string;
};

function decimalToCents(value: string): number {
  if (!/^\d+(\.\d{1,2})?$/.test(value)) return 0;
  const [whole, fraction = ""] = value.split(".");
  return parseInt(whole, 10) * 100 + parseInt(fraction.padEnd(2, "0"), 10);
}

function centsToDecimal(cents: number): string {
  const whole = Math.floor(cents / 100);
  return `${whole}.${String(cents % 100).padStart(2, "0")}`;
}

export function RegisterPaymentForm({
  gymId,
  gymMemberId,
  charges,
  paymentMethods,
  defaultCurrency,
}: RegisterPaymentFormProps) {
  const initialCurrency = charges.some((charge) => charge.currency === defaultCurrency)
    ? defaultCurrency
    : (charges[0]?.currency ?? "NIO");
  const [state, formAction] = useActionState(registerPaymentAction, { ok: false });
  const [currency, setCurrency] = useState(initialCurrency);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [amounts, setAmounts] = useState<Record<string, string>>(
    Object.fromEntries(charges.map((charge) => [charge.chargeId, charge.amountRemaining])),
  );

  const selectedCharges = useMemo(
    () => charges.filter((charge) => selected[charge.chargeId]),
    [charges, selected],
  );
  // Ayuda visual solamente: PostgreSQL valida el total y los saldos reales.
  const total = centsToDecimal(
    selectedCharges.reduce(
      (sum, charge) => sum + decimalToCents(amounts[charge.chargeId] ?? "0"),
      0,
    ),
  );

  return (
    <form action={formAction} className="grid gap-6">
      <input name="gymId" type="hidden" value={gymId} />
      <input name="gymMemberId" type="hidden" value={gymMemberId} />
      <input name="amount" type="hidden" value={total} />

      <div className="overflow-x-auto rounded-lg border border-charcoal bg-paper shadow-sm">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead className="bg-ink text-paper">
            <tr>
              <th className="p-3">Aplicar</th>
              <th className="p-3">Periodo</th>
              <th className="p-3">Vencimiento</th>
              <th className="p-3">Cargo</th>
              <th className="p-3">Pagado</th>
              <th className="p-3">Pendiente</th>
              <th className="p-3">Estado</th>
              <th className="p-3">Monto a cobrar</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray">
            {charges.map((charge) => {
              const isSelected = Boolean(selected[charge.chargeId]);
              const matchesCurrency = charge.currency === currency;
              return (
                <tr key={charge.chargeId}>
                  <td className="p-3">
                    <input
                      aria-label={`Aplicar cargo del ${charge.periodStart}`}
                      checked={isSelected}
                      className="h-5 w-5 accent-brand-orange"
                      disabled={!matchesCurrency}
                      name="allocationChargeId"
                      onChange={(event) =>
                        setSelected((current) => ({
                          ...current,
                          [charge.chargeId]: event.target.checked,
                        }))
                      }
                      type="checkbox"
                      value={charge.chargeId}
                    />
                  </td>
                  <td className="p-3 font-semibold text-ink">
                    {charge.periodStart} — {charge.periodEnd}
                  </td>
                  <td className="p-3 text-charcoal">{charge.dueDate}</td>
                  <td className="p-3 text-ink">{charge.currency} {charge.amountDue}</td>
                  <td className="p-3 text-charcoal">{charge.currency} {charge.amountPaid}</td>
                  <td className="p-3 font-black text-ink">{charge.currency} {charge.amountRemaining}</td>
                  <td className="p-3 text-charcoal">{charge.status}</td>
                  <td className="p-3">
                    <label className="sr-only" htmlFor={`allocation-${charge.chargeId}`}>
                      Monto para el cargo del {charge.periodStart}
                    </label>
                    <input
                      className="min-h-11 w-36 rounded-md border border-gray px-3 outline-none focus:border-brand-orange focus:ring-2 focus:ring-brand-sand disabled:bg-gray-light"
                      disabled={!isSelected}
                      id={`allocation-${charge.chargeId}`}
                      inputMode="decimal"
                      name="allocationAmount"
                      onChange={(event) =>
                        setAmounts((current) => ({
                          ...current,
                          [charge.chargeId]: event.target.value,
                        }))
                      }
                      pattern="^\d+(\.\d{1,2})?$"
                      required={isSelected}
                      value={amounts[charge.chargeId] ?? ""}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <section className="grid gap-4 rounded-lg border border-charcoal bg-paper p-5 shadow-sm md:grid-cols-2">
        <label className="block text-sm font-bold text-ink">
          Método de pago
          <select
            className="mt-2 min-h-11 w-full rounded-md border border-gray px-3 outline-none focus:border-brand-orange focus:ring-2 focus:ring-brand-sand"
            name="paymentMethodId"
            required
          >
            <option value="">Selecciona un método</option>
            {paymentMethods.map((method) => (
              <option key={method.id} value={method.id}>{method.name}</option>
            ))}
          </select>
        </label>
        <label className="block text-sm font-bold text-ink">
          Moneda
          <select
            className="mt-2 min-h-11 w-full rounded-md border border-gray px-3 outline-none focus:border-brand-orange focus:ring-2 focus:ring-brand-sand"
            name="currency"
            onChange={(event) => {
              setCurrency(event.target.value);
              setSelected({});
            }}
            value={currency}
          >
            <option value="NIO">NIO</option>
            <option value="USD">USD</option>
          </select>
        </label>
        <label className="block text-sm font-bold text-ink">
          Referencia externa
          <input className="mt-2 min-h-11 w-full rounded-md border border-gray px-3 outline-none focus:border-brand-orange focus:ring-2 focus:ring-brand-sand" name="externalReference" />
        </label>
        <label className="block text-sm font-bold text-ink md:col-span-2">
          Notas
          <textarea className="mt-2 min-h-24 w-full rounded-md border border-gray px-3 py-2 outline-none focus:border-brand-orange focus:ring-2 focus:ring-brand-sand" name="notes" />
        </label>
      </section>

      {state.message ? (
        <p
          className={`rounded-md border px-4 py-3 text-sm font-bold ${state.ok ? "border-green-700 bg-green-50 text-green-900" : "border-red-700 bg-red-50 text-red-900"}`}
          role={state.ok ? "status" : "alert"}
        >
          {state.message}
        </p>
      ) : null}

      <details className="rounded-lg border border-charcoal bg-brand-sand p-5 shadow-sm">
        <summary className="min-h-11 cursor-pointer py-3 text-base font-black text-ink">
          Revisar y confirmar pago
        </summary>
        <div className="mt-4 grid gap-3 border-t border-charcoal pt-4">
          <p className="text-lg font-black text-ink">Total: {currency} {total}</p>
          {selectedCharges.length === 0 ? (
            <p className="text-sm font-semibold text-charcoal">Selecciona al menos un cargo.</p>
          ) : (
            <ul className="grid gap-2 text-sm text-charcoal">
              {selectedCharges.map((charge) => (
                <li key={charge.chargeId}>
                  Cargo {charge.dueDate}: {currency} {amounts[charge.chargeId]}
                </li>
              ))}
            </ul>
          )}
          <SubmitButton disabled={selectedCharges.length === 0} />
        </div>
      </details>
    </form>
  );
}

function SubmitButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      className="min-h-11 rounded-md bg-brand-orange px-5 py-3 text-sm font-black text-ink hover:bg-brand-red hover:text-paper disabled:cursor-not-allowed disabled:opacity-60"
      disabled={disabled || pending}
      type="submit"
    >
      {pending ? "Registrando pago..." : "Confirmar y registrar pago"}
    </button>
  );
}
