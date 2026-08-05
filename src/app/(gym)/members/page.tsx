import Link from "next/link";
import { redirect } from "next/navigation";

import { ModuleHeader } from "@/features/app/components/module-header";
import { PersistedSearchForm } from "@/features/app/components/persisted-search-form";
import { getActiveGym } from "@/features/gyms/services/get-active-gym";
import { canManageMembers, listMembers } from "@/features/members/services/member.repository";

type MembersPageProps = {
  searchParams: Promise<{ notice?: string; page?: string; search?: string }>;
};

export default async function MembersPage({ searchParams }: MembersPageProps) {
  const activeGym = await getActiveGym();

  if (!activeGym) {
    redirect("/login");
  }

  const params = await searchParams;
  const canManage = await canManageMembers(activeGym.gymId);
  const result = await listMembers({
    gymId: activeGym.gymId,
    page: params.page ? Number(params.page) : 1,
    search: params.search,
  }).catch((error: unknown) => ({ error }));

  return (
    <>
      <ModuleHeader
        eyebrow="Miembros"
        title="Base de miembros"
        description="Consulta el estado actual de cada miembro y abre su detalle operativo."
        action={<div className="flex flex-wrap gap-2">{canManage ? <Link className="rounded-md border border-charcoal px-5 py-3 text-center text-sm font-black text-ink hover:bg-gray-light" href="/members/deleted">Papelera</Link> : null}<Link
            className="rounded-md bg-brand-orange px-5 py-3 text-center text-sm font-black text-ink hover:bg-brand-red hover:text-paper"
            href="/members/new"
          >
            Nuevo miembro
          </Link></div>}
      />
      {params.notice ? (
        <div className="mt-6 rounded-md border border-orange-200 bg-orange-50 px-4 py-3 text-sm font-bold text-orange-900">
          {params.notice}
        </div>
      ) : null}
      <section className="mt-6 rounded-lg border border-charcoal bg-paper shadow-sm">
        <h2 className="sr-only">Miembros del gimnasio activo</h2>
        <PersistedSearchForm placeholder="Buscar por nombre o código" storageKey="fitmanager.members.search" />

        {"error" in result ? (
          <p className="p-5 text-sm font-semibold text-red-700">
            No pudimos cargar los miembros. Intenta nuevamente.
          </p>
        ) : result.data.length === 0 ? (
          <p className="p-5 text-slate-600">No hay miembros visibles para este gimnasio.</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {result.data.map((member) => (
              <div
                className="grid gap-3 p-4 md:grid-cols-[1.4fr_0.8fr_1fr_0.8fr_auto] md:items-center"
                key={member.gymMemberId}
              >
                <div>
                  <strong className="block text-ink">{member.fullName}</strong>
                  <span className="text-sm text-gray-dark">{member.memberCode}</span>
                </div>
                <span className="text-sm font-semibold text-ink">{member.status}</span>
                <span className="text-sm text-gray-dark">{member.membershipPlanName ?? "Sin plan"}</span>
                <span className="text-sm text-gray-dark">{member.overdueAmount}</span>
                <Link
                  className="min-h-11 rounded-md border border-charcoal px-4 py-3 text-center text-sm font-black text-ink hover:bg-gray-light"
                  href={`/members/${member.gymMemberId}`}
                >
                  Ver detalle
                </Link>
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
