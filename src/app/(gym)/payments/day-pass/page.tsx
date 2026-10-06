import Link from "next/link";
import { redirect } from "next/navigation";

import { ModuleHeader } from "@/features/app/components/module-header";
import { LoadError } from "@/features/app/components/load-error";
import { PersistedSearchForm } from "@/features/app/components/persisted-search-form";
import { getActiveGym } from "@/features/gyms/services/get-active-gym";
import { getMember, listMembers } from "@/features/members/services/member.repository";
import { RegisterDayPassForm } from "@/features/payments/components/register-day-pass-form";
import { listMemberDayPasses, listPaymentMethods } from "@/features/payments/services/payment.repository";

type Props = { searchParams: Promise<{ gymMemberId?: string; search?: string }> };

const statusLabels: Record<string, string> = {
  active: "Activo", inactive: "Inactivo", overdue: "Moroso", past_due: "Vencido",
  expiring: "Por vencer", grace: "En gracia", pending: "Pendiente",
  suspended: "Suspendido", cancelled: "Cancelado", blocked: "Bloqueado",
};
const statusChips: Record<string, string> = {
  active: "chip-ok", overdue: "chip-stop", past_due: "chip-stop",
  expiring: "chip-wait", grace: "chip-wait", pending: "chip-wait",
};

export default async function DayPassPage({ searchParams }: Props) {
  const activeGym = await getActiveGym();
  if (!activeGym) redirect("/login");
  const params = await searchParams;

  if (!params.gymMemberId) {
    const members = params.search ? await listMembers({ gymId: activeGym.gymId, page: 1, search: params.search }).catch(() => null) : null;
    return <>
      <ModuleHeader eyebrow="Pagos" title="Pase diario" description="Busca un miembro y cobra una fecha de acceso independiente." action={<Link className="btn btn-secondary" href="/payments">Volver a pagos</Link>} />
      <section aria-label="Buscar miembro" className="panel mt-6 max-w-3xl overflow-hidden [&_form>div]:min-w-0">
        <PersistedSearchForm placeholder="Buscar por nombre o código" storageKey="fitmanager.payments.day-pass.search" />
        {!params.search ? <p className="p-5 text-sm text-muted">Escribe el nombre o código del miembro.</p> : !members ? <p className="p-5 text-sm font-semibold text-stop" role="alert">No pudimos buscar miembros.</p> : members.data.length === 0 ? <p className="p-5 text-sm text-muted">No encontramos miembros.</p> : (
          <>
            <div aria-hidden="true" className="type-eyebrow hidden grid-cols-[minmax(0,1fr)_auto] gap-3 border-b border-line bg-fill px-5 py-3 sm:grid"><span>Miembro y estado</span><span>Acción</span></div>
            <ul className="divide-y divide-line">
              {members.data.map((member) => (
                <li className="flex min-w-0 items-center justify-between gap-3 px-5 py-3" key={member.gymMemberId}>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2"><strong className="break-words font-semibold text-ink">{member.fullName}</strong><span className={`chip ${statusChips[member.status] ?? "chip-neutral"}`}>{statusLabels[member.status] ?? member.status}</span></div>
                    <span className="tabular text-sm text-muted">Código {member.memberCode}</span>
                  </div>
                  <Link className="btn btn-quiet row-link shrink-0" href={`/payments/day-pass?gymMemberId=${member.gymMemberId}`}>Seleccionar</Link>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
    </>;
  }

  const result = await Promise.all([
    getMember({ gymId: activeGym.gymId, gymMemberId: params.gymMemberId }),
    listPaymentMethods(),
    listMemberDayPasses({ gymId: activeGym.gymId, gymMemberId: params.gymMemberId }),
  ]).catch(() => null);
  if (!result) return <LoadError className="mt-6">No pudimos cargar el miembro.</LoadError>;
  const [member, methods, passes] = result;
  if (!member) return <p className="panel mt-6 p-5 text-sm text-muted">No encontramos el miembro en este gimnasio.</p>;
  return <>
    <ModuleHeader eyebrow="Pagos" title="Pase diario" description={`Cobro independiente para ${member.fullName}.`} action={<Link className="btn btn-secondary" href="/payments/day-pass">Cambiar miembro</Link>} />
    <div className="mt-6"><RegisterDayPassForm defaultCurrency={activeGym.defaultCurrency} gymMemberId={member.gymMemberId} passes={passes} paymentMethods={methods} /></div>
  </>;
}
