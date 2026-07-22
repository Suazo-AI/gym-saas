import { redirect } from "next/navigation";

import { ModuleHeader } from "@/features/app/components/module-header";
import { requireUser } from "@/features/auth/services/auth.service";
import { PlatformShell } from "@/features/platform/components/platform-shell";
import { getPlatformDashboard } from "@/features/platform/services/platform.repository";

export default async function PlatformPaymentsPage() {
  const user = await requireUser();
  if (user.app_metadata?.platform_role !== "admin") {
    redirect("/dashboard");
  }

  const dashboard = await getPlatformDashboard();

  return (
    <PlatformShell currentPath="/platform/payments" userEmail={user.email}>
      <ModuleHeader
        eyebrow="Cobros SaaS"
        title="Pagos"
        description="Pagos recibidos por la suscripcion del gimnasio al SaaS."
      />
      <section className="mt-6 overflow-x-auto rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <table className="w-full min-w-[820px] text-left text-sm">
          <thead className="text-xs uppercase tracking-[0.12em] text-slate-500">
            <tr><th className="py-3">Gimnasio</th><th>Estado</th><th>Monto</th><th>Proveedor</th><th>Pagado</th></tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {dashboard.payments.map((payment) => (
              <tr key={payment.paymentId}>
                <td className="py-4 font-black text-[#061f46]">{payment.gymName}</td>
                <td>{payment.status}</td>
                <td>{payment.currency} {payment.amount}</td>
                <td>{payment.provider ?? "Manual"}</td>
                <td>{formatNullableDate(payment.paidAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </PlatformShell>
  );
}

function formatNullableDate(value: string | null) {
  return value ? new Intl.DateTimeFormat("es-NI", { dateStyle: "medium" }).format(new Date(value)) : "Sin fecha";
}
