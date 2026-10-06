import Link from "next/link";
import { redirect } from "next/navigation";

import { ModuleHeader } from "@/features/app/components/module-header";
import { LoadError } from "@/features/app/components/load-error";
import { PersistedSearchForm } from "@/features/app/components/persisted-search-form";
import { getActiveGym } from "@/features/gyms/services/get-active-gym";
import { MemberFilters } from "@/features/members/components/member-filters";
import { parseBooleanFilter } from "@/features/members/member-filter-query";
import { canManageMembers, listMembers } from "@/features/members/services/member.repository";

type MembersPageProps = {
  searchParams: Promise<{
    notice?: string;
    page?: string;
    search?: string;
    status?: string;
    membershipStatus?: string;
    hasOverdueCharges?: string;
  }>;
};

const statusLabels: Record<string, string> = {
  active: "Activo",
  trialing: "Prueba",
  past_due: "Moroso",
  expired: "Vencido",
  canceled: "Cancelado",
  paused: "Pausado",
  inactive: "Inactivo",
  prospect: "Prospecto",
  blocked: "Bloqueado",
  retired: "Retirado",
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
    status: params.status,
    membershipStatus: params.membershipStatus,
    hasOverdueCharges: parseBooleanFilter(params.hasOverdueCharges),
  }).catch((error: unknown) => ({ error }));

  return (
    <>
      <ModuleHeader
        eyebrow="Miembros"
        title="Base de miembros"
        description="Consulta el estado actual de cada miembro y abre su detalle operativo."
        action={<div className="flex flex-wrap gap-2">{canManage ? <Link className="btn btn-quiet" href="/members/deleted">Papelera</Link> : null}<Link
            className="btn btn-secondary"
            href="/members/new"
          >
            Nuevo miembro
          </Link></div>}
      />
      {params.notice ? (
        <div className="mt-6 rounded-xl bg-ok-tint px-4 py-3 text-sm font-semibold text-ok">
          {params.notice}
        </div>
      ) : null}
      <section className="panel mt-6 overflow-hidden">
        <h2 className="sr-only">Miembros del gimnasio activo</h2>
        <div className="border-b border-line">
          <PersistedSearchForm placeholder="Buscar por nombre o código" storageKey="fitmanager.members.search" />
          <MemberFilters />
        </div>

        {"error" in result ? (
          <LoadError className="m-5">
            No pudimos cargar los miembros. Intenta nuevamente.
          </LoadError>
        ) : result.data.length === 0 ? (
          <p className="p-5 text-sm text-muted">No hay miembros visibles para este gimnasio.</p>
        ) : (
          <>
          <div className="type-eyebrow hidden gap-3 border-b border-line px-5 py-3 sm:grid sm:grid-cols-[minmax(0,1.4fr)_minmax(0,0.6fr)_minmax(0,1fr)_minmax(0,0.6fr)_5rem]">
            <span>Miembro</span>
            <span>Estado</span>
            <span>Plan</span>
            <span>Saldo vencido</span>
            <span className="text-right">Detalle</span>
          </div>
          <ul className="divide-y divide-line">
            {result.data.map((member) => (
              <li key={member.gymMemberId}>
                <Link
                  className="row-link grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-5 py-4 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,0.6fr)_minmax(0,1fr)_minmax(0,0.6fr)_5rem]"
                  href={`/members/${member.gymMemberId}`}
                >
                <div className="flex min-w-0 items-center gap-3">
                  <span aria-hidden="true" className="grid size-9 shrink-0 place-items-center rounded-full bg-fill-strong text-xs font-bold text-ink-2">
                    {member.fullName.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "?"}
                  </span>
                  <div className="min-w-0">
                    <div className="flex min-w-0 items-baseline gap-2 sm:block">
                      <strong className="block truncate text-[0.9375rem] font-semibold text-ink sm:whitespace-normal sm:break-words">{member.fullName}</strong>
                      <span className="tabular shrink-0 text-sm text-muted">{member.memberCode}</span>
                    </div>
                    <p className="truncate text-sm text-muted sm:hidden">
                      {member.membershipPlanName ?? "Sin plan"} · Vencido <span className={`tabular ${Number(member.overdueAmount) > 0 ? "text-stop" : "text-muted"}`}>{member.overdueAmount}</span>
                    </p>
                  </div>
                </div>
                <span className={`chip w-fit ${member.status === "active" ? "chip-ok" : ["overdue", "past_due"].includes(member.status) ? "chip-stop" : ["expiring", "grace", "pending"].includes(member.status) ? "chip-wait" : "chip-neutral"}`}>{statusLabels[member.status] ?? member.status}</span>
                <span className="hidden min-w-0 break-words text-sm text-ink-2 sm:inline">{member.membershipPlanName ?? "Sin plan"}</span>
                <span className={`tabular hidden text-sm font-semibold sm:inline ${Number(member.overdueAmount) > 0 ? "text-stop" : "text-muted"}`}>{member.overdueAmount}</span>
                <span className="hidden text-right text-sm font-semibold text-ink-2 sm:inline">
                  Ver detalle
                </span>
                </Link>
              </li>
            ))}
          </ul>
          </>
        )}
      </section>
    </>
  );
}
