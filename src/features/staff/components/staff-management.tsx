"use client";

import { useActionState } from "react";

import { deleteStaffAction, inviteStaffAction, updateStaffAction, type StaffActionState } from "../actions/staff.actions";
import type { StaffRoleDto, StaffUserDto } from "../types/staff.dto";

const initialState: StaffActionState = { ok: false };

export function StaffManagement({ staff, roles }: { staff: StaffUserDto[]; roles: StaffRoleDto[] }) {
  const [inviteState, inviteAction, invitePending] = useActionState(inviteStaffAction, initialState);

  return (
    <div className="mt-6 grid gap-6 xl:grid-cols-[360px_1fr]">
      <aside className="self-start rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <p className="text-xs font-black uppercase tracking-[0.16em] text-brand-green">Nuevo acceso</p>
        <h2 className="mt-2 text-2xl font-black text-ink">Invitar personal</h2>
        <p className="mt-2 text-sm text-gray">La persona recibirá un correo para establecer su contraseña.</p>
        <form action={inviteAction} className="mt-5 grid gap-4">
          <Field label="Correo" name="email" required type="email" />
          <Field label="Código de empleado" name="employeeCode" />
          <RoleChoices roles={roles} />
          <ActionMessage state={inviteState} />
          <button className="min-h-11 rounded-xl bg-brand-green px-4 py-3 text-sm font-black text-white hover:bg-green-800 disabled:opacity-60" disabled={invitePending} type="submit">
            {invitePending ? "Enviando…" : "Enviar invitación"}
          </button>
        </form>
      </aside>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 p-5">
          <h2 className="text-xl font-black text-ink">Equipo del gimnasio</h2>
          <p className="mt-1 text-sm text-gray">{staff.length} usuarios activos o invitados.</p>
        </div>
        {staff.length === 0 ? (
          <p className="p-8 text-center text-sm font-semibold text-gray">Todavía no hay personal visible.</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {staff.map((person) => <StaffEditor key={person.id} person={person} roles={roles} />)}
          </div>
        )}
      </section>
    </div>
  );
}

function StaffEditor({ person, roles }: { person: StaffUserDto; roles: StaffRoleDto[] }) {
  const [updateState, updateAction, updatePending] = useActionState(updateStaffAction, initialState);
  const [deleteState, deleteAction, deletePending] = useActionState(deleteStaffAction, initialState);
  return (
    <article className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-black text-ink">{person.fullName ?? person.email ?? "Usuario invitado"}</h3>
          <p className="text-sm text-gray">{person.email ?? "Correo no disponible"}</p>
        </div>
        <span className="rounded-full bg-brand-sand px-3 py-1 text-xs font-black uppercase text-green-900">{statusLabel(person.status)}</span>
      </div>
      <form action={updateAction} className="mt-5 grid gap-4 md:grid-cols-2">
        <input name="gymUserId" type="hidden" value={person.id} />
        <Field defaultValue={person.employeeCode ?? ""} label="Código de empleado" name="employeeCode" />
        <label className="text-sm font-bold text-ink">Estado
          <select className={controlClass} defaultValue={person.status} name="status">
            <option value="invited">Invitado</option><option value="active">Activo</option>
            <option value="suspended">Suspender</option><option value="revoked">Revocado</option>
          </select>
        </label>
        <div className="md:col-span-2"><RoleChoices roles={roles} selected={person.roles.map((role) => role.id)} /></div>
        <div className="md:col-span-2"><p className="text-sm font-bold text-ink">Permisos efectivos</p><div className="mt-2 flex flex-wrap gap-2">{person.permissions.map((permission)=><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-gray-dark" key={permission}>{permission}</span>)}</div></div>
        <div className="flex items-center justify-between gap-3 md:col-span-2">
          <ActionMessage state={updateState} />
          <button className="min-h-11 rounded-xl bg-brand-green px-4 py-2 text-sm font-black text-white hover:bg-green-800 disabled:opacity-60" disabled={updatePending} type="submit">Guardar cambios</button>
        </div>
      </form>
      <details className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4">
        <summary className="cursor-pointer text-sm font-black text-red-800">Retirar usuario</summary>
        <form action={deleteAction} className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end">
          <input name="gymUserId" type="hidden" value={person.id} />
          <Field label="Motivo del retiro" name="reason" required />
          <button className="min-h-11 rounded-xl bg-red-700 px-4 py-2 text-sm font-black text-white" disabled={deletePending} type="submit">Confirmar retiro</button>
        </form>
        <ActionMessage state={deleteState} />
      </details>
    </article>
  );
}

const controlClass = "mt-2 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 outline-none focus:border-brand-green focus:ring-2 focus:ring-brand-sand";
function Field(props: { label: string; name: string; type?: string; required?: boolean; defaultValue?: string }) {
  return <label className="block text-sm font-bold text-ink">{props.label}<input className={controlClass} {...props} /></label>;
}
function RoleChoices({ roles, selected = [] }: { roles: StaffRoleDto[]; selected?: string[] }) {
  return <fieldset><legend className="text-sm font-bold text-ink">Roles</legend><div className="mt-2 flex flex-wrap gap-2">{roles.map((role) => <label className="rounded-full border border-slate-300 px-3 py-2 text-sm font-semibold" key={role.id}><input className="mr-2 accent-brand-green" defaultChecked={selected.includes(role.id)} name="roleIds" type="checkbox" value={role.id} />{role.name}</label>)}</div></fieldset>;
}
function ActionMessage({ state }: { state: StaffActionState }) { return state.message ? <p aria-live="polite" className={`text-sm font-bold ${state.ok ? "text-green-700" : "text-red-700"}`}>{state.message}</p> : null; }
function statusLabel(status: StaffUserDto["status"]) { return ({ invited: "Invitado", active: "Activo", suspended: "Suspendido", revoked: "Revocado" })[status]; }
