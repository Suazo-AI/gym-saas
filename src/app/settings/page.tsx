import { redirect } from "next/navigation";

import { AppShell } from "@/features/app/components/app-shell";
import { ModuleHeader } from "@/features/app/components/module-header";
import { requireUser } from "@/features/auth/services/auth.service";
import { getActiveGym } from "@/features/gyms/services/get-active-gym";
import { BranchManagement } from "@/features/settings/components/branch-management";
import { ExchangeRateManagement } from "@/features/settings/components/exchange-rate-management";
import { canManageBranches, listBranches, listDeletedBranches } from "@/features/settings/services/branch.repository";
import { getCurrentExchangeRate } from "@/features/settings/services/exchange-rate.repository";

export default async function SettingsPage() {
  const user = await requireUser();
  const activeGym = await getActiveGym();
  if (!activeGym) redirect("/login");
  const branches = await listBranches(activeGym.gymId).catch(() => null);
  const canManage = await canManageBranches(activeGym.gymId);
  const deletedBranches = canManage ? await listDeletedBranches(activeGym.gymId).catch(() => null) : [];
  const exchangeRate = await getCurrentExchangeRate(activeGym.gymId).catch(() => null);

  return (
    <AppShell activeGym={activeGym} currentPath="/settings" userEmail={user.email}>
      <ModuleHeader eyebrow="Configuración" title="Gimnasio y sucursales" description="Administra las ubicaciones de tu gimnasio." />
      {!branches ? <section className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-6"><h2 className="font-black text-red-800">No pudimos cargar las sucursales</h2><p className="mt-1 text-sm text-red-700">Intenta de nuevo en unos minutos.</p></section> : <BranchManagement branches={branches} canManage={canManage} deletedBranches={deletedBranches ?? []} deletedBranchesUnavailable={deletedBranches === null} />}
      <ExchangeRateManagement canManage={canManage} current={exchangeRate} />
    </AppShell>
  );
}
