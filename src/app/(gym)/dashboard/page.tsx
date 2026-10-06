import Link from "next/link";
import { redirect } from "next/navigation";

import { ModuleHeader } from "@/features/app/components/module-header";
import { LoadError } from "@/features/app/components/load-error";
import { OwnerDashboard } from "@/features/dashboard/components/owner-dashboard";
import { getOwnerDashboard } from "@/features/dashboard/services/dashboard.repository";
import { getActiveGym } from "@/features/gyms/services/get-active-gym";

export default async function DashboardPage() {
  const activeGym = await getActiveGym();

  if (!activeGym) redirect("/login");

  const dashboard = await getOwnerDashboard(activeGym.gymId).catch(() => null);

  return (
    <>
      <ModuleHeader
        eyebrow="Resumen"
        title={`Hoy en ${activeGym.tradeName}`}
        description="Miembros, cobros y entradas de hoy en un vistazo."
        action={
          <>
            <Link className="btn btn-secondary" href="/members/new">
              Registrar miembro
            </Link>
            <Link className="btn btn-primary" href="/entries">
              Abrir recepción
            </Link>
          </>
        }
      />
      {dashboard ? <OwnerDashboard dashboard={dashboard} /> : <LoadError className="mt-6"><h2 className="font-black">No pudimos cargar el resumen</h2><p className="mt-2">Verifica que tu usuario tenga acceso al dashboard del gimnasio activo e intenta nuevamente.</p></LoadError>}
    </>
  );
}
