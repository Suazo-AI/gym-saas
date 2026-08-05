import Link from "next/link";
import { redirect } from "next/navigation";

import { AppShell } from "@/features/app/components/app-shell";
import { ModuleHeader } from "@/features/app/components/module-header";
import { requireUser } from "@/features/auth/services/auth.service";
import { getActiveGym } from "@/features/gyms/services/get-active-gym";
import { listRecentPayments } from "@/features/payments/services/payment.repository";

export default async function PaymentsPage() {
  const user = await requireUser();
  const activeGym = await getActiveGym();
  if (!activeGym) redirect("/login");
  const payments = await listRecentPayments(activeGym.gymId).catch(() => null);

  return (
    <AppShell activeGym={activeGym} currentPath="/payments" userEmail={user.email}>
      <ModuleHeader
        eyebrow="Pagos"
        title="Cobros y recibos"
        description="Registra pagos, aplícalos a cargos y consulta los recibos recientes."
        action={
          <Link
            className="min-h-11 rounded-md bg-brand-orange px-5 py-3 text-center text-sm font-black text-ink hover:bg-brand-red hover:text-paper"
            href="/payments/new"
          >
            Registrar pago
          </Link>
        }
      />
      <section className="mt-6 rounded-lg border border-charcoal bg-paper shadow-sm">
        <div className="border-b border-gray p-5">
          <h2 className="text-xl font-black text-ink">Pagos recientes</h2>
          <p className="mt-1 text-sm text-charcoal">Recibos registrados para el gimnasio activo.</p>
        </div>
        {!payments ? (
          <p className="p-5 text-sm font-semibold text-red-700">No pudimos cargar pagos.</p>
        ) : payments.length === 0 ? (
          <p className="p-5 text-slate-600">No hay pagos visibles.</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {payments.map((payment) => (
              <div className="grid gap-3 p-4 md:grid-cols-[1fr_1fr_1fr_1fr] md:items-center" key={payment.id}>
                <strong className="text-[#083f88]">{payment.receiptNumber ?? "Sin recibo"}</strong>
                <span className="text-sm font-bold text-slate-800">{payment.currency} {payment.amount}</span>
                <span className="text-sm text-slate-600">{payment.status}</span>
                <time className="text-sm text-slate-600">{payment.paidAt}</time>
              </div>
            ))}
          </div>
        )}
      </section>
    </AppShell>
  );
}
