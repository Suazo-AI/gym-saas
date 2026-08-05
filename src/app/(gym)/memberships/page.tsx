import { redirect } from "next/navigation";

import { ModuleHeader } from "@/features/app/components/module-header";
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
      {!plans ? <section className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-6"><h2 className="font-black text-red-800">No pudimos cargar los planes</h2><p className="mt-1 text-sm text-red-700">Intenta nuevamente en unos minutos.</p></section> : <MembershipPlanManagement plans={plans} canManage={canManage} deletedPlans={deletedPlans ?? []} deletedPlansUnavailable={deletedPlans === null} />}
    </>
  );
}
