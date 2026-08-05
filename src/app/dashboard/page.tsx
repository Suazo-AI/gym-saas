import Link from "next/link";
import { redirect } from "next/navigation";

import { AppShell } from "@/features/app/components/app-shell";
import { ModuleHeader } from "@/features/app/components/module-header";
import { requireUser } from "@/features/auth/services/auth.service";
import { OwnerDashboard } from "@/features/dashboard/components/owner-dashboard";
import { getOwnerDashboard } from "@/features/dashboard/services/dashboard.repository";
import { getActiveGym } from "@/features/gyms/services/get-active-gym";

export default async function DashboardPage() {
  const user = await requireUser();
  const activeGym = await getActiveGym();

  if (!activeGym) {
    if (user.app_metadata?.platform_role === "admin") {
      redirect("/platform");
    }

    redirect("/login");
  }

  const dashboard = await getOwnerDashboard(activeGym.gymId).catch(() => null);

  return (
    <AppShell activeGym={activeGym} currentPath="/dashboard" userEmail={user.email}>
      <ModuleHeader
        eyebrow="Resumen del gimnasio"
        title={`Hoy en ${activeGym.tradeName}`}
        description="Estado operativo y financiero del gimnasio activo, con métricas calculadas en Supabase y protegidas por permisos."
        action={
          <Link
            className="rounded-md bg-[#ff7a1a] px-6 py-4 text-center text-sm font-black text-white hover:bg-[#e86305]"
            href="/members/new"
          >
            Registrar miembro
          </Link>
        }
      />
      {dashboard ? <OwnerDashboard dashboard={dashboard} /> : <section className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-5"><h2 className="font-black text-red-900">No pudimos cargar el resumen</h2><p className="mt-2 text-sm text-red-700">Verifica que tu usuario tenga acceso al dashboard del gimnasio activo e intenta nuevamente.</p></section>}
    </AppShell>
  );
}
