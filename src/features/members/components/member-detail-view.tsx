import type { MemberDetailDto } from "../types/member.dto";
import { getMemberOperationalState } from "../member-operational-state";

export function MemberDetailView({ member }: { member: MemberDetailDto }) {
  const operationalState = getMemberOperationalState({
    memberStatus: member.status,
    membershipStatus: member.membershipStatus,
    hasOverdueCharges: member.hasOverdueCharges,
  });

  return (
    <div className="mt-6 grid gap-6 xl:grid-cols-[1.35fr_0.65fr]">
      <div className="grid gap-6">
        <section className="rounded-lg border border-charcoal bg-paper p-5 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-brand-red">
                {member.memberCode}
              </p>
              <h2 className="mt-2 text-2xl font-black text-ink">{member.fullName}</h2>
              <p className="mt-1 text-sm font-semibold text-gray-dark">
                {member.branchName ?? "Sin sucursal asignada"}
              </p>
            </div>
            <div
              className={`max-w-sm rounded-md border px-4 py-3 ${toneClasses(operationalState.tone)}`}
            >
              <strong className="block text-sm font-black">{operationalState.label}</strong>
              <p className="mt-1 text-sm font-semibold">{operationalState.description}</p>
            </div>
          </div>
        </section>

        <section className="rounded-lg border border-charcoal bg-paper p-5 shadow-sm">
          <h2 className="text-xl font-black text-ink">Membresía actual</h2>
          {member.currentSubscription ? (
            <dl className="mt-4 grid gap-4 sm:grid-cols-2">
              <Detail label="Plan" value={member.currentSubscription.planName} />
              <Detail label="Estado" value={member.currentSubscription.status} />
              <Detail
                label="Monto recurrente"
                value={`${member.currentSubscription.currency} ${member.currentSubscription.recurringAmount}`}
              />
              <Detail
                label="Inicio"
                value={formatDate(member.currentSubscription.startDate)}
              />
              <Detail
                label="Próximo pago"
                value={member.nextPaymentDate ? formatDate(member.nextPaymentDate) : "Sin fecha registrada"}
              />
              <Detail
                label="Fin"
                value={member.currentSubscription.endDate
                  ? formatDate(member.currentSubscription.endDate)
                  : "Sin fecha de finalización"}
              />
            </dl>
          ) : (
            <p className="mt-3 text-sm font-semibold text-gray-dark">
              No hay una membresía actual registrada.
            </p>
          )}
        </section>

        <section className="rounded-lg border border-charcoal bg-paper p-5 shadow-sm">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <h2 className="text-xl font-black text-ink">Cargos pendientes</h2>
              <p className="mt-1 text-sm font-semibold text-gray-dark">
                Cada monto conserva su moneda original.
              </p>
            </div>
            <span className="text-sm font-black text-ink">
              {member.pendingCharges.length} registrados
            </span>
          </div>

          {member.pendingCharges.length === 0 ? (
            <p className="mt-4 rounded-md bg-gray-light p-4 text-sm font-semibold text-gray-dark">
              No hay cargos pendientes visibles.
            </p>
          ) : (
            <div className="mt-4 grid gap-3">
              {member.pendingCharges.map((charge) => (
                <article
                  className="grid gap-2 rounded-md border border-gray p-4 sm:grid-cols-[1fr_auto] sm:items-center"
                  key={charge.id}
                >
                  <div>
                    <strong className="block text-ink">
                      Vence {formatDate(charge.dueDate)}
                    </strong>
                    <span className="text-sm font-semibold text-gray-dark">
                      Estado: {charge.status}
                    </span>
                  </div>
                  <strong className="text-lg font-black text-ink">
                    {charge.currency} {charge.amountDue}
                  </strong>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>

      <aside className="grid content-start gap-6">
        <section className="rounded-lg border border-charcoal bg-paper p-5 shadow-sm">
          <h2 className="text-xl font-black text-ink">Pagos</h2>
          {member.paymentSummary ? (
            <dl className="mt-4 grid gap-4">
              <Detail label="Total pagado registrado" value={member.paymentSummary.settledTotal} />
              <Detail
                label="Último pago"
                value={member.paymentSummary.lastPaymentAt
                  ? formatDate(member.paymentSummary.lastPaymentAt)
                  : "Sin fecha registrada"}
              />
              <p className="text-xs font-semibold text-gray-dark">
                Este resumen no incluye moneda; no se combinan ni convierten montos aquí.
              </p>
            </dl>
          ) : (
            <p className="mt-3 text-sm font-semibold text-gray-dark">
              No hay resumen de pagos disponible.
            </p>
          )}
        </section>

        <section className="rounded-lg border border-charcoal bg-paper p-5 shadow-sm">
          <h2 className="text-xl font-black text-ink">Contacto</h2>
          {member.contacts.length === 0 ? (
            <p className="mt-3 text-sm font-semibold text-gray-dark">Sin contactos registrados.</p>
          ) : (
            <dl className="mt-4 grid gap-3">
              {member.contacts.map((contact) => (
                <Detail
                  key={contact.id}
                  label={`${contact.type}${contact.isPrimary ? " · principal" : ""}`}
                  value={contact.value}
                />
              ))}
            </dl>
          )}
          {member.notes ? (
            <div className="mt-5 border-t border-gray pt-4">
              <h3 className="text-sm font-black text-ink">Notas</h3>
              <p className="mt-2 whitespace-pre-wrap text-sm font-semibold text-gray-dark">
                {member.notes}
              </p>
            </div>
          ) : null}
        </section>
      </aside>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-black uppercase tracking-[0.12em] text-gray-dark">{label}</dt>
      <dd className="mt-1 break-words text-sm font-black text-ink">{value}</dd>
    </div>
  );
}

function toneClasses(tone: "success" | "warning" | "danger" | "neutral") {
  if (tone === "success") return "border-emerald-300 bg-emerald-50 text-emerald-900";
  if (tone === "warning") return "border-brand-orange bg-brand-sand/30 text-ink";
  if (tone === "danger") return "border-brand-red bg-red-50 text-brand-red";
  return "border-gray bg-gray-light text-ink";
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("es-NI", {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(new Date(value));
}
