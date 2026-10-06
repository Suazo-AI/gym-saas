import Link from "next/link";
import { redirect } from "next/navigation";

import { ModuleHeader } from "@/features/app/components/module-header";
import { LoadError } from "@/features/app/components/load-error";
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
        <section aria-label="Buscar miembro" className="panel mt-6 max-w-3xl overflow-hidden">
          <PersistedSearchForm placeholder="Buscar por nombre o código" storageKey="fitmanager.payments.new.search" />
          {!params.search ? (
            <p className="p-5 text-sm text-muted">Escribe el nombre o código del miembro.</p>
          ) : !members ? (
            <p className="p-5 text-sm font-semibold text-stop" role="alert">No pudimos buscar miembros. Intenta nuevamente.</p>
          ) : members.data.length === 0 ? (
            <p className="p-5 text-sm text-muted">No encontramos miembros.</p>
          ) : (
            <ul className="divide-y divide-line">
              {members.data.map((member) => (
                <li key={member.gymMemberId}>
                  <Link
                    className="row-link flex min-h-14 items-center justify-between gap-4 px-5 py-3"
                    href={`/payments/new?gymMemberId=${member.gymMemberId}`}
                  >
                    <span className="min-w-0">
                      <strong className="block truncate font-semibold text-ink">{member.fullName}</strong>
                      <span className="tabular text-sm text-muted">{member.memberCode} · {member.status}</span>
                    </span>
                    <span className="text-sm font-semibold text-accent">Seleccionar</span>
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
          <Link className="btn btn-secondary" href="/payments/new">
            Cambiar miembro
          </Link>
        }
      />
      {"error" in result ? (
        <LoadError className="mt-6">
          {isApiError(result.error) && result.error.code === "FORBIDDEN"
            ? "No tienes permiso para registrar pagos."
            : "No pudimos cargar los cargos del miembro. Intenta nuevamente."}
        </LoadError>
      ) : !result.member ? (
        <p className="panel mt-6 p-5 text-sm font-semibold text-muted">
          No encontramos el miembro en este gimnasio.
        </p>
      ) : (
        <div className="mt-6 grid gap-6">
          <section className="panel flex flex-wrap items-center justify-between gap-3 px-5 py-4">
            <div className="min-w-0">
              <p className="type-eyebrow">Miembro</p>
              <h2 className="type-heading mt-0.5 text-xl">{result.member.fullName}</h2>
              <p className="tabular text-sm text-muted">{result.member.memberCode} · {result.member.status}</p>
            </div>
            <Link className="btn btn-quiet text-sm" href={`/entries?gymMemberId=${result.member.gymMemberId}`}>
              Ver en recepción
            </Link>
          </section>

          {result.charges.length === 0 ? (
            <section className="panel p-8 text-center">
              <h2 className="type-heading">No hay cargos pendientes.</h2>
              <p className="mt-1 text-sm text-muted">Este miembro no tiene saldos disponibles para cobrar.</p>
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
