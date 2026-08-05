"use client";

import { useActionState } from "react";

import type { BranchDto } from "@/features/settings/types/branch.dto";
import { deleteMemberAction, updateMemberAction, type MemberActionState } from "../actions/member.actions";
import type { MemberDetailDto } from "../types/member.dto";

const initialState: MemberActionState = { ok: false };
const controlClass = "mt-2 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-ink outline-none focus:border-brand-green focus:ring-2 focus:ring-brand-sand";

export function MemberAdministration({ member, branches, canManage }: { member: MemberDetailDto; branches: BranchDto[]; canManage: boolean }) {
  if (!canManage) return null;
  const phone = member.contacts.find((contact) => contact.type === "phone")?.value ?? "";
  const email = member.contacts.find((contact) => contact.type === "email")?.value ?? "";
  return <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-xs font-black uppercase tracking-[0.16em] text-brand-green">Administración</p><h2 className="mt-2 text-xl font-black text-ink">Editar miembro</h2><EditMemberForm branches={branches} email={email} member={member} phone={phone} /><RetireMemberForm gymMemberId={member.gymMemberId} /></section>;
}

function EditMemberForm({ member, branches, phone, email }: { member: MemberDetailDto; branches: BranchDto[]; phone: string; email: string }) {
  const [state, action, pending] = useActionState(updateMemberAction, initialState);
  return <form action={action} className="mt-5 grid gap-4 md:grid-cols-2"><input name="gymMemberId" type="hidden" value={member.gymMemberId} /><Field defaultValue={member.firstName} label="Nombre" name="firstName" required /><Field defaultValue={member.lastName} label="Apellido" name="lastName" required /><Field defaultValue={member.memberCode} label="Código" name="memberCode" required /><label className="text-sm font-bold text-ink">Sucursal<select className={controlClass} defaultValue={member.branchId ?? ""} name="branchId"><option value="">Sin sucursal</option>{branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select></label><Field defaultValue={phone} label="Teléfono" name="phone" /><Field defaultValue={email} label="Correo" name="email" type="email" /><ActionMessage state={state} /><button className="min-h-11 rounded-xl bg-brand-green px-4 py-3 text-sm font-black text-white hover:bg-green-800 disabled:opacity-60 md:col-start-2" disabled={pending} type="submit">{pending ? "Guardando…" : "Guardar cambios"}</button></form>;
}

function RetireMemberForm({ gymMemberId }: { gymMemberId: string }) {
  const [state, action, pending] = useActionState(deleteMemberAction, initialState);
  return <details className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4"><summary className="cursor-pointer text-sm font-black text-red-800">Retirar miembro</summary><p className="mt-2 text-sm text-red-700">El historial de pagos, membresías y entradas se conservará. El miembro dejará de aparecer en la operación diaria.</p><form action={action} className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto]"><input name="gymMemberId" type="hidden" value={gymMemberId} /><Field label="Motivo del retiro" name="reason" required /><button className="min-h-11 self-end rounded-xl bg-red-700 px-4 py-2 text-sm font-black text-white disabled:opacity-60" disabled={pending} type="submit">{pending ? "Retirando…" : "Confirmar retiro"}</button><ActionMessage state={state} /></form></details>;
}

function Field(props: { label: string; name: string; required?: boolean; defaultValue?: string; type?: string }) {
  const { label, ...inputProps } = props;
  return <label className="text-sm font-bold text-ink">{label}<input className={controlClass} {...inputProps} /></label>;
}

function ActionMessage({ state }: { state: MemberActionState }) {
  return state.message ? <p aria-live="polite" className={`text-sm font-bold ${state.ok ? "text-green-700" : "text-red-700"}`}>{state.message}</p> : null;
}
