"use client";

import { useActionState, useMemo, useState } from "react";
import { useFormStatus } from "react-dom";

import { ActionFeedback } from "@/features/app/components/action-feedback";

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

const chargeStatus: Record<string, { label: string; className: string }> = {
  pending: { label: "Pendiente", className: "chip chip-neutral" },
  overdue: { label: "Vencido", className: "chip chip-stop" },
  partially_paid: { label: "Abono parcial", className: "chip chip-wait" },
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
    <form action={formAction} className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <input name="gymId" type="hidden" value={gymId} />
      <input name="gymMemberId" type="hidden" value={gymMemberId} />
      <input name="amount" type="hidden" value={total} />

      <section aria-labelledby="pending-charges-title" className="panel overflow-hidden">
        <div className="panel-head">
          <div>
            <h2 className="type-heading" id="pending-charges-title">Cargos pendientes</h2>
            <p className="mt-0.5 text-sm text-muted">Marca lo que vas a cobrar. Puedes cobrar un monto menor como abono.</p>
          </div>
        </div>
        <ul className="divide-y divide-line">
          {charges.map((charge) => {
            const isSelected = Boolean(selected[charge.chargeId]);
            const matchesCurrency = charge.currency === currency;
            const status = chargeStatus[charge.status] ?? { label: charge.status, className: "chip chip-neutral" };
            return (
              <li className={`transition-colors duration-150 ${isSelected ? "bg-accent-tint" : ""}`} key={charge.chargeId}>
                <div className="grid gap-3 px-5 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                  <label className={`flex min-w-0 items-start gap-3 ${matchesCurrency ? "cursor-pointer" : "cursor-not-allowed opacity-60"}`}>
                    <input
                      aria-label={`Aplicar cargo del ${charge.periodStart}`}
                      checked={isSelected}
                      className="mt-0.5 size-5 shrink-0 accent-[var(--accent)]"
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
                    <span className="min-w-0">
                      <span className="flex flex-wrap items-center gap-2">
                        <strong className="tabular text-[0.9375rem] font-semibold text-ink">
                          {charge.periodStart} — {charge.periodEnd}
                        </strong>
                        <span className={status.className}>{status.label}</span>
                      </span>
                      <span className="tabular mt-1 block text-sm text-muted">
                        Vence {charge.dueDate} · Cargo {charge.currency} {charge.amountDue} · Pagado {charge.currency} {charge.amountPaid}
                      </span>
                      {!matchesCurrency ? (
                        <span className="mt-1 block text-sm text-muted">Cambia la moneda a {charge.currency} para cobrar este cargo.</span>
                      ) : null}
                    </span>
                  </label>
                  <div className="flex items-center gap-3 sm:justify-end">
                    <span className="text-right">
                      <span className="block text-xs text-muted">Pendiente</span>
                      <span className="tabular block font-semibold text-ink">{charge.currency} {charge.amountRemaining}</span>
                    </span>
                    <span>
                      <label className="sr-only" htmlFor={`allocation-${charge.chargeId}`}>
                        Monto para el cargo del {charge.periodStart}
                      </label>
                      <input
                        className="field tabular mt-0 w-32 text-right"
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
                    </span>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <aside aria-labelledby="payment-summary-title" className="panel p-5 lg:sticky lg:top-24">
        <h2 className="type-eyebrow" id="payment-summary-title">Total a cobrar</h2>
        <p className="type-figure mt-2 text-[2.5rem] text-ink">
          <span className="mr-1.5 text-lg font-semibold text-muted">{currency}</span>{total}
        </p>
        {selectedCharges.length === 0 ? (
          <p className="mt-2 text-sm text-muted">Selecciona al menos un cargo.</p>
        ) : (
          <ul className="mt-3 grid gap-1 text-sm text-ink-2">
            {selectedCharges.map((charge) => (
              <li className="tabular flex justify-between gap-3" key={charge.chargeId}>
                <span>Cargo {charge.dueDate}</span>
                <span>{currency} {amounts[charge.chargeId]}</span>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-5 grid gap-4 border-t border-line pt-5">
          <label className="field-label">
            Método de pago
            <select className="field" name="paymentMethodId" required>
              <option value="">Selecciona un método</option>
              {paymentMethods.map((method) => (
                <option key={method.id} value={method.id}>{method.name}</option>
              ))}
            </select>
          </label>
          <label className="field-label">
            Moneda
            <select
              className="field"
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
          <details className="group">
            <summary className="cursor-pointer list-none text-sm font-semibold text-accent [&::-webkit-details-marker]:hidden">
              <span className="group-open:hidden">Agregar referencia o nota</span>
              <span className="hidden group-open:inline">Referencia y nota</span>
            </summary>
            <div className="mt-3 grid gap-4">
              <label className="field-label">
                Referencia externa
                <input className="field" name="externalReference" />
              </label>
              <label className="field-label">
                Notas
                <textarea className="field" name="notes" />
              </label>
            </div>
          </details>
        </div>

        <ActionFeedback className="mt-4" state={state} />
        <SubmitButton currency={currency} disabled={selectedCharges.length === 0} total={total} />
        <p className="mt-2 text-center text-xs text-muted">Al confirmar se genera el recibo.</p>
      </aside>
    </form>
  );
}

function SubmitButton({ disabled, currency, total }: { disabled: boolean; currency: string; total: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      className="btn btn-lg btn-primary mt-5 w-full"
      disabled={disabled || pending}
      type="submit"
    >
      {pending ? "Registrando pago..." : disabled ? "Confirmar y registrar pago" : `Cobrar ${currency} ${total}`}
    </button>
  );
}
