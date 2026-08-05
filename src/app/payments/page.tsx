import { redirect } from "next/navigation";

import { AppShell } from "@/features/app/components/app-shell";
import { ModuleHeader } from "@/features/app/components/module-header";
import { requireUser } from "@/features/auth/services/auth.service";
import { getActiveGym } from "@/features/gyms/services/get-active-gym";
import { PaymentManagement } from "@/features/payments/components/payment-management";
import { listPayableCharges, listPaymentMethods, listRecentPayments } from "@/features/payments/services/payment.repository";

export default async function PaymentsPage() {
  const user = await requireUser();
  const activeGym = await getActiveGym();
  if (!activeGym) redirect("/login");
  const [payments,charges,methods] = await Promise.all([listRecentPayments(activeGym.gymId),listPayableCharges(activeGym.gymId),listPaymentMethods()]).catch(() => [null,null,null]);

  return (
    <AppShell activeGym={activeGym} currentPath="/payments" userEmail={user.email}>
      <ModuleHeader eyebrow="Pagos" title="Cobros y recibos" description="Modulo protegido para registrar pagos, asignarlos a cargos y conservar historial financiero." />
      {!payments||!charges||!methods?<p className="mt-6 rounded-xl bg-red-50 p-5 font-bold text-red-700">No pudimos cargar el módulo de pagos.</p>:<PaymentManagement charges={charges} methods={methods} payments={payments}/>}
    </AppShell>
  );
}
