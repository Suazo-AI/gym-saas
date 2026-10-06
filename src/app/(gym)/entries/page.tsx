import Link from "next/link";
import { redirect } from "next/navigation";

import { PersistedDateRangeForm } from "@/app/(gym)/_components/persisted-date-range-form";
import { ModuleHeader } from "@/features/app/components/module-header";
import { LoadError } from "@/features/app/components/load-error";
import { PersistedSearchForm } from "@/features/app/components/persisted-search-form";
import { getEntryDecisionState } from "@/features/entries/entry-decision-state";
import { FaceAccessModal } from "@/features/entries/components/face-access-modal";
import { getAccessPrecheck, precheckChip } from "@/features/entries/components/entry-access-notice";
import { ManualEntryForm } from "@/features/entries/components/manual-entry-form";
import { searchEntryMembers } from "@/features/entries/services/entry-member-search.repository";
import { listGymEntries } from "@/features/entries/services/entry.repository";
import { getActiveGym } from "@/features/gyms/services/get-active-gym";
import { hasGymPermission } from "@/features/gyms/services/require-gym-permission";
import { getMember } from "@/features/members/services/member.repository";

type EntriesPageProps = {
  searchParams: Promise<{ search?: string; gymMemberId?: string; from?: string; to?: string }>;
};

const dateFormatter = new Intl.DateTimeFormat("es-NI", {
  dateStyle: "medium",
  timeStyle: "short",
});

const toneChip = { success: "chip chip-ok", warning: "chip chip-wait", danger: "chip chip-stop" } as const;

