"use client";

import { useActionState } from "react";

import { restoreMemberAction, type MemberActionState } from "../actions/member.actions";
import type { DeletedMemberDto } from "../types/member.dto";

const initialState: MemberActionState = { ok: false };

export function DeletedMembers({ members }: { members: DeletedMemberDto[] }) {
  if (members.length === 0) return <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm font-semibold text-gray shadow-sm">No hay miembros retirados.</section>;
  return <section className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="divide-y divide-slate-100">{members.map((member) => <RestoreMember key={member.id} member={member} />)}</div></section>;
}

function RestoreMember({ member }: { member: DeletedMemberDto }) {
  const [state, action, pending] = useActionState(restoreMemberAction, initialState);
  return <form action={action} className="flex flex-wrap items-center justify-between gap-4 p-5"><input name="gymMemberId" type="hidden" value={member.id} /><div><h2 className="font-black text-ink">{member.label}</h2><p className="mt-1 text-sm text-gray">Retirado: {formatDate(member.deletedAt)}</p><p className="text-sm text-gray">Motivo: {member.reason ?? "Sin motivo registrado"}</p>{state.message ? <p aria-live="polite" className={`mt-2 text-sm font-bold ${state.ok ? "text-green-700" : "text-red-700"}`}>{state.message}</p> : null}</div><button className="min-h-11 rounded-xl border border-brand-green px-4 py-2 text-sm font-black text-brand-green hover:bg-brand-sand disabled:opacity-60" disabled={pending} type="submit">{pending ? "Restaurando…" : "Restaurar"}</button></form>;
}

function formatDate(value: string) {
  if (!value) return "Fecha no disponible";
  return new Intl.DateTimeFormat("es-NI", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(value));
}
