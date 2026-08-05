"use client";

import { useActionState } from "react";

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
const controlClass = "mt-2 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-ink outline-none focus:border-brand-green focus:ring-2 focus:ring-brand-sand";

type Props = {
  plans: MembershipPlanDto[];
  deletedPlans: DeletedMembershipPlanDto[];
  canManage?: boolean;
  deletedPlansUnavailable?: boolean;
};

export function MembershipPlanManagement({ plans, deletedPlans, canManage = true, deletedPlansUnavailable = false }: Props) {
  return (
    <div className="mt-6 grid gap-6 xl:grid-cols-[380px_1fr]">
      {canManage ? <PlanForm action={createMembershipPlanAction} buttonLabel="Crear plan" eyebrow="Nuevo plan" title="Configurar membresía" /> : null}
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <header className="border-b border-slate-200 p-5">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-brand-green">Oferta comercial</p>
          <h2 className="mt-2 text-xl font-black text-ink">Planes de membresía</h2>
          <p className="mt-1 text-sm text-gray">{plans.length} {plans.length === 1 ? "plan disponible" : "planes disponibles"}.</p>
        </header>
        {plans.length === 0 ? <p className="p-8 text-center text-sm font-semibold text-gray">No hay planes disponibles.</p> : (
          <div className="divide-y divide-slate-100">{plans.map((plan) => <PlanEditor canManage={canManage} key={plan.id} plan={plan} />)}</div>
        )}
        {canManage ? <DeletedPlans plans={deletedPlans} unavailable={deletedPlansUnavailable} /> : null}
      </section>
    </div>
  );
}

function PlanEditor({ plan, canManage }: { plan: MembershipPlanDto; canManage: boolean }) {
  const duration = formatDuration(plan.durationCount, plan.durationUnit);
  return (
    <article className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.14em] text-brand-green">{plan.code}</p>
          <h3 className="mt-1 text-xl font-black text-ink">{plan.name}</h3>
          <p className="mt-1 text-sm text-gray">{plan.description ?? "Sin descripción"}</p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-black text-ink">{plan.currency} {plan.price}</p>
          <p className="text-sm font-semibold text-gray">por {duration}</p>
          <span className={`mt-2 inline-block rounded-full px-3 py-1 text-xs font-black uppercase ${plan.isActive ? "bg-brand-sand text-green-900" : "bg-slate-200 text-slate-700"}`}>{plan.isActive ? "Activo" : "Inactivo"}</span>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2 text-xs font-bold text-slate-700">
        <span className="rounded-full bg-slate-100 px-3 py-1">{plan.graceDays} días de gracia</span>
        <span className="rounded-full bg-slate-100 px-3 py-1">Renovación {plan.autoRenew ? "automática" : "manual"}</span>
      </div>
      <Benefits plan={plan} canManage={canManage} />
      {canManage ? (
        <details className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <summary className="cursor-pointer text-sm font-black text-ink">Editar plan</summary>
          <PlanForm action={updateMembershipPlanAction} buttonLabel="Guardar cambios" plan={plan} />
          <RetirePlan planId={plan.id} />
        </details>
      ) : null}
    </article>
  );
}

function Benefits({ plan, canManage }: { plan: MembershipPlanDto; canManage: boolean }) {
  const [state, action, pending] = useActionState(createMembershipPlanBenefitAction, initialState);
  return <section className="mt-5 rounded-xl border border-slate-200 p-4"><h4 className="font-black text-ink">Beneficios</h4>{plan.benefits.length === 0 ? <p className="mt-2 text-sm text-gray">Este plan no tiene beneficios registrados.</p> : <ul className="mt-3 grid gap-2">{plan.benefits.map((benefit) => <li className="rounded-lg bg-slate-50 p-3" key={benefit.id}><div className="flex flex-wrap items-center justify-between gap-2"><span className="text-sm font-bold text-ink">{benefit.description}</span><span className="text-xs font-black text-brand-green">{benefit.benefitCode}</span></div>{canManage ? <RetireBenefit benefitId={benefit.id} /> : null}</li>)}</ul>}{canManage ? <form action={action} className="mt-4 grid gap-3 sm:grid-cols-[150px_1fr_auto]"><input name="planId" type="hidden" value={plan.id} /><Field label="Código" name="benefitCode" placeholder="SAUNA" required /><Field label="Descripción" name="description" placeholder="Uso de sauna" required /><button className="min-h-11 self-end rounded-xl border border-brand-green px-4 py-2 text-sm font-black text-brand-green hover:bg-brand-sand disabled:opacity-60" disabled={pending} type="submit">{pending ? "Agregando…" : "Agregar beneficio"}</button><ActionMessage state={state} /></form> : null}</section>;
}

