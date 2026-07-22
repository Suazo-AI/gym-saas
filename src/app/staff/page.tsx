import { redirect } from "next/navigation";

import { AppShell } from "@/features/app/components/app-shell";
import { ModuleHeader } from "@/features/app/components/module-header";
import { requireUser } from "@/features/auth/services/auth.service";
import { getActiveGym } from "@/features/gyms/services/get-active-gym";
import { listStaffUsers } from "@/features/staff/services/staff.repository";

export default async function StaffPage() {
  const user = await requireUser();
  const activeGym = await getActiveGym();
  if (!activeGym) redirect("/login");
  const staff = await listStaffUsers(activeGym.gymId).catch(() => null);

  return (
    <AppShell activeGym={activeGym} currentPath="/staff" userEmail={user.email}>
      <ModuleHeader eyebrow="Personal" title="Equipo y permisos" description="Modulo protegido para usuarios del gimnasio, roles y permisos efectivos." />
      <section className="mt-6 rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 p-5">
          <h2 className="text-xl font-black text-[#083f88]">Usuarios del gimnasio</h2>
          <p className="mt-1 text-sm text-slate-600">Lectura directa de gym_users bajo RLS.</p>
        </div>
        {!staff ? (
          <p className="p-5 text-sm font-semibold text-red-700">No pudimos cargar personal.</p>
        ) : staff.length === 0 ? (
          <p className="p-5 text-slate-600">No hay usuarios visibles.</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {staff.map((person) => (
              <div className="grid gap-3 p-4 md:grid-cols-[1.4fr_1fr_1fr] md:items-center" key={person.id}>
                <strong className="break-all text-[#083f88]">{person.authUserId}</strong>
                <span className="text-sm text-slate-600">{person.employeeCode ?? "Sin codigo"}</span>
                <span className="text-sm font-bold text-slate-800">{person.status}</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </AppShell>
  );
}
