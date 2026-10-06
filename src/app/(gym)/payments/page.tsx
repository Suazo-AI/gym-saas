import Link from "next/link";
import { redirect } from "next/navigation";

import { PersistedDateRangeForm } from "@/app/(gym)/_components/persisted-date-range-form";
import { ModuleHeader } from "@/features/app/components/module-header";
import { LoadError } from "@/features/app/components/load-error";
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
      <ModuleHeader eyebrow="Pagos" title="Cobros y recibos" description="Modulo protegido para registrar pagos, asignarlos a cargos y conservar historial financiero." action={<Link className="btn btn-secondary" href="/payments/day-pass">Registrar pase diario</Link>} />
      <section className="panel mt-6 overflow-hidden">
        <div className="panel-head">
          <div>
            <h2 className="type-heading">Pagos por periodo</h2>
            <p className="mt-0.5 text-sm text-muted">Filtra el historial por la fecha en que se recibió cada pago.</p>
          </div>
        </div>
        <details className="group p-4 sm:p-0 sm:[&::details-content]:[content-visibility:visible]">
          <summary className="btn btn-secondary cursor-pointer list-none group-open:mb-3 sm:hidden [&::-webkit-details-marker]:hidden">Filtros</summary>
          <div className="hidden group-open:block sm:block [&_form]:border-b-0 [&_form]:p-0 sm:[&_form]:p-4 [&_input]:min-w-0 [&_input]:tabular">
            <PersistedDateRangeForm from={params.from} storageKey="fitmanager:payments-date-range" to={params.to} />
          </div>
        </details>
      </section>
      {!payments||!charges||!methods?<LoadError className="mt-6">No pudimos cargar el módulo de pagos.</LoadError>:<PaymentManagement charges={charges} methods={methods} payments={payments}/>}
    </>
  );
}
