"use client";

import { useActionState } from "react";

import { ActionFeedback } from "@/features/app/components/action-feedback";

import type { BranchDto } from "@/features/settings/types/branch.dto";
import { deleteMemberAction, updateMemberAction, type MemberActionState } from "../actions/member.actions";
import type { MemberDetailDto } from "../types/member.dto";

const initialState: MemberActionState = { ok: false };
const controlClass = "field";

export function MemberAdministration({ member, branches, canManage }: { member: MemberDetailDto; branches: BranchDto[]; canManage: boolean }) {
  if (!canManage) return null;
  const phone = member.contacts.find((contact) => contact.type === "phone")?.value ?? "";
  const email = member.contacts.find((contact) => contact.type === "email")?.value ?? "";
  return <section className="panel mt-6 p-5"><p className="type-eyebrow">Administración</p><h2 className="type-heading mt-2">Editar miembro</h2><EditMemberForm branches={branches} email={email} member={member} phone={phone} /><RetireMemberForm gymMemberId={member.gymMemberId} /></section>;
}

function EditMemberForm({ member, branches, phone, email }: { member: MemberDetailDto; branches: BranchDto[]; phone: string; email: string }) {
  const [state, action, pending] = useActionState(updateMemberAction, initialState);
  return <form action={action} className="mt-5 grid gap-4 md:grid-cols-2"><input name="gymMemberId" type="hidden" value={member.gymMemberId} /><Field defaultValue={member.firstName} label="Nombre" name="firstName" required /><Field defaultValue={member.lastName} label="Apellido" name="lastName" required /><Field defaultValue={member.memberCode} label="Código" name="memberCode" required /><label className="field-label">Sucursal<select className={controlClass} defaultValue={member.branchId ?? ""} name="branchId"><option value="">Sin sucursal</option>{branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select></label><Field defaultValue={phone} label="Teléfono" name="phone" /><Field defaultValue={email} label="Correo" name="email" type="email" /><ActionMessage state={state} /><button className="btn btn-secondary md:col-start-2" disabled={pending} type="submit">{pending ? "Guardando…" : "Guardar cambios"}</button></form>;
}

function RetireMemberForm({ gymMemberId }: { gymMemberId: string }) {
  const [state, action, pending] = useActionState(deleteMemberAction, initialState);
  return <details className="mt-6 rounded-xl border border-line bg-fill p-4"><summary className="cursor-pointer text-sm font-semibold text-stop">Retirar miembro</summary><p className="mt-2 text-sm text-muted">El historial de pagos, membresías y entradas se conservará. El miembro dejará de aparecer en la operación diaria.</p><form action={action} className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]"><input name="gymMemberId" type="hidden" value={gymMemberId} /><Field label="Motivo del retiro" name="reason" required /><button className="btn btn-secondary self-end text-stop" disabled={pending} type="submit">{pending ? "Retirando…" : "Confirmar retiro"}</button><ActionMessage state={state} /></form></details>;
}

function Field(props: { label: string; name: string; required?: boolean; defaultValue?: string; type?: string }) {
  const { label, ...inputProps } = props;
  return <label className="field-label">{label}<input className={controlClass} {...inputProps} /></label>;
}

function ActionMessage({ state }: { state: MemberActionState }) { return <ActionFeedback state={state} />; }
