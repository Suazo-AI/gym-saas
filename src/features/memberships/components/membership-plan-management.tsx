"use client";

import { useActionState } from "react";

import { LoadError } from "@/features/app/components/load-error";
import { ActionFeedback } from "@/features/app/components/action-feedback";

import {
  createMembershipPlanAction,
  createMembershipPlanBenefitAction,
  restoreMembershipPlanAction,
  retireMembershipPlanAction,
  updateMembershipPlanAction,
  retireMembershipPlanBenefitAction,
  type MembershipPlanActionState,
} from "../actions/membership-plan.actions";
import type { DeletedMembershipPlanDto, MembershipPlanDto } from "../types/membership.dto";

const initialState: MembershipPlanActionState = { ok: false };
const controlClass = "field min-w-0";

type Props = {
  plans: MembershipPlanDto[];
  deletedPlans: DeletedMembershipPlanDto[];
  canManage?: boolean;
  deletedPlansUnavailable?: boolean;
};

export function MembershipPlanManagement({ plans, deletedPlans, canManage = true, deletedPlansUnavailable = false }: Props) {
  return (
    <div className={`mt-6 grid items-start gap-6 ${canManage ? "xl:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]" : ""}`}>
      {canManage ? <PlanForm action={createMembershipPlanAction} buttonLabel="Crear plan" eyebrow="Nuevo plan" title="Configurar membresía" /> : null}
      <section className="panel min-w-0 overflow-hidden">
        <header className="panel-head">
          <div>
            <p className="type-eyebrow">Oferta comercial</p>
            <h2 className="type-heading mt-1">Planes de membresía</h2>
            <p className="tabular mt-1 text-sm text-muted">{plans.length} {plans.length === 1 ? "plan disponible" : "planes disponibles"}.</p>
          </div>
        </header>
        {plans.length === 0 ? <p className="p-8 text-center text-sm text-muted">No hay planes disponibles.</p> : (
          <>
            <div aria-hidden="true" className="type-eyebrow hidden grid-cols-[minmax(0,1fr)_auto] gap-4 border-b border-line bg-fill px-5 py-3 sm:grid"><span>Plan y disponibilidad</span><span>Precio y duración</span></div>
            <ul className="divide-y divide-line">{plans.map((plan) => <li key={plan.id}><PlanEditor canManage={canManage} plan={plan} /></li>)}</ul>
          </>
        )}
        {canManage ? <DeletedPlans plans={deletedPlans} unavailable={deletedPlansUnavailable} /> : null}
      </section>
    </div>
  );
}

function PlanEditor({ plan, canManage }: { plan: MembershipPlanDto; canManage: boolean }) {
  const duration = formatDuration(plan.durationCount, plan.durationUnit);
  return (
    <article className="min-w-0 p-5">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-3 gap-y-1">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="type-heading break-words">{plan.name}</h3>
            <span className={`chip ${plan.isActive ? "chip-ok" : "chip-neutral"}`}>{plan.isActive ? "Activo" : "Inactivo"}</span>
          </div>
          <p className="tabular mt-1 text-sm text-muted"><span className="sm:sr-only">Código </span>{plan.code}</p>
        </div>
        <div className="text-right">
          <p className="tabular font-semibold text-ink sm:text-xl">{plan.currency} {plan.price}</p>
          <p className="tabular text-sm text-muted">por {duration}</p>
        </div>
      </div>
      <p className="mt-2 break-words text-sm text-muted">{plan.description ?? "Sin descripción"}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <span className="chip chip-neutral tabular">{plan.graceDays} días de gracia</span>
        <span className="chip chip-neutral">Renovación {plan.autoRenew ? "automática" : "manual"}</span>
      </div>
      <Benefits plan={plan} canManage={canManage} />
      {canManage ? (
        <details className="mt-4 rounded-xl border border-line bg-fill p-4">
          <summary className="cursor-pointer text-sm font-semibold text-ink">Editar plan</summary>
          <PlanForm action={updateMembershipPlanAction} buttonLabel="Guardar cambios" plan={plan} />
          <RetirePlan planId={plan.id} />
        </details>
      ) : null}
    </article>
  );
}

