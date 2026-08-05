"use client";

import { useActionState } from "react";

import {
  createBranchAction,
  restoreBranchAction,
  retireBranchAction,
  updateBranchAction,
  type BranchActionState,
} from "../actions/branch.actions";
import type { BranchDto, DeletedBranchDto } from "../types/branch.dto";

const initialState: BranchActionState = { ok: false };
const controlClass = "mt-2 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-ink outline-none focus:border-brand-green focus:ring-2 focus:ring-brand-sand";

type Props = {
  branches: BranchDto[];
  deletedBranches: DeletedBranchDto[];
  canManage?: boolean;
  deletedBranchesUnavailable?: boolean;
};

export function BranchManagement({ branches, deletedBranches, canManage = true, deletedBranchesUnavailable = false }: Props) {
  return (
    <div className="mt-6 grid gap-6 xl:grid-cols-[360px_1fr]">
      {canManage ? <CreateBranchForm /> : null}

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 p-5">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-brand-green">Ubicaciones</p>
          <h2 className="mt-2 text-xl font-black text-ink">Sucursales del gimnasio</h2>
          <p className="mt-1 text-sm text-gray">{branches.length} {branches.length === 1 ? "sucursal visible" : "sucursales visibles"}.</p>
        </div>

        {branches.length === 0 ? (
          <p className="p-8 text-center text-sm font-semibold text-gray">Todavía no hay sucursales registradas.</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {branches.map((branch) => <BranchEditor branch={branch} canManage={canManage} key={branch.id} />)}
          </div>
        )}

        {canManage ? <DeletedBranches branches={deletedBranches} unavailable={deletedBranchesUnavailable} /> : null}
      </section>
    </div>
  );
}

function CreateBranchForm() {
  const [state, action, pending] = useActionState(createBranchAction, initialState);
  return (
    <aside className="self-start rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-black uppercase tracking-[0.16em] text-brand-green">Nueva ubicación</p>
      <h2 className="mt-2 text-2xl font-black text-ink">Crear sucursal</h2>
      <p className="mt-2 text-sm text-gray">Registra una sede para organizar miembros, personal y accesos.</p>
      <form action={action} className="mt-5 grid gap-4">
        <Field label="Código" name="code" placeholder="Ej. CEN" required />
        <Field label="Nombre" name="name" placeholder="Ej. Central" required />
        <Field label="Ciudad" name="city" placeholder="Ej. Managua" />
        <StatusSelect />
        <ActionMessage state={state} />
        <button className="min-h-11 rounded-xl bg-brand-green px-4 py-3 text-sm font-black text-white hover:bg-green-800 disabled:opacity-60" disabled={pending} type="submit">
          {pending ? "Creando…" : "Crear sucursal"}
        </button>
      </form>
    </aside>
  );
}

function BranchEditor({ branch, canManage }: { branch: BranchDto; canManage: boolean }) {
  const [updateState, updateAction, updatePending] = useActionState(updateBranchAction, initialState);
  const [retireState, retireAction, retirePending] = useActionState(retireBranchAction, initialState);

  return (
    <article className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-black text-ink">{branch.name}</h3>
          <p className="text-sm text-gray">{branch.code} · {branch.city ?? "Ciudad no indicada"}</p>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-black uppercase ${branch.status === "active" ? "bg-brand-sand text-green-900" : "bg-slate-200 text-slate-700"}`}>
          {branch.status === "active" ? "Activa" : "Inactiva"}
        </span>
      </div>

      {canManage ? (
        <>
          <form action={updateAction} className="mt-5 grid gap-4 md:grid-cols-2">
            <input name="branchId" type="hidden" value={branch.id} />
            <Field defaultValue={branch.code} label="Código" name="code" required />
            <Field defaultValue={branch.name} label="Nombre" name="name" required />
            <Field defaultValue={branch.city ?? ""} label="Ciudad" name="city" />
            <StatusSelect defaultValue={branch.status} />
            <div className="flex items-center justify-between gap-3 md:col-span-2">
              <ActionMessage state={updateState} />
              <button className="min-h-11 rounded-xl bg-ink px-4 py-2 text-sm font-black text-white hover:bg-charcoal disabled:opacity-60" disabled={updatePending} type="submit">
                {updatePending ? "Guardando…" : "Guardar cambios"}
              </button>
            </div>
          </form>

          <details className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4">
            <summary className="cursor-pointer text-sm font-black text-red-800">Retirar sucursal</summary>
            <p className="mt-2 text-sm text-red-700">La sucursal pasará a la papelera y podrá restaurarse.</p>
            <form action={retireAction} className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end">
              <input name="branchId" type="hidden" value={branch.id} />
              <Field label="Motivo del retiro" name="reason" required />
              <button className="min-h-11 shrink-0 rounded-xl bg-red-700 px-4 py-2 text-sm font-black text-white disabled:opacity-60" disabled={retirePending} type="submit">
                {retirePending ? "Retirando…" : "Retirar sucursal"}
              </button>
            </form>
            <ActionMessage state={retireState} />
          </details>
        </>
      ) : null}
    </article>
  );
}

function DeletedBranches({ branches, unavailable }: { branches: DeletedBranchDto[]; unavailable: boolean }) {
  return (
    <div className="border-t border-slate-200 bg-slate-50 p-5">
      <h2 className="text-lg font-black text-ink">Papelera</h2>
      {unavailable ? <p className="mt-2 text-sm font-semibold text-red-700">No pudimos cargar las sucursales retiradas.</p> : null}
      {!unavailable && branches.length === 0 ? <p className="mt-2 text-sm text-gray">No hay sucursales retiradas.</p> : null}
      <div className="mt-3 grid gap-3">
        {branches.map((branch) => <RestoreBranch branch={branch} key={branch.id} />)}
      </div>
    </div>
  );
}

function RestoreBranch({ branch }: { branch: DeletedBranchDto }) {
  const [state, action, pending] = useActionState(restoreBranchAction, initialState);
  return (
    <form action={action} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4">
      <input name="branchId" type="hidden" value={branch.id} />
      <div>
        <p className="font-black text-ink">{branch.label}</p>
        <p className="text-sm text-gray">{branch.reason ?? "Sin motivo registrado"}</p>
        <ActionMessage state={state} />
      </div>
      <button className="min-h-11 rounded-xl border border-brand-green px-4 py-2 text-sm font-black text-brand-green hover:bg-brand-sand disabled:opacity-60" disabled={pending} type="submit">
        {pending ? "Restaurando…" : "Restaurar"}
      </button>
    </form>
  );
}

function Field(props: { label: string; name: string; required?: boolean; defaultValue?: string; placeholder?: string }) {
  const { label, ...inputProps } = props;
  return <label className="block text-sm font-bold text-ink">{label}<input className={controlClass} {...inputProps} /></label>;
}

function StatusSelect({ defaultValue = "active" }: { defaultValue?: BranchDto["status"] }) {
  return <label className="block text-sm font-bold text-ink">Estado<select className={controlClass} defaultValue={defaultValue} name="status"><option value="active">Activa</option><option value="inactive">Inactiva</option></select></label>;
}

function ActionMessage({ state }: { state: BranchActionState }) {
  return state.message ? <p aria-live="polite" className={`mt-2 text-sm font-bold ${state.ok ? "text-green-700" : "text-red-700"}`}>{state.message}</p> : null;
}
