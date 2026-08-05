import Link from "next/link";
import { redirect } from "next/navigation";

import { ModuleHeader } from "@/features/app/components/module-header";
import { getActiveGym } from "@/features/gyms/services/get-active-gym";
import { PaymentManagement } from "@/features/payments/components/payment-management";
import { listPayableCharges, listPaymentMethods, listRecentPayments } from "@/features/payments/services/payment.repository";

export default async function PaymentsPage() {
  const activeGym = await getActiveGym();
  if (!activeGym) redirect("/login");
  const [payments,charges,methods] = await Promise.all([listRecentPayments(activeGym.gymId),listPayableCharges(activeGym.gymId),listPaymentMethods()]).catch(() => [null,null,null]);

  return (
    <>
      <ModuleHeader eyebrow="Pagos" title="Cobros y recibos" description="Modulo protegido para registrar pagos, asignarlos a cargos y conservar historial financiero." action={<Link className="min-h-11 rounded-md bg-brand-green px-5 py-3 text-center text-sm font-black text-white" href="/payments/day-pass">Registrar pase diario</Link>} />
      {!payments||!charges||!methods?<p className="mt-6 rounded-xl bg-red-50 p-5 font-bold text-red-700">No pudimos cargar el módulo de pagos.</p>:<PaymentManagement charges={charges} methods={methods} payments={payments}/>}
    </>
  );
}
