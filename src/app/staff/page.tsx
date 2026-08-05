import { redirect } from "next/navigation";

import { AppShell } from "@/features/app/components/app-shell";
import { ModuleHeader } from "@/features/app/components/module-header";
import { requireUser } from "@/features/auth/services/auth.service";
import { getActiveGym } from "@/features/gyms/services/get-active-gym";
import { StaffManagement } from "@/features/staff/components/staff-management";
import { RoleScreenManagement } from "@/features/staff/components/role-screen-management";
import { listRoleScreenAccess, listStaffRoles, listStaffUsers } from "@/features/staff/services/staff.repository";

export default async function StaffPage() {
  const user = await requireUser();
  const activeGym = await getActiveGym();
  if (!activeGym) redirect("/login");

  const result = await Promise.all([listStaffUsers(activeGym.gymId), listStaffRoles(activeGym.gymId)]).catch(() => null);
  const roleAccess = await listRoleScreenAccess(activeGym.gymId).catch(() => null);

  return (
    <AppShell activeGym={activeGym} currentPath="/staff" userEmail={user.email}>
      <ModuleHeader
        eyebrow="Seguridad del equipo"
        title="Personal y accesos"
        description="Invita al equipo, asigna roles y controla el acceso al gimnasio sin compartir credenciales."
      />
      {result ? (
        <StaffManagement roles={result[1]} staff={result[0]} />
      ) : (
        <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-5 text-sm font-bold text-red-800" role="alert">
          No pudimos cargar el personal. Verifica tus permisos e intenta nuevamente.
        </div>
      )}
      {roleAccess ? <RoleScreenManagement access={roleAccess} /> : null}
    </AppShell>
  );
}
