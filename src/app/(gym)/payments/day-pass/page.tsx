import Link from "next/link";
import { redirect } from "next/navigation";

import { ModuleHeader } from "@/features/app/components/module-header";
import { PersistedSearchForm } from "@/features/app/components/persisted-search-form";
import { getActiveGym } from "@/features/gyms/services/get-active-gym";
import { getMember, listMembers } from "@/features/members/services/member.repository";
import { RegisterDayPassForm } from "@/features/payments/components/register-day-pass-form";
import { listMemberDayPasses, listPaymentMethods } from "@/features/payments/services/payment.repository";

type Props = { searchParams: Promise<{ gymMemberId?: string; search?: string }> };

export default async function DayPassPage({ searchParams }: Props) {
  const activeGym = await getActiveGym();
  if (!activeGym) redirect("/login");
  const params = await searchParams;

  if (!params.gymMemberId) {
    const members = params.search ? await listMembers({ gymId: activeGym.gymId, page: 1, search: params.search }).catch(() => null) : null;
    return <>
      <ModuleHeader eyebrow="Pagos" title="Pase diario" description="Busca un miembro y cobra una fecha de acceso independiente." action={<Link className="min-h-11 rounded-md border border-white px-5 py-3 text-center text-sm font-black text-white" href="/payments">Volver a pagos</Link>} />
      <section className="mt-6 rounded-lg border border-charcoal bg-paper p-5 shadow-sm">
        <PersistedSearchForm placeholder="Buscar por nombre o código" storageKey="fitmanager.payments.day-pass.search" />
        {!params.search ? <p className="mt-5 text-sm font-semibold text-charcoal">Escribe el nombre o código del miembro.</p> : !members ? <p className="mt-5 text-sm font-semibold text-red-700">No pudimos buscar miembros.</p> : members.data.length === 0 ? <p className="mt-5 text-sm font-semibold text-charcoal">No encontramos miembros.</p> : <ul className="mt-5 divide-y divide-gray border-t border-gray">{members.data.map((member) => <li className="flex items-center justify-between gap-3 py-4" key={member.gymMemberId}><div><strong className="block text-ink">{member.fullName}</strong><span className="text-sm text-charcoal">{member.memberCode} · {member.status}</span></div><Link className="min-h-11 rounded-md border border-charcoal px-4 py-3 text-sm font-black text-ink" href={`/payments/day-pass?gymMemberId=${member.gymMemberId}`}>Seleccionar</Link></li>)}</ul>}
      </section>
    </>;
  }

  const result = await Promise.all([
    getMember({ gymId: activeGym.gymId, gymMemberId: params.gymMemberId }),
    listPaymentMethods(),
    listMemberDayPasses({ gymId: activeGym.gymId, gymMemberId: params.gymMemberId }),
  ]).catch(() => null);
  if (!result) return <p className="mt-6 rounded-lg bg-red-50 p-5 font-bold text-red-800">No pudimos cargar el miembro.</p>;
  const [member, methods, passes] = result;
  if (!member) return <p className="mt-6 rounded-lg border border-charcoal bg-paper p-5 font-bold text-charcoal">No encontramos el miembro en este gimnasio.</p>;
  return <>
    <ModuleHeader eyebrow="Pagos" title="Pase diario" description={`Cobro independiente para ${member.fullName}.`} action={<Link className="min-h-11 rounded-md border border-paper px-5 py-3 text-center text-sm font-black text-paper" href="/payments/day-pass">Cambiar miembro</Link>} />
    <div className="mt-6"><RegisterDayPassForm defaultCurrency={activeGym.defaultCurrency} gymMemberId={member.gymMemberId} passes={passes} paymentMethods={methods} /></div>†
  </>;
}
