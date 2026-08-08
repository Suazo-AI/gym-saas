import Link from "next/link";
import { redirect } from "next/navigation";

import { PersistedDateRangeForm } from "@/app/(gym)/_components/persisted-date-range-form";
import { ModuleHeader } from "@/features/app/components/module-header";
import { getActiveGym } from "@/features/gyms/services/get-active-gym";
import { PaymentManagement } from "@/features/payments/components/payment-management";
import { listPayableCharges, listPaymentMethods, listRecentPayments } from "@/features/payments/services/payment.repository";

type PaymentsPageProps = {
  searchParams: Promise<{ from?: string; to?: string }>;
};

export default async function PaymentsPage({ searchParams }: PaymentsPageProps) {
  const activeGym = await getActiveGym();
  if (!activeGym) redirect("/login");
  const params = await searchParams;
  const [payments,charges,methods] = await Promise.all([
    listRecentPayments({ gymId: activeGym.gymId, from: params.from, to: params.to }),
    listPayableCharges(activeGym.gymId),
    listPaymentMethods(),
  ]).catch(() => [null,null,null]);

  return (
    <>
      <ModuleHeader eyebrow="Pagos" title="Cobros y recibos" description="Modulo protegido para registrar pagos, asignarlos a cargos y conservar historial financiero." action={<Link className="min-h-11 rounded-md bg-brand-green px-5 py-3 text-center text-sm font-black text-white" href="/payments/day-pass">Registrar pase diario</Link>} />
      <section className="mt-6 rounded-lg border border-gray-300 bg-paper shadow-sm">
        <div className="border-b border-gray p-5">
          <h2 className="text-xl font-black text-ink">Pagos por periodo</h2>
          <p className="mt-1 text-sm text-gray-300">Filtra el historial por la fecha en que se recibió cada pago.</p>
        </div>
        <PersistedDateRangeForm from={params.from} storageKey="fitmanager:payments-date-range" to={params.to} />
      </section>
      {!payments||!charges||!methods?<p className="mt-6 rounded-xl bg-red-50 p-5 font-bold text-red-700">No pudimos cargar el módulo de pagos.</p>:<PaymentManagement charges={charges} methods={methods} payments={payments}/>}
    </>
  );
}
