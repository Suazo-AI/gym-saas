import { redirect } from "next/navigation";

import { AppShell } from "@/features/app/components/app-shell";
import { ModuleHeader } from "@/features/app/components/module-header";
import { requireUser } from "@/features/auth/services/auth.service";
import { getActiveGym } from "@/features/gyms/services/get-active-gym";
import { listMembershipPlans } from "@/features/memberships/services/membership.repository";

export default async function MembershipsPage() {
  const user = await requireUser();
  const activeGym = await getActiveGym();
  if (!activeGym) redirect("/login");
  const plans = await listMembershipPlans(activeGym.gymId).catch(() => null);

  return (
    <AppShell activeGym={activeGym} currentPath="/memberships" userEmail={user.email}>
      <ModuleHeader eyebrow="Membresias" title="Planes y suscripciones" description="Superficie inicial para planes, suscripciones, cargos y estados de membresia." />
      <section className="mt-6 rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 p-5">
          <h2 className="text-xl font-black text-[#083f88]">Planes de membresia</h2>
          <p className="mt-1 text-sm text-slate-600">Lectura directa de membership_plans bajo RLS.</p>
        </div>
        {!plans ? (
          <p className="p-5 text-sm font-semibold text-red-700">No pudimos cargar los planes.</p>
        ) : plans.length === 0 ? (
          <p className="p-5 text-slate-600">No hay planes visibles para este gimnasio.</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {plans.map((plan) => (
              <div className="grid gap-3 p-4 md:grid-cols-[1.4fr_1fr_1fr_1fr] md:items-center" key={plan.id}>
                <strong className="text-[#083f88]">{plan.name}</strong>
                <span className="text-sm text-slate-600">{plan.code}</span>
                <span className="text-sm font-bold text-slate-800">{plan.currency} {plan.price}</span>
                <span className="text-sm text-slate-600">{plan.isActive ? "Activo" : "Inactivo"}</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </AppShell>
  );
}
