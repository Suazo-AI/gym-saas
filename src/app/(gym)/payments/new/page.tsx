import Link from "next/link";
import { redirect } from "next/navigation";

import { ModuleHeader } from "@/features/app/components/module-header";
import { PersistedSearchForm } from "@/features/app/components/persisted-search-form";
import { getActiveGym } from "@/features/gyms/services/get-active-gym";
import {
  getMember,
  listMembers,
} from "@/features/members/services/member.repository";
import { RegisterPaymentForm } from "@/features/payments/components/register-payment-form";
import {
  listMemberPendingCharges,
  listPaymentMethods,
} from "@/features/payments/services/payment.repository";
import { isApiError } from "@/lib/api/api-error";

type NewPaymentPageProps = {
  searchParams: Promise<{
    gymMemberId?: string;
    search?: string;
  }>;
};

export default async function NewPaymentPage({ searchParams }: NewPaymentPageProps) {
  const activeGym = await getActiveGym();
  if (!activeGym) redirect("/login");
  const params = await searchParams;

  if (!params.gymMemberId) {
    const members = params.search
      ? await listMembers({
          gymId: activeGym.gymId,
          page: 1,
          search: params.search,
        }).catch(() => null)
      : null;

    return (
      <>
        <ModuleHeader
          eyebrow="Pagos"
          title="Registrar pago"
          description="Busca al miembro y selecciona los cargos que vas a cobrar."
        />
        <section className="mt-6 rounded-lg border border-charcoal bg-paper p-5 shadow-sm">
          <PersistedSearchForm placeholder="Buscar por nombre o código" storageKey="fitmanager.payments.new.search" />
          <form className="hidden">
            <label className="sr-only" htmlFor="payment-member-search">Buscar miembro</label>
            <input
              className="min-h-11 flex-1 rounded-md border border-gray px-3 outline-none focus:border-brand-orange focus:ring-2 focus:ring-brand-sand"
              defaultValue={params.search ?? ""}
              id="payment-member-search"
              name="search"
              placeholder="Buscar por nombre o código"
            />
            <button className="min-h-11 rounded-md bg-ink px-5 py-3 text-sm font-black text-paper hover:bg-charcoal" type="submit">
              Buscar
            </button>
          </form>
          {!params.search ? (
            <p className="mt-5 text-sm font-semibold text-charcoal">Escribe el nombre o código del miembro.</p>
          ) : !members ? (
            <p className="mt-5 text-sm font-semibold text-red-700" role="alert">No pudimos buscar miembros. Intenta nuevamente.</p>
          ) : members.data.length === 0 ? (
            <p className="mt-5 text-sm font-semibold text-charcoal">No encontramos miembros.</p>
          ) : (
            <ul className="mt-5 divide-y divide-gray border-t border-gray">
              {members.data.map((member) => (
                <li className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between" key={member.gymMemberId}>
                  <div>
                    <strong className="block text-ink">{member.fullName}</strong>
                    <span className="text-sm text-charcoal">{member.memberCode} · {member.status}</span>
                  </div>
                  <Link
                    className="min-h-11 rounded-md border border-charcoal px-4 py-3 text-center text-sm font-black text-ink hover:bg-gray-light"
                    href={`/payments/new?gymMemberId=${member.gymMemberId}`}
                  >
                    Seleccionar
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </>
    );
  }

  const result = await Promise.all([
    getMember({ gymId: activeGym.gymId, gymMemberId: params.gymMemberId }),
    listMemberPendingCharges({ gymId: activeGym.gymId, gymMemberId: params.gymMemberId }),
    listPaymentMethods(),
  ])
    .then(([member, charges, paymentMethods]) => ({ member, charges, paymentMethods }))
    .catch((error: unknown) => ({ error }));

  return (
    <>
      <ModuleHeader
        eyebrow="Pagos"
        title="Registrar pago"
        description="Selecciona los cargos, revisa el total y confirma el cobro."
        action={
          <Link className="min-h-11 rounded-md border border-paper px-5 py-3 text-center text-sm font-black text-paper hover:bg-charcoal" href="/payments/new">
            Cambiar miembro
          </Link>
        }
      />
      {"error" in result ? (
        <p className="mt-6 rounded-lg border border-red-700 bg-red-50 p-5 text-sm font-bold text-red-900" role="alert">
          {isApiError(result.error) && result.error.code === "FORBIDDEN"
            ? "No tienes permiso para registrar pagos."
            : "No pudimos cargar los cargos del miembro. Intenta nuevamente."}
        </p>
      ) : !result.member ? (
        <p className="mt-6 rounded-lg border border-charcoal bg-paper p-5 text-sm font-semibold text-charcoal">
          No encontramos el miembro en este gimnasio.
        </p>
      ) : (
        <div className="mt-6 grid gap-6">
          <section className="rounded-lg border border-charcoal bg-paper p-5 shadow-sm">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-brand-red">Miembro seleccionado</p>
            <h2 className="mt-2 text-2xl font-black text-ink">{result.member.fullName}</h2>
            <p className="mt-1 text-sm font-semibold text-charcoal">
              {result.member.memberCode} · {result.member.status}
            </p>
          </section>

          {result.charges.length === 0 ? (
            <section className="rounded-lg border border-charcoal bg-paper p-6 text-center shadow-sm">
              <h2 className="text-xl font-black text-ink">No hay cargos pendientes.</h2>
              <p className="mt-2 text-sm text-charcoal">Este miembro no tiene saldos disponibles para cobrar.</p>
            </section>
          ) : (
            <RegisterPaymentForm
              charges={result.charges}
              defaultCurrency={activeGym.defaultCurrency}
              gymId={activeGym.gymId}
              gymMemberId={result.member.gymMemberId}
              paymentMethods={result.paymentMethods}
            />
          )}
        </div>
      )}
    </>
  );
}
