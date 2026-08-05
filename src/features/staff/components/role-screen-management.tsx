"use client";

import { useActionState, useState } from "react";

import { updateRoleScreenAction, type RoleScreenState } from "../actions/role-screen.actions";
import type { RoleScreenAccessDto } from "../types/staff.dto";

export function RoleScreenManagement({ access }: { access: RoleScreenAccessDto }) {
  const firstEditable = access.roles.find((role) => !role.isOwner) ?? access.roles[0];
  const [roleId, setRoleId] = useState(firstEditable?.id ?? "");
  const role = access.roles.find((item) => item.id === roleId) ?? firstEditable;

  return <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
    <p className="text-xs font-black uppercase tracking-[.16em] text-brand-green">Roles y pantallas</p>
    <h2 className="mt-2 text-2xl font-black text-ink">Configurar accesos del equipo</h2>
    <p className="mt-2 text-sm text-gray">Elige un rol y marca exactamente las pantallas que podrá ver. Los permisos operativos siguen protegidos en Supabase.</p>
    <label className="mt-5 block max-w-md text-sm font-black text-ink">Rol que deseas configurar
      <select className="mt-2 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3" onChange={(event) => setRoleId(event.target.value)} value={role?.id ?? ""}>
        {access.roles.map((item) => <option key={item.id} value={item.id}>{item.name}{item.isOwner ? " — protegido" : ""}</option>)}
      </select>
    </label>
    {role ? <RoleEditor access={access} key={role.id} role={role} /> : <p className="mt-5 text-gray">No hay roles configurables.</p>}
  </section>;
}

function RoleEditor({ role, access }: { role: RoleScreenAccessDto["roles"][number]; access: RoleScreenAccessDto }) {
  const [selected, setSelected] = useState<string[]>(role.screenIds);
  const [state, action, pending] = useActionState(updateRoleScreenAction, { ok: false } as RoleScreenState);
  const toggle = (id: string) => setSelected((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);

  return <form action={action} className="mt-5 rounded-xl border border-slate-200 p-4">
    <input name="roleId" type="hidden" value={role.id} />
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><h3 className="text-lg font-black text-ink">{role.name}</h3><p className="text-sm text-gray">{selected.length} de {access.screens.length} pantallas seleccionadas</p></div>
      {role.isOwner ? <span className="rounded-full bg-brand-sand px-3 py-1 text-xs font-black text-green-900">Acceso total protegido</span> : <div className="flex gap-2"><button className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-black" onClick={() => setSelected(access.screens.map((screen) => screen.id))} type="button">Marcar todas</button><button className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-black" onClick={() => setSelected([])} type="button">Limpiar selección</button></div>}
    </div>
    <fieldset className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3" disabled={role.isOwner}>
      {access.screens.map((screen) => <label className={`flex min-h-14 items-center gap-3 rounded-lg border px-3 text-sm font-bold ${selected.includes(screen.id) ? "border-brand-green bg-brand-green text-white" : "border-slate-200 bg-white text-ink"}`} key={screen.id}>
        <input checked={role.isOwner || selected.includes(screen.id)} className="h-4 w-4 accent-brand-green" name="screenIds" onChange={() => toggle(screen.id)} type="checkbox" value={screen.id} />
        <span>{screen.name}<small className={`block font-normal ${selected.includes(screen.id) ? "text-white/90" : "text-gray"}`}>{permissionLabel(screen.permissionCodes)}</small></span>
      </label>)}
    </fieldset>
    {role.isOwner ? <p className="mt-4 text-sm text-gray">El rol Dueño conserva acceso total para evitar que el gimnasio quede sin administración.</p> : <button className="mt-4 min-h-11 rounded-lg bg-ink px-5 text-sm font-black text-white disabled:opacity-60" disabled={pending}>{pending ? "Guardando…" : `Guardar ${selected.length} pantallas`}</button>}
    {state.message ? <p className={`mt-3 text-sm font-bold ${state.ok ? "text-green-700" : "text-red-700"}`}>{state.message}</p> : null}
  </form>;
}

function permissionLabel(codes: string[]) {
  const labels: Record<string, string> = { "dashboard.read": "Ver resumen", "members.read": "Ver miembros", "memberships.read": "Ver membresías", "payments.read": "Ver pagos", "income.read": "Ver ingresos", "faces.read": "Ver entradas", "alerts.read": "Ver alertas", "staff.read": "Ver personal", "roles.manage": "Administrar roles", "gym.read": "Ver configuración", "billing.read": "Ver facturación SaaS", "audit.read": "Ver auditoría" };
  return codes.map((code) => labels[code] ?? code).join(", ");
}
