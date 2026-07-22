import Link from "next/link";
import { redirect } from "next/navigation";

import { ModuleHeader } from "@/features/app/components/module-header";
import { requireUser } from "@/features/auth/services/auth.service";
import { PlatformShell } from "@/features/platform/components/platform-shell";
import { getPlatformDashboard } from "@/features/platform/services/platform.repository";

export default async function PlatformGymsPage() {
  const user = await requireUser();
  if (user.app_metadata?.platform_role !== "admin") {
    redirect("/dashboard");
  }

  const dashboard = await getPlatformDashboard();

  return (
    <PlatformShell currentPath="/platform/gyms" userEmail={user.email}>
      <ModuleHeader
        eyebrow="Clientes"
        title="Gimnasios del SaaS"
        description="Vista operativa de tenants, planes, sucursales, personal y miembros registrados."
      />

      <section className="mt-6 overflow-x-auto rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <table className="w-full min-w-[920px] text-left text-sm">
          <thead className="text-xs uppercase tracking-[0.12em] text-slate-500">
            <tr>
              <th className="py-3">Gimnasio</th>
              <th>Estado</th>
              <th>Suscripcion</th>
              <th>Plan</th>
              <th>Miembros</th>
              <th>Personal</th>
              <th>Sucursales</th>
              <th />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {dashboard.gyms.map((gym) => (
              <tr key={gym.gymId}>
                <td className="py-4">
                  <strong className="block text-[#061f46]">{gym.tradeName}</strong>
                  <span className="text-slate-500">{gym.legalName}</span>
                </td>
                <td>{gym.status}</td>
                <td>{gym.subscriptionStatus ?? "sin suscripcion"}</td>
                <td>{gym.saasPlanName ?? "sin plan"}</td>
                <td>{gym.memberCount}</td>
                <td>{gym.staffCount}</td>
                <td>{gym.branchCount}</td>
                <td>
                  <Link className="font-black text-[#083f88] hover:text-[#ff7a1a]" href={`/platform/gyms/${gym.gymId}`}>
                    Abrir
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </PlatformShell>
  );
}