export default async function EntriesPage({ searchParams }: EntriesPageProps) {
  const activeGym = await getActiveGym();
  if (!activeGym) redirect("/login");

  const params = await searchParams;
  const [entriesResult, membersResult, selectedMemberResult, selectedAccessResult, canCharge] = await Promise.all([
    listGymEntries({
      gymId: activeGym.gymId,
      from: params.from,
      to: params.to,
    }).catch((error: unknown) => ({ error })),
    params.search
      ? searchEntryMembers({
          gymId: activeGym.gymId,
          search: params.search,
        }).catch((error: unknown) => ({ error }))
      : Promise.resolve(null),
    params.gymMemberId
      ? getMember({
          gymId: activeGym.gymId,
          gymMemberId: params.gymMemberId,
        }).catch((error: unknown) => ({ error }))
      : Promise.resolve(null),
    params.gymMemberId
      ? searchEntryMembers({
          gymId: activeGym.gymId,
          search: params.gymMemberId,
        }).catch((error: unknown) => ({ error }))
      : Promise.resolve(null),
    // Solo decide si se muestra el atajo a cobrar; la RPC de pagos vuelve a validar.
    params.gymMemberId
      ? hasGymPermission(activeGym.gymId, "payments.manage").catch(() => false)
      : Promise.resolve(false),
  ]);

  const selectedMemberBase = selectedMemberResult
    && !("error" in selectedMemberResult)
    ? selectedMemberResult
    : null;
  const selectedAccess = selectedAccessResult
    && !("error" in selectedAccessResult)
    ? selectedAccessResult.find((member) => member.gymMemberId === params.gymMemberId) ?? null
    : null;
  const selectedAccessFailed = Boolean(
    params.gymMemberId
    && (
      !selectedAccessResult
      || "error" in selectedAccessResult
      || !selectedAccess
    )
  );
  const selectedMember = selectedMemberBase && selectedAccess
    ? {
        ...selectedMemberBase,
        financialAccessStatus: selectedAccess.financialAccessStatus,
      }
    : null;

  return (
    <>
      <ModuleHeader
        action={<FaceAccessModal />}
        eyebrow="Mostrador"
        title="Recepción"
        description="Busca al miembro, mira si puede entrar y registra su entrada."
      />

      <div className="mt-6 grid items-start gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <section aria-labelledby="entry-search-title" className="panel overflow-hidden">
          <div className="px-5 pt-4">
            <h2 className="type-heading" id="entry-search-title">Buscar miembro</h2>
          </div>
          <PersistedSearchForm placeholder="Buscar por nombre, teléfono o código" storageKey="fitmanager.entries.search" />

          {membersResult && "error" in membersResult ? (
            <p className="p-5 text-sm font-semibold text-stop" role="alert">
              No pudimos buscar miembros. Intenta nuevamente.
            </p>
          ) : membersResult && membersResult.length === 0 ? (
            <div className="p-5 text-sm text-muted">
              <p>No encontramos miembros con esa búsqueda.</p>
              <Link className="btn btn-secondary mt-3" href="/members/new">Registrar miembro nuevo</Link>
            </div>
          ) : membersResult ? (
            <ul className="divide-y divide-line">
              {membersResult.map((member) => {
                const chip = precheckChip[getAccessPrecheck(member)];
                const selected = member.gymMemberId === params.gymMemberId;
                return (
                  <li key={member.gymMemberId}>
                    <Link
                      aria-current={selected ? "true" : undefined}
                      className={`row-link flex min-h-14 items-center gap-3 px-5 py-3 ${selected ? "bg-accent-tint hover:bg-accent-tint" : ""}`}
                      href={{
                        pathname: "/entries",
                        query: {
                          search: params.search ?? "",
                          gymMemberId: member.gymMemberId,
                          ...(params.from ? { from: params.from } : {}),
                          ...(params.to ? { to: params.to } : {}),
                        },
                      }}
                    >
                      <Initials name={member.fullName} />
                      <span className="min-w-0 flex-1">
                        <strong className="block truncate text-[0.9375rem] font-semibold text-ink">{member.fullName}</strong>
                        <span className="tabular text-sm text-muted">{member.memberCode}</span>
                      </span>
                      <span className={chip.className}>{chip.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="p-5 text-sm text-muted">
              Escribe un nombre, teléfono o código para comenzar.
            </p>
          )}
        </section>

        <div className="lg:sticky lg:top-24">
          {(selectedMemberResult && "error" in selectedMemberResult) || selectedAccessFailed ? (
            <LoadError>
              No pudimos cargar el miembro seleccionado.
            </LoadError>
          ) : selectedMember ? (
            <ManualEntryForm
              access={selectedMember}
              branchId={selectedMember.branchId}
              canCharge={canCharge}
              gymId={activeGym.gymId}
              gymMemberId={selectedMember.gymMemberId}
              key={selectedMember.gymMemberId}
              memberCode={selectedMember.memberCode}
              memberFullName={selectedMember.fullName}
            />
          ) : (
            <div className="grid min-h-64 place-items-center rounded-[20px] border border-dashed border-line-strong p-8 text-center">
              <div>
                <p className="type-heading text-ink">Nadie seleccionado</p>
                <p className="mt-1 text-sm text-muted">Elige un miembro de la lista para ver si puede entrar.</p>
              </div>
            </div>
          )}
        </div>
      </div>

      <section aria-labelledby="entry-history-title" className="panel mt-8 overflow-hidden">
        <div className="panel-head">
          <div>
            <h2 className="type-heading" id="entry-history-title">Entradas por periodo</h2>
            <p className="mt-0.5 text-sm text-muted">Historial manual y facial de tu gimnasio.</p>
          </div>
        </div>

        <PersistedDateRangeForm from={params.from} storageKey="fitmanager:entries-date-range" to={params.to} />

        {"error" in entriesResult ? (
          <LoadError className="m-4">
            No pudimos cargar las entradas. Intenta nuevamente.
          </LoadError>
        ) : entriesResult.length === 0 ? (
          <p className="p-5 text-sm text-muted">Todavía no hay entradas registradas.</p>
        ) : (
          <ul className="divide-y divide-line">
            {entriesResult.map((entry) => {
              const state = getEntryDecisionState(entry);
              return (
                <li
                  className="grid gap-x-4 gap-y-1 px-5 py-3 sm:grid-cols-[11rem_5rem_minmax(0,1fr)] sm:items-center"
                  key={`${entry.source}-${entry.entryId}`}
                >
                  <time className="tabular text-sm text-ink-2" dateTime={entry.occurredAt}>
                    {dateFormatter.format(new Date(entry.occurredAt))}
                  </time>
                  <span className="text-sm text-muted">
                    {entry.source === "manual" ? "Manual" : "Facial"}
                  </span>
                  <span className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
                    <span className={toneChip[state.tone]}>
                      <span aria-hidden="true">{state.icon}</span> {state.label}
                    </span>
                    {entry.decisionReason ? (
                      <span className="min-w-0 truncate text-sm text-muted">{entry.decisionReason}</span>
                    ) : null}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </>
  );
}

function Initials({ name }: { name: string }) {
  const letters = name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("");
  return (
    <span aria-hidden="true" className="grid size-9 shrink-0 place-items-center rounded-full bg-fill-strong text-xs font-bold text-ink-2">
      {letters || "?"}
    </span>
  );
}
