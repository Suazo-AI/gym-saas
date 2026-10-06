"use client";

import { useActionState } from "react";

import { ActionFeedback } from "@/features/app/components/action-feedback";

import { restoreMemberAction, type MemberActionState } from "../actions/member.actions";
import type { DeletedMemberDto } from "../types/member.dto";

const initialState: MemberActionState = { ok: false };

export function DeletedMembers({ members }: { members: DeletedMemberDto[] }) {
  if (members.length === 0) return <section className="panel mt-6 p-8 text-center text-sm text-muted">No hay miembros retirados.</section>;
  return <section className="panel mt-6 overflow-hidden"><div className="divide-y divide-line">{members.map((member) => <RestoreMember key={member.id} member={member} />)}</div></section>;
}

function RestoreMember({ member }: { member: DeletedMemberDto }) {
  const [state, action, pending] = useActionState(restoreMemberAction, initialState);
  return <form action={action} className="grid gap-4 p-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"><input name="gymMemberId" type="hidden" value={member.id} /><div><h2 className="font-semibold text-ink">{member.label}</h2><p className="tabular mt-1 text-sm text-muted">Retirado: {formatDate(member.deletedAt)}</p><p className="break-words text-sm text-muted">Motivo: {member.reason ?? "Sin motivo registrado"}</p><ActionFeedback className="mt-2" state={state} /></div><button className="btn btn-secondary justify-self-start sm:justify-self-end" disabled={pending} type="submit">{pending ? "Restaurando…" : "Restaurar"}</button></form>;
}

function formatDate(value: string) {
  if (!value) return "Fecha no disponible";
  return new Intl.DateTimeFormat("es-NI", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(value));
}