function Benefits({ plan, canManage }: { plan: MembershipPlanDto; canManage: boolean }) {
  const [state, action, pending] = useActionState(createMembershipPlanBenefitAction, initialState);
  return (
    <section className="mt-4 border-t border-line pt-4">
      <h4 className="type-eyebrow">Beneficios</h4>
      {plan.benefits.length === 0 ? <p className="mt-2 text-sm text-muted">Este plan no tiene beneficios registrados.</p> : (
        <ul className="mt-2 divide-y divide-line">
          {plan.benefits.map((benefit) => (
            <li className="py-3" key={benefit.id}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="break-words text-sm font-semibold text-ink">{benefit.description}</span>
                <span className="tabular text-xs text-muted">Código {benefit.benefitCode}</span>
              </div>
              {canManage ? <RetireBenefit benefitId={benefit.id} /> : null}
            </li>
          ))}
        </ul>
      )}
      {canManage ? (
        <form action={action} className="mt-4 grid min-w-0 gap-3 sm:grid-cols-2">
          <input name="planId" type="hidden" value={plan.id} />
          <Field label="Código" name="benefitCode" placeholder="SAUNA" required />
          <Field label="Descripción" name="description" placeholder="Uso de sauna" required />
          <button className="btn btn-secondary sm:col-span-2" disabled={pending} type="submit">{pending ? "Agregando…" : "Agregar beneficio"}</button>
          <ActionMessage state={state} />
        </form>
      ) : null}
    </section>
  );
}

function RetireBenefit({ benefitId }: { benefitId: string }) {
  const [state, action, pending] = useActionState(retireMembershipPlanBenefitAction, initialState);
  return <details className="mt-2"><summary className="btn btn-secondary cursor-pointer text-stop">Retirar beneficio</summary><form action={action} className="mt-3 grid gap-3"><input name="benefitId" type="hidden" value={benefitId} /><Field label="Motivo" name="reason" required /><button className="btn btn-secondary text-stop" disabled={pending} type="submit">{pending ? "Retirando…" : "Confirmar retiro"}</button></form><ActionMessage state={state} /></details>;
}

function PlanForm({ action, buttonLabel, eyebrow, title, plan }: { action: typeof createMembershipPlanAction; buttonLabel: string; eyebrow?: string; title?: string; plan?: MembershipPlanDto }) {
  const [state, formAction, pending] = useActionState(action, initialState);
  return (
    <form action={formAction} className={plan ? "mt-4 grid min-w-0 gap-4 sm:grid-cols-2" : "panel min-w-0 self-start p-5"}>
      {eyebrow ? <p className="type-eyebrow">{eyebrow}</p> : null}
      {title ? <h2 className="type-heading mt-1">{title}</h2> : null}
      {plan ? <input name="planId" type="hidden" value={plan.id} /> : null}
      <div className={plan ? "contents" : "mt-5 grid gap-4"}>
        <Field defaultValue={plan?.code} label="Código" name="code" placeholder="Ej. MENSUAL" required />
        <Field defaultValue={plan?.name} label="Nombre" name="name" placeholder="Ej. Plan mensual" required />
        <Field defaultValue={plan?.description ?? ""} label="Descripción" name="description" />
        <Field defaultValue={plan?.price} inputMode="decimal" label="Precio" name="price" placeholder="0.00" required />
        <Select defaultValue={plan?.currency ?? "NIO"} label="Moneda" name="currency" options={[['NIO', 'Córdobas (NIO)'], ['USD', 'Dólares (USD)']]} />
        <Field defaultValue={String(plan?.durationCount ?? 1)} inputMode="numeric" label="Duración" min="1" name="durationCount" required type="number" />
        <Select defaultValue={plan?.durationUnit ?? "month"} label="Unidad" name="durationUnit" options={[['day', 'Día(s)'], ['week', 'Semana(s)'], ['month', 'Mes(es)']]} />
        <Field defaultValue={String(plan?.graceDays ?? 0)} inputMode="numeric" label="Días de gracia" min="0" name="graceDays" required type="number" />
        <Select defaultValue={String(plan?.autoRenew ?? true)} label="Renovación" name="autoRenew" options={[['true', 'Automática'], ['false', 'Manual']]} />
        <Select defaultValue={String(plan?.isActive ?? true)} label="Estado" name="isActive" options={[['true', 'Activo'], ['false', 'Inactivo']]} />
        <ActionMessage state={state} />
        <button className={`btn ${plan ? "btn-secondary sm:col-span-2" : "btn-primary btn-lg"}`} disabled={pending} type="submit">{pending ? "Guardando…" : buttonLabel}</button>
      </div>
    </form>
  );
}

