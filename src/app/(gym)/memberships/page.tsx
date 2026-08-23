import { redirect } from "next/navigation";

import { ModuleHeader } from "@/features/app/components/module-header";
import { LoadError } from "@/features/app/components/load-error";
import { getActiveGym } from "@/features/gyms/services/get-active-gym";
import { MembershipPlanManagement } from "@/features/memberships/components/membership-plan-management";
import { canManageMembershipPlans, listDeletedMembershipPlans, listMembershipPlans } from "@/features/memberships/services/membership.repository";

export default async function MembershipsPage() {
  const activeGym = await getActiveGym();
  if (!activeGym) redirect("/login");
  const plans = await listMembershipPlans(activeGym.gymId).catch(() => null);
  const canManage = await canManageMembershipPlans(activeGym.gymId);
  const deletedPlans = canManage ? await listDeletedMembershipPlans(activeGym.gymId).catch(() => null) : [];

  return (
    <>
      <ModuleHeader eyebrow="Membresías" title="Planes de membresía" description="Configura precios, duración, renovación y disponibilidad para el gimnasio activo." />
      {!plans ? <LoadError className="mt-6"><h2 className="font-black">No pudimos cargar los planes</h2><p className="mt-1">Intenta nuevamente en unos minutos.</p></LoadError> : <MembershipPlanManagement plans={plans} canManage={canManage} deletedPlans={deletedPlans ?? []} deletedPlansUnavailable={deletedPlans === null} />}
    </>
  );
}
