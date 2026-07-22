import { redirect } from "next/navigation";

import { ModuleHeader } from "@/features/app/components/module-header";
import { requireUser } from "@/features/auth/services/auth.service";
import { PlatformShell } from "@/features/platform/components/platform-shell";
import { getPlatformDashboard } from "@/features/platform/services/platform.repository";

export default async function PlatformSubscriptionsPage() {
  const user = await requireUser();
  if (user.app_metadata?.platform_role !== "admin") {
    redirect("/dashboard");
  }

  const dashboard = await getPlatformDashboard();

  return (
    <PlatformShell currentPath="/platform/subscriptions" userEmail={user.email}>
      <ModuleHeader
        eyebrow="SaaS"
        title="Suscripciones"
        description="Seguimiento de planes, estados, periodos y cancelaciones programadas."
      />
      <section className="mt-6 overflow-x-auto rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <table className="w-full min-w-[860px] text-left text-sm">
          <thead className="text-xs uppercase tracking-[0.12em] text-slate-500">
            <tr><th className="py-3">Gimnasio</th><th>Plan</th><th>Estado</th><th>Periodo</th><th>Cancelacion</th></tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {dashboard.subscriptions.map((item) => (
              <tr key={item.subscriptionId}>
                <td className="py-4 font-black text-[#061f46]">{item.gymName}</td>
                <td>{item.planName}</td>
                <td>{item.status}</td>
                <td>{formatDate(item.currentPeriodStart)} - {formatDate(item.currentPeriodEnd)}</td>
                <td>{item.cancelAtPeriodEnd ? "Al cierre" : "No programada"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </PlatformShell>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("es-NI", { dateStyle: "medium" }).format(new Date(value));
}