function RetirePlan({ planId }: { planId: string }) {
  const [state, action, pending] = useActionState(retireMembershipPlanAction, initialState);
  return <form action={action} className="mt-5 border-t border-line pt-4"><input name="planId" type="hidden" value={planId} /><Field label="Motivo del retiro" name="reason" required /><ActionMessage state={state} /><button className="btn btn-secondary mt-3 text-stop" disabled={pending} type="submit">{pending ? "Retirando…" : "Retirar plan"}</button></form>;
}

function DeletedPlans({ plans, unavailable }: { plans: DeletedMembershipPlanDto[]; unavailable: boolean }) {
  return <div className="border-t border-line bg-fill p-5"><h2 className="type-heading">Papelera</h2>{unavailable ? <LoadError className="mt-2">No pudimos cargar los planes retirados.</LoadError> : null}{!unavailable && plans.length === 0 ? <p className="mt-2 text-sm text-muted">No hay planes retirados.</p> : null}<div className="mt-3 grid gap-3">{plans.map((plan) => <RestorePlan key={plan.id} plan={plan} />)}</div></div>;
}

function RestorePlan({ plan }: { plan: DeletedMembershipPlanDto }) {
  const [state, action, pending] = useActionState(restoreMembershipPlanAction, initialState);
  return <form action={action} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-surface p-4"><input name="planId" type="hidden" value={plan.id} /><div className="min-w-0"><p className="break-words font-semibold text-ink">{plan.label}</p><p className="break-words text-sm text-muted">{plan.reason ?? "Sin motivo registrado"}</p><ActionMessage state={state} /></div><button className="btn btn-secondary" disabled={pending} type="submit">{pending ? "Restaurando…" : "Restaurar"}</button></form>;
}

function Field(props: { label: string; name: string; required?: boolean; defaultValue?: string; placeholder?: string; type?: string; min?: string; inputMode?: "decimal" | "numeric" }) {
  const { label, ...inputProps } = props;
  return <label className="field-label min-w-0">{label}<input className={`${controlClass} ${props.inputMode || props.name === "code" ? "tabular" : ""}`} {...inputProps} /></label>;
}

function Select({ label, name, defaultValue, options }: { label: string; name: string; defaultValue: string; options: Array<[string, string]> }) {
  return <label className="field-label min-w-0">{label}<select className={controlClass} defaultValue={defaultValue} name={name}>{options.map(([value, text]) => <option key={value} value={value}>{text}</option>)}</select></label>;
}

function ActionMessage({ state }: { state: MembershipPlanActionState }) { return <ActionFeedback state={state} />; }

function formatDuration(count: number, unit: MembershipPlanDto["durationUnit"]) {
  const labels = { day: count === 1 ? "día" : "días", week: count === 1 ? "semana" : "semanas", month: count === 1 ? "mes" : "meses" };
  return `${count} ${labels[unit]}`;
}
