"use client";

import { useActionState } from "react";

import { createPlatformGymAction, type PlatformGymActionState } from "../actions/platform-gym.actions";

const initialState: PlatformGymActionState = { ok: false };
const controlClass = "mt-2 min-h-11 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-ink outline-none focus:border-brand-green focus:ring-2 focus:ring-brand-sand";

export function CreatePlatformGymForm() {
  const [state, action, pending] = useActionState(createPlatformGymAction, initialState);

  return (
    <section className="mt-6 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="max-w-3xl">
        <p className="text-xs font-black uppercase tracking-[0.14em] text-brand-green">Alta segura</p>
        <h2 className="mt-2 text-2xl font-black text-[#061f46]">Crear gimnasio y dueño</h2>
        <p className="mt-2 text-sm text-slate-600">Crea el tenant, sus roles y permisos; luego envía al dueño una invitación para establecer su contraseña.</p>
      </div>

      <form action={action} className="mt-5 grid gap-4 md:grid-cols-2">
        <Field label="Razón social" name="legalName" required />
        <Field label="Nombre comercial" name="tradeName" required />
        <Field hint="Ejemplo: impulso-fitness" label="Slug" name="slug" pattern="[a-z0-9]+(-[a-z0-9]+)*" required />
        <Field label="RUC o identificación fiscal" name="taxIdentifier" />
        <label className="text-sm font-bold text-ink">Moneda predeterminada
          <select className={controlClass} defaultValue="NIO" name="defaultCurrency">
            <option value="NIO">NIO — Córdoba</option>
            <option value="USD">USD — Dólar</option>
          </select>
        </label>
        <label className="text-sm font-bold text-ink">Zona horaria
          <select className={controlClass} defaultValue="America/Managua" name="timezone">
            <option value="America/Managua">America/Managua</option>
          </select>
        </label>
        <Field label="Nombre del dueño" name="ownerName" required />
        <Field label="Correo del dueño" name="ownerEmail" required type="email" />

        <div className="flex flex-col gap-3 md:col-span-2 md:flex-row md:items-center md:justify-between">
          <p aria-live="polite" className={`text-sm font-bold ${state.ok ? "text-green-700" : "text-red-700"}`}>{state.message}</p>
          <button className="min-h-11 rounded-md bg-brand-green px-5 py-3 text-sm font-black text-white hover:bg-green-800 disabled:opacity-60" disabled={pending} type="submit">
            {pending ? "Creando…" : "Crear e invitar dueño"}
          </button>
        </div>
      </form>
    </section>
  );
}

function Field({ hint, label, ...input }: { hint?: string; label: string; name: string; type?: string; required?: boolean; pattern?: string }) {
  return (
    <label className="text-sm font-bold text-ink">
      {label}
      <input className={controlClass} {...input} />
      {hint ? <span className="mt-1 block text-xs font-normal text-slate-500">{hint}</span> : null}
    </label>
  );
}
