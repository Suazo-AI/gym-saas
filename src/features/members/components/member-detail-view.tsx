import type { MembershipPlanDto } from "@/features/memberships/types/membership.dto";
import { LoadError } from "@/features/app/components/load-error";

import type { MemberDetailDto } from "../types/member.dto";
import { getMemberOperationalState } from "../member-operational-state";

type MemberDetailViewProps = {
  member: MemberDetailDto;
  gymId?: string;
  membershipPlans?: MembershipPlanDto[];
  plansLoadFailed?: boolean;
  assignMembershipAction?: (formData: FormData) => Promise<void>;
  cancelMembershipAction?: (formData: FormData) => Promise<void>;
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
  pending: "Pendiente",
  overdue: "Vencido",
};

const contactLabels: Record<string, string> = {
  phone: "Teléfono",
  email: "Correo",
  whatsapp: "WhatsApp",
};

export function MemberDetailView({
  member,
  gymId = member.gymId,
  membershipPlans = [],
  plansLoadFailed = false,
  assignMembershipAction,
  cancelMembershipAction,
}: MemberDetailViewProps) {
  const operationalState = getMemberOperationalState({
    memberStatus: member.status,
    membershipStatus: member.membershipStatus,
    hasOverdueCharges: member.hasOverdueCharges,
  });
  const canAssignMembership =
    !member.currentSubscription ||
    ["canceled", "expired"].includes(member.currentSubscription.status);

  return (
    <div className="mt-6 grid items-start gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,0.65fr)]">
      <div className="grid min-w-0 gap-6">
        <section className="panel min-w-0 p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <p className="type-eyebrow tabular">
                {member.memberCode}
              </p>
              <h2 className="type-heading mt-2 break-words text-2xl">{member.fullName}</h2>
              <p className="mt-1 text-sm text-muted">
                {member.branchName ?? "Sin sucursal asignada"}
              </p>
            </div>
            <div
              className="max-w-sm sm:max-w-64"
            >
              <strong className={`chip ${member.hasOverdueCharges || member.membershipStatus === "past_due" ? "chip-stop" : toneClasses(operationalState.tone)}`}>{operationalState.label}</strong>
              <p className="mt-2 text-sm text-muted">{operationalState.description}</p>
            </div>
          </div>
        </section>

        <section className="panel min-w-0 p-5">
          <h2 className="type-heading">
            {canAssignMembership ? "Asignar membresía" : "Membresía actual"}
          </h2>
          {!canAssignMembership && member.currentSubscription ? (
            <div>
              <dl className="mt-4 grid gap-4 sm:grid-cols-2">
                <Detail label="Plan" value={member.currentSubscription.planName} />
                <div>
                  <dt className="type-eyebrow">Estado</dt>
                  <dd className="mt-1"><span className={`chip ${statusChip(member.currentSubscription.status)}`}>{statusLabels[member.currentSubscription.status] ?? member.currentSubscription.status}</span></dd>
                </div>
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
              {cancelMembershipAction ? (
                <details className="mt-5 rounded-xl border border-line bg-fill p-4">
                  <summary className="cursor-pointer text-sm font-semibold text-stop">Cancelar membresía</summary>
                  <form action={cancelMembershipAction} className="mt-4 grid gap-3">
                    <input name="gymMemberId" type="hidden" value={member.gymMemberId} />
                    <input name="subscriptionId" type="hidden" value={member.currentSubscription.id} />
                    <label className="field-label">
                      Motivo de cancelación
                      <input className="field" name="reason" required />
                    </label>
                    <label className="flex min-h-11 items-center gap-3 text-sm font-semibold text-ink-2">
                      <input className="size-5 shrink-0" name="cancelAtPeriodEnd" type="checkbox" />
                      Cancelar al terminar el período actual
                    </label>
                    <button className="btn btn-secondary justify-self-start text-stop" type="submit">
                      Confirmar cancelación
                    </button>
                  </form>
                </details>
              ) : null}
            </div>
          ) : plansLoadFailed ? (
            <LoadError className="mt-4">
              No pudimos cargar los planes. Intenta nuevamente.
            </LoadError>
          ) : membershipPlans.length === 0 ? (
            <p className="mt-4 rounded-xl bg-fill p-4 text-sm text-muted">
              No hay planes activos disponibles para asignar.
            </p>
          ) : assignMembershipAction ? (
            <form action={assignMembershipAction} className="mt-4 grid gap-4">
              <input name="gymId" type="hidden" value={gymId} />
              <input name="gymMemberId" type="hidden" value={member.gymMemberId} />

              <div className="grid gap-2">
                <label className="field-label" htmlFor="membership-plan">
                  Plan
                </label>
                <select
                  className="field tabular mt-0 min-w-0"
                  id="membership-plan"
                  name="membershipPlanId"
                  required
                >
                  <option value="">Selecciona un plan</option>
                  {membershipPlans.map((plan) => (
                    <option key={plan.id} value={plan.id}>
                      {plan.name} · {plan.currency} {plan.price}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid gap-2">
                <label className="field-label" htmlFor="membership-start-date">
                  Fecha de inicio
                </label>
                <input
                  className="field tabular mt-0 min-w-0"
                  defaultValue={todayUtc()}
                  id="membership-start-date"
                  name="startDate"
                  required
                  type="date"
                />
              </div>

              <label className="flex min-h-11 items-center gap-3 rounded-xl border border-line px-3 py-2 text-sm font-semibold text-ink-2">
                <input
                  className="size-5 shrink-0"
                  defaultChecked
                  name="generateFirstCharge"
                  type="checkbox"
                />
                Generar el primer cargo
              </label>

              <button
                className="btn btn-secondary"
                type="submit"
              >
                Asignar membresía
              </button>
            </form>
          ) : (
            <p className="mt-4 rounded-xl bg-fill p-4 text-sm text-muted">
              No pudimos mostrar el formulario para asignar la membresía.
            </p>
          )}
        </section>

        <section className="panel min-w-0 overflow-hidden">
          <div className="panel-head">
            <div>
              <h2 className="type-heading">Cargos pendientes</h2>
              <p className="mt-1 text-sm text-muted">
                Cada monto conserva su moneda original.
              </p>
            </div>
            <span className="tabular text-sm font-semibold text-muted">
              {member.pendingCharges.length} registrados
            </span>
          </div>

          {member.pendingCharges.length === 0 ? (
            <p className="p-5 text-sm text-muted">
              No hay cargos pendientes visibles.
            </p>
          ) : (
            <ul className="divide-y divide-line">
              {member.pendingCharges.map((charge) => (
                <li
                  className="grid gap-3 px-5 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
                  key={charge.id}
                >
                  <div>
                    <strong className="tabular block font-semibold text-ink">
                      Vence {formatDate(charge.dueDate)}
                    </strong>
                    <span className={`chip mt-2 ${statusChip(charge.status)}`}>
                      Estado: {statusLabels[charge.status] ?? charge.status}
                    </span>
                  </div>
                  <strong className="tabular text-lg font-semibold text-ink">
                    {charge.currency} {charge.amountDue}
                  </strong>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <aside className="grid min-w-0 content-start gap-6">
        <section className="panel min-w-0 p-5">
          <h2 className="type-heading">Pagos</h2>
          {member.paymentSummary ? (
            <dl className="mt-4 grid gap-4">
              <Detail label="Total pagado registrado" value={member.paymentSummary.settledTotal} />
              <Detail
                label="Último pago"
                value={member.paymentSummary.lastPaymentAt
                  ? formatDate(member.paymentSummary.lastPaymentAt)
                  : "Sin fecha registrada"}
              />
              <p className="text-xs text-muted">
                Este resumen no incluye moneda; no se combinan ni convierten montos aquí.
              </p>
            </dl>
          ) : (
            <p className="mt-3 text-sm text-muted">
              No hay resumen de pagos disponible.
            </p>
          )}
        </section>

        <section className="panel min-w-0 p-5">
          <h2 className="type-heading">Contacto</h2>
          {member.contacts.length === 0 ? (
            <p className="mt-3 text-sm text-muted">Sin contactos registrados.</p>
          ) : (
            <dl className="mt-4 grid gap-3">
              {member.contacts.map((contact) => (
                <Detail
                  key={contact.id}
                  label={`${contactLabels[contact.type] ?? contact.type}${contact.isPrimary ? " · principal" : ""}`}
                  value={contact.value}
                />
              ))}
            </dl>
          )}
          {member.notes ? (
            <div className="mt-5 border-t border-line pt-4">
              <h3 className="field-label">Notas</h3>
              <p className="mt-2 whitespace-pre-wrap break-words text-sm text-muted">
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
    <div className="min-w-0">
      <dt className="type-eyebrow">{label}</dt>
      <dd className="tabular mt-1 break-words text-sm font-semibold text-ink">{value}</dd>
    </div>
  );
}

function toneClasses(tone: "success" | "warning" | "danger" | "neutral") {
  if (tone === "success") return "chip-ok";
  if (tone === "warning") return "chip-wait";
  if (tone === "danger") return "chip-stop";
  return "chip-neutral";
}

function statusChip(status: string) {
  if (status === "active") return "chip-ok";
  if (["overdue", "past_due"].includes(status)) return "chip-stop";
  if (["expiring", "grace", "pending"].includes(status)) return "chip-wait";
  return "chip-neutral";
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("es-NI", {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(new Date(value));
}

function todayUtc() {
  return new Date().toISOString().slice(0, 10);
}
