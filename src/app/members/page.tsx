import Link from "next/link";
import { redirect } from "next/navigation";

import { AppShell } from "@/features/app/components/app-shell";
import { ModuleHeader } from "@/features/app/components/module-header";
import { requireUser } from "@/features/auth/services/auth.service";
import { getActiveGym } from "@/features/gyms/services/get-active-gym";
import { listMembers } from "@/features/members/services/member.repository";

type MembersPageProps = {
  searchParams: Promise<{ page?: string; search?: string }>;
};

export default async function MembersPage({ searchParams }: MembersPageProps) {
  const user = await requireUser();
  const activeGym = await getActiveGym();

  if (!activeGym) {
    redirect("/login");
  }

  const params = await searchParams;
  const result = await listMembers({
    gymId: activeGym.gymId,
    page: params.page ? Number(params.page) : 1,
    search: params.search,
  }).catch((error: unknown) => ({ error }));

  return (
    <AppShell activeGym={activeGym} currentPath="/members" userEmail={user.email}>
      <ModuleHeader
        eyebrow="Miembros"
        title="Base de miembros"
        description="Listado conectado al contrato api_v1_member_summaries. Busqueda, filtros y paginacion viven fuera de componentes visuales."
        action={
          <Link
            className="rounded-md bg-[#ff7a1a] px-5 py-3 text-center text-sm font-black text-white hover:bg-[#e86305]"
            href="/members/new"
          >
            Nuevo miembro
          </Link>
        }
      />
      <section className="mt-6 rounded-lg border border-slate-200 bg-white shadow-sm">
        <form className="flex flex-col gap-3 border-b border-slate-200 p-4 sm:flex-row">
          <input
            className="min-h-11 flex-1 rounded-md border border-slate-300 px-3 outline-none focus:border-[#083f88] focus:ring-2 focus:ring-blue-100"
            defaultValue={params.search ?? ""}
            name="search"
            placeholder="Buscar por nombre o codigo"
          />
          <button className="rounded-md bg-[#083f88] px-5 py-3 text-sm font-black text-white" type="submit">
            Buscar
          </button>
        </form>

        {"error" in result ? (
          <p className="p-5 text-sm font-semibold text-red-700">
            No pudimos cargar miembros. Revisa RLS, sesion o migracion local.
          </p>
        ) : result.data.length === 0 ? (
          <p className="p-5 text-slate-600">No hay miembros visibles para este gimnasio.</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {result.data.map((member) => (
              <div
                className="grid gap-3 p-4 md:grid-cols-[1.4fr_1fr_1fr_1fr] md:items-center"
                key={member.gymMemberId}
              >
                <div>
                  <strong className="block text-[#083f88]">{member.fullName}</strong>
                  <span className="text-sm text-slate-500">{member.memberCode}</span>
                </div>
                <span className="text-sm font-semibold text-slate-700">{member.status}</span>
                <span className="text-sm text-slate-600">{member.membershipPlanName ?? "Sin plan"}</span>
                <span className="text-sm text-slate-600">{member.overdueAmount}</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </AppShell>
  );
}
