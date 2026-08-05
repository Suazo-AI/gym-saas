import Link from "next/link";
import { redirect } from "next/navigation";

import { AppShell } from "@/features/app/components/app-shell";
import { ModuleHeader } from "@/features/app/components/module-header";
import { requireUser } from "@/features/auth/services/auth.service";
import { getEntryDecisionState } from "@/features/entries/entry-decision-state";
import { FaceAccessModal } from "@/features/entries/components/face-access-modal";
import { ManualEntryForm } from "@/features/entries/components/manual-entry-form";
import { listGymEntries } from "@/features/entries/services/entry.repository";
import { getActiveGym } from "@/features/gyms/services/get-active-gym";
import { getMember, listMembers } from "@/features/members/services/member.repository";

type EntriesPageProps = {
  searchParams: Promise<{ search?: string; gymMemberId?: string }>;
};

const dateFormatter = new Intl.DateTimeFormat("es-NI", {
  dateStyle: "medium",
  timeStyle: "short",
});

export default async function EntriesPage({ searchParams }: EntriesPageProps) {
  const user = await requireUser();
  const activeGym = await getActiveGym();
  if (!activeGym) redirect("/login");

  const params = await searchParams;
  const [entriesResult, membersResult, selectedMemberResult] = await Promise.all([
    listGymEntries(activeGym.gymId).catch((error: unknown) => ({ error })),
    params.search
      ? listMembers({
          gymId: activeGym.gymId,
          page: 1,
          pageSize: 10,
          search: params.search,
          orderBy: "fullName",
          orderDirection: "asc",
        }).catch((error: unknown) => ({ error }))
      : Promise.resolve(null),
    params.gymMemberId
      ? getMember({
          gymId: activeGym.gymId,
          gymMemberId: params.gymMemberId,
        }).catch((error: unknown) => ({ error }))
      : Promise.resolve(null),
  ]);

  const selectedMember = selectedMemberResult
    && !("error" in selectedMemberResult)
    ? selectedMemberResult
    : null;

  return (
    <AppShell activeGym={activeGym} currentPath="/entries" userEmail={user.email}>
      <ModuleHeader
        action={<FaceAccessModal />}
        eyebrow="Entradas"
        title="Recepción rápida"
        description="Busca a un miembro, confirma su estado y registra cada intento de entrada."
      />

      <section className="mt-6 rounded-lg border border-charcoal bg-paper shadow-sm">
        <div className="border-b border-gray p-5">
          <h2 className="text-xl font-black text-ink">Registrar entrada manual</h2>
          <p className="mt-1 text-sm text-charcoal">
            Busca por nombre o código y selecciona al miembro correcto.
          </p>
        </div>

        <form className="flex flex-col gap-3 border-b border-gray p-4 sm:flex-row">
          <label className="sr-only" htmlFor="entry-member-search">
            Buscar miembro
          </label>
          <input
            className="min-h-11 flex-1 rounded-md border border-gray px-3 text-ink outline-none focus:border-brand-orange focus:ring-2 focus:ring-brand-sand"
            defaultValue={params.search ?? ""}
            id="entry-member-search"
            name="search"
            placeholder="Buscar por nombre o código"
          />
          <button
            className="min-h-11 rounded-md bg-ink px-5 py-3 text-sm font-black text-paper hover:bg-charcoal"
            type="submit"
          >
            Buscar
          </button>
        </form>

        {membersResult && "error" in membersResult ? (
          <p className="p-5 text-sm font-semibold text-brand-red" role="alert">
            No pudimos buscar miembros. Intenta nuevamente.
          </p>
        ) : membersResult && membersResult.data.length === 0 ? (
          <p className="p-5 text-sm text-charcoal">
            No encontramos miembros con esa búsqueda.
          </p>
        ) : membersResult ? (
          <div className="divide-y divide-gray">
            {membersResult.data.map((member) => (
              <Link
                className="flex min-h-11 items-center justify-between gap-4 px-5 py-3 hover:bg-gray-light"
                href={`/entries?search=${encodeURIComponent(params.search ?? "")}&gymMemberId=${member.gymMemberId}`}
                key={member.gymMemberId}
              >
                <span>
                  <strong className="block text-sm text-ink">{member.fullName}</strong>
                  <span className="text-sm text-charcoal">{member.memberCode}</span>
                </span>
                <span className="text-sm font-black text-ink">Seleccionar</span>
              </Link>
            ))}
          </div>
        ) : (
          <p className="p-5 text-sm text-charcoal">
            Escribe un nombre o código para comenzar.
          </p>
        )}
      </section>

      {selectedMemberResult && "error" in selectedMemberResult ? (
        <p
          className="mt-6 rounded-lg border border-brand-red bg-red-50 p-5 text-sm font-semibold text-brand-red"
          role="alert"
        >
          No pudimos cargar el miembro seleccionado.
        </p>
      ) : selectedMember ? (
        <div className="mt-6">
          <ManualEntryForm
            branchId={selectedMember.branchId}
            gymId={activeGym.gymId}
            gymMemberId={selectedMember.gymMemberId}
            memberCode={selectedMember.memberCode}
            memberFullName={selectedMember.fullName}
          />
        </div>
      ) : null}

      <section className="mt-6 rounded-lg border border-charcoal bg-paper shadow-sm">
        <div className="border-b border-gray p-5">
          <h2 className="text-xl font-black text-ink">Entradas recientes</h2>
          <p className="mt-1 text-sm text-charcoal">
            Historial manual y facial visible para tu gimnasio.
          </p>
        </div>

        {"error" in entriesResult ? (
          <p className="p-5 text-sm font-semibold text-brand-red" role="alert">
            No pudimos cargar las entradas. Intenta nuevamente.
          </p>
        ) : entriesResult.length === 0 ? (
          <p className="p-5 text-sm text-charcoal">Todavía no hay entradas registradas.</p>
        ) : (
          <div className="divide-y divide-gray">
            {entriesResult.map((entry) => {
              const state = getEntryDecisionState(entry);
              return (
                <div
                  className="grid gap-3 p-4 md:grid-cols-[0.8fr_1fr_1.5fr] md:items-center"
                  key={`${entry.source}-${entry.entryId}`}
                >
                  <span className="text-sm font-black text-ink">
                    {entry.source === "manual" ? "Manual" : "Facial"}
                  </span>
                  <span className="text-sm font-black text-ink">
                    <span aria-hidden="true">{state.icon}</span> {state.label}
                  </span>
                  <time className="text-sm text-charcoal" dateTime={entry.occurredAt}>
                    {dateFormatter.format(new Date(entry.occurredAt))}
                  </time>
                  {entry.decisionReason ? (
                    <p className="text-sm text-charcoal md:col-span-3">{entry.decisionReason}</p>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </AppShell>
  );
}