function RetireBenefit({ benefitId }: { benefitId: string }) {
  const [state, action, pending] = useActionState(retireMembershipPlanBenefitAction, initialState);
  return <details className="mt-2"><summary className="cursor-pointer text-xs font-bold text-red-700">Retirar beneficio</summary><form action={action} className="mt-2 flex flex-wrap items-end gap-2"><input name="benefitId" type="hidden" value={benefitId} /><Field label="Motivo" name="reason" required /><button className="min-h-11 rounded-xl bg-red-700 px-3 py-2 text-xs font-black text-white disabled:opacity-60" disabled={pending} type="submit">{pending ? "Retirando…" : "Confirmar retiro"}</button></form><ActionMessage state={state} /></details>;
}

function PlanForm({ action, buttonLabel, eyebrow, title, plan }: { action: typeof createMembershipPlanAction; buttonLabel: string; eyebrow?: string; title?: string; plan?: MembershipPlanDto }) {
  const [state, formAction, pending] = useActionState(action, initialState);
  return (
    <form action={formAction} className={plan ? "mt-4 grid gap-4 md:grid-cols-2" : "self-start rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"}>
      {eyebrow ? <p className="text-xs font-black uppercase tracking-[0.16em] text-brand-green">{eyebrow}</p> : null}
      {title ? <h2 className="mt-2 text-2xl font-black text-ink">{title}</h2> : null}
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
        <button className="min-h-11 rounded-xl bg-brand-green px-4 py-3 text-sm font-black text-white hover:bg-green-800 disabled:opacity-60" disabled={pending} type="submit">{pending ? "Guardando…" : buttonLabel}</button>
      </div>
    </form>
  );
}

function RetirePlan({ planId }: { planId: string }) {
  const [state, action, pending] = useActionState(retireMembershipPlanAction, initialState);
  return <form action={action} className="mt-5 border-t border-red-200 pt-4"><input name="planId" type="hidden" value={planId} /><Field label="Motivo del retiro" name="reason" required /><ActionMessage state={state} /><button className="mt-3 min-h-11 rounded-xl bg-red-700 px-4 py-2 text-sm font-black text-white disabled:opacity-60" disabled={pending} type="submit">{pending ? "Retirando…" : "Retirar plan"}</button></form>;
}

function DeletedPlans({ plans, unavailable }: { plans: DeletedMembershipPlanDto[]; unavailable: boolean }) {
  return <div className="border-t border-slate-200 bg-slate-50 p-5"><h2 className="text-lg font-black text-ink">Papelera</h2>{unavailable ? <p className="mt-2 text-sm font-semibold text-red-700">No pudimos cargar los planes retirados.</p> : null}{!unavailable && plans.length === 0 ? <p className="mt-2 text-sm text-gray">No hay planes retirados.</p> : null}<div className="mt-3 grid gap-3">{plans.map((plan) => <RestorePlan key={plan.id} plan={plan} />)}</div></div>;
}

function RestorePlan({ plan }: { plan: DeletedMembershipPlanDto }) {
  const [state, action, pending] = useActionState(restoreMembershipPlanAction, initialState);
  return <form action={action} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4"><input name="planId" type="hidden" value={plan.id} /><div><p className="font-black text-ink">{plan.label}</p><p className="text-sm text-gray">{plan.reason ?? "Sin motivo registrado"}</p><ActionMessage state={state} /></div><button className="min-h-11 rounded-xl border border-brand-green px-4 py-2 text-sm font-black text-brand-green hover:bg-brand-sand disabled:opacity-60" disabled={pending} type="submit">{pending ? "Restaurando…" : "Restaurar"}</button></form>;
}

function Field(props: { label: string; name: string; required?: boolean; defaultValue?: string; placeholder?: string; type?: string; min?: string; inputMode?: "decimal" | "numeric" }) {
  const { label, ...inputProps } = props;
  return <label className="block text-sm font-bold text-ink">{label}<input className={controlClass} {...inputProps} /></label>;
}

function Select({ label, name, defaultValue, options }: { label: string; name: string; defaultValue: string; options: Array<[string, string]> }) {
  return <label className="block text-sm font-bold text-ink">{label}<select className={controlClass} defaultValue={defaultValue} name={name}>{options.map(([value, text]) => <option key={value} value={value}>{text}</option>)}</select></label>;
}

function ActionMessage({ state }: { state: MembershipPlanActionState }) {
  return state.message ? <p aria-live="polite" className={`text-sm font-bold ${state.ok ? "text-green-700" : "text-red-700"}`}>{state.message}</p> : null;
}

function formatDuration(count: number, unit: MembershipPlanDto["durationUnit"]) {
  const labels = { day: count === 1 ? "día" : "días", week: count === 1 ? "semana" : "semanas", month: count === 1 ? "mes" : "meses" };
  return `${count} ${labels[unit]}`;
}
