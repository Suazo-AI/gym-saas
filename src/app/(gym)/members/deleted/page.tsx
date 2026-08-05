import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { ModuleHeader } from "@/features/app/components/module-header";
import { getActiveGym } from "@/features/gyms/services/get-active-gym";
import { DeletedMembers } from "@/features/members/components/deleted-members";
import { canManageMembers, listDeletedMembers } from "@/features/members/services/member.repository";

export default async function DeletedMembersPage() {
  const activeGym = await getActiveGym();
  if (!activeGym) redirect("/login");
  if (!(await canManageMembers(activeGym.gymId))) notFound();
  const members = await listDeletedMembers(activeGym.gymId).catch(() => null);
  return <><ModuleHeader eyebrow="Miembros" title="Papelera de miembros" description="Restaura miembros retirados sin perder su historial." action={<Link className="rounded-xl border border-slate-300 px-4 py-3 text-sm font-black text-ink hover:bg-slate-100" href="/members">Volver a miembros</Link>} />{members ? <DeletedMembers members={members} /> : <section className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-6 text-sm font-bold text-red-700">No pudimos cargar los miembros retirados.</section>}</>;
}
