import { redirect } from "next/navigation";

import { AppShell } from "@/features/app/components/app-shell";
import { ModuleHeader } from "@/features/app/components/module-header";
import { requireUser } from "@/features/auth/services/auth.service";
import { getActiveGym } from "@/features/gyms/services/get-active-gym";
import { listBranches } from "@/features/settings/services/branch.repository";

export default async function SettingsPage() {
  const user = await requireUser();
  const activeGym = await getActiveGym();
  if (!activeGym) redirect("/login");
  const branches = await listBranches(activeGym.gymId).catch(() => null);

  return (
    <AppShell activeGym={activeGym} currentPath="/settings" userEmail={user.email}>
      <ModuleHeader eyebrow="Configuracion" title="Gimnasio y sucursales" description="Modulo protegido para configuracion operativa del gimnasio activo." />
      <section className="mt-6 rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 p-5">
          <h2 className="text-xl font-black text-[#083f88]">Sucursales</h2>
          <p className="mt-1 text-sm text-slate-600">Lectura directa de gym_branches bajo RLS.</p>
        </div>
        {!branches ? (
          <p className="p-5 text-sm font-semibold text-red-700">No pudimos cargar sucursales.</p>
        ) : branches.length === 0 ? (
          <p className="p-5 text-slate-600">No hay sucursales visibles.</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {branches.map((branch) => (
              <div className="grid gap-3 p-4 md:grid-cols-[1.4fr_1fr_1fr] md:items-center" key={branch.id}>
                <strong className="text-[#083f88]">{branch.name}</strong>
                <span className="text-sm text-slate-600">{branch.city ?? "Sin ciudad"}</span>
                <span className="text-sm font-bold text-slate-800">{branch.status}</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </AppShell>
  );
}
