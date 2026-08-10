import { redirect } from "next/navigation";

import { ModuleHeader } from "@/features/app/components/module-header";
import { getActiveGym } from "@/features/gyms/services/get-active-gym";
import { StaffManagement } from "@/features/staff/components/staff-management";
import { RoleScreenManagement } from "@/features/staff/components/role-screen-management";
import { listDeletedStaffUsers, listRoleScreenAccess, listStaffRoles, listStaffUsers } from "@/features/staff/services/staff.repository";

export default async function StaffPage() {
  const activeGym = await getActiveGym();
  if (!activeGym) redirect("/login");

  const result = await Promise.all([listStaffUsers(activeGym.gymId), listStaffRoles(activeGym.gymId)]).catch(() => null);
  const deletedStaff = await listDeletedStaffUsers(activeGym.gymId).catch(() => null);
  const roleAccess = await listRoleScreenAccess(activeGym.gymId).catch(() => null);

  return (
    <>
      <ModuleHeader
        eyebrow="Seguridad del equipo"
        title="Personal y accesos"
        description="Invita al equipo, asigna roles y controla el acceso al gimnasio sin compartir credenciales."
      />
      {result ? (
        <StaffManagement deletedStaff={deletedStaff ?? []} deletedUnavailable={deletedStaff === null} roles={result[1]} staff={result[0]} />
      ) : (
        <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-5 text-sm font-bold text-red-800" role="alert">
          No pudimos cargar el personal. Verifica tus permisos e intenta nuevamente.
        </div>
      )}
      {roleAccess ? <RoleScreenManagement access={roleAccess} /> : null}
    </>
  );
}
